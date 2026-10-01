import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, withApi, errPermission, errValidation, errNotFound, errBusiness } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { isoDate } from '@/lib/format'
import { dayStatus } from '@/lib/calendar'
import { resolveSessionId } from '@/lib/academic'
import { registerIntegrations } from '@/lib/integrations'
import { emit } from '@/lib/events'

/** GET /api/v1/attendance?classroomId=&date= — class register for a day */
export const GET = withApi(async (req: NextRequest) => {
  const session = await requireApi(req, 'attendance:read')
  if (isResponse(session)) return session
  if (!session.tenantId) {
    throw errPermission('No tenant context found in active session')
  }

  const sp = req.nextUrl.searchParams
  const classroomId = sp.get('classroomId')
  const date = sp.get('date') || isoDate()

  if (!classroomId) {
    throw errValidation('classroomId is required', 'classroomId')
  }

  const classroom = await db.classroom.findFirst({
    where: { id: classroomId, tenantId: session.tenantId },
    include: {
      primaryTeacher: { select: { id: true, fullName: true, email: true } },
      academicSession: { select: { id: true, name: true, code: true } },
    },
  })
  if (!classroom) {
    throw errNotFound('Classroom')
  }

  const branch = await db.branch.findFirst({
    where: { id: classroom.branchId, tenantId: session.tenantId },
    select: { id: true, name: true, code: true },
  })

  // Calendar operating status
  const day = await dayStatus(session.tenantId, date, classroom.branchId)

  // Active students in classroom
  const students = await db.student.findMany({
    where: {
      tenantId: session.tenantId,
      currentClassroomId: classroomId,
      status: 'ACTIVE',
      deletedAt: null,
    },
    orderBy: [{ seatNumber: 'asc' }, { firstName: 'asc' }, { lastName: 'asc' }],
    select: {
      id: true,
      admissionNo: true,
      firstName: true,
      lastName: true,
      photoUrl: true,
      seatNumber: true,
      gender: true,
      dob: true,
      status: true,
    },
  })

  const dateObj = new Date(date)
  const records = await db.attendance.findMany({
    where: { tenantId: session.tenantId, classroomId, date: dateObj },
  })

  // Markers lookup for audit visibility
  const markerIds = Array.from(new Set(records.map((r) => r.markedById).filter(Boolean))) as string[]
  const markers = markerIds.length
    ? await db.user.findMany({
        where: { id: { in: markerIds }, tenantId: session.tenantId },
        select: { id: true, fullName: true },
      })
    : []
  const markerMap = new Map<string, string>(markers.map((m) => [m.id, m.fullName]))

  // Look up any existing follow-ups for absent/late students on this date
  const followUps = await db.followUp.findMany({
    where: {
      tenantId: session.tenantId,
      classroomId,
      domain: 'ATTENDANCE',
      sourceId: { in: students.map((s) => `${s.id}:${date}`) },
    },
    select: {
      id: true,
      studentId: true,
      severity: true,
      status: true,
      title: true,
      detail: true,
      actionTaken: true,
      outcome: true,
      createdAt: true,
    },
  })
  const fuByStudent = new Map(followUps.filter((f) => f.studentId).map((f) => [f.studentId!, f]))

  const byStudent = new Map<string, (typeof records)[number]>(
    records.map((r) => [r.studentId, r])
  )

  const studentRows = students.map((s) => {
    const rec = byStudent.get(s.id)
    const fullName = `${s.firstName} ${s.lastName || ''}`.trim()
    return {
      studentId: s.id,
      name: fullName,
      firstName: s.firstName,
      lastName: s.lastName,
      admissionNo: s.admissionNo,
      seatNumber: s.seatNumber,
      photoUrl: s.photoUrl,
      gender: s.gender,
      dob: s.dob ? isoDate(s.dob) : null,
      status: rec?.status ?? null,
      notes: rec?.notes ?? null,
      markedAt: rec?.markedAt ? rec.markedAt.toISOString() : null,
      markedById: rec?.markedById ?? null,
      markedByName: rec?.markedById ? markerMap.get(rec.markedById) || 'Teacher' : null,
      followUp: fuByStudent.get(s.id) || null,
    }
  })

  const presentCount = records.filter((r) => r.status === 'PRESENT').length
  const absentCount = records.filter((r) => r.status === 'ABSENT').length
  const lateCount = records.filter((r) => r.status === 'LATE').length
  const halfDayCount = records.filter((r) => r.status === 'HALF_DAY').length
  const leaveCount = records.filter((r) => r.status === 'LEAVE').length
  const totalCount = students.length
  const markedCount = records.length
  const unmarkedCount = Math.max(0, totalCount - markedCount)
  const effectivePresent = presentCount + lateCount + halfDayCount * 0.5
  const attendanceRate = totalCount > 0 ? Math.round((effectivePresent / totalCount) * 100) : 0

  const exceptions = studentRows.filter((s) => s.status === 'ABSENT' || s.status === 'LATE')

  return ok({
    date,
    classroom: {
      id: classroom.id,
      name: classroom.name,
      code: classroom.code,
      capacity: classroom.capacity,
      programType: classroom.programType,
      primaryTeacher: classroom.primaryTeacher
        ? {
            id: classroom.primaryTeacher.id,
            name: classroom.primaryTeacher.fullName,
            email: classroom.primaryTeacher.email,
          }
        : null,
      branch: branch ? { id: branch.id, name: branch.name, code: branch.code } : null,
      academicSession: classroom.academicSession
        ? {
            id: classroom.academicSession.id,
            name: classroom.academicSession.name,
            code: classroom.academicSession.code,
          }
        : null,
    },
    dayStatus: day,
    students: studentRows,
    summary: {
      total: totalCount,
      present: presentCount,
      absent: absentCount,
      late: lateCount,
      halfDay: halfDayCount,
      leave: leaveCount,
      unmarked: unmarkedCount,
      marked: markedCount,
      attendanceRate,
    },
    exceptions,
  })
}, { module: 'attendance' })

/** POST /api/v1/attendance — bulk mark / correct for a class (attendance:mark) */
export const POST = withApi(async (req: NextRequest) => {
  const session = await requireApi(req, 'attendance:mark')
  if (isResponse(session)) return session
  if (!session.tenantId) {
    throw errPermission('No tenant context found in active session')
  }
  registerIntegrations()

  const body = await req.json()
  const { classroomId, date, entries, force, reason } = body as {
    classroomId: string
    date: string
    entries: {
      studentId: string
      status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'LEAVE'
      notes?: string
    }[]
    force?: boolean
    reason?: string
  }
  if (!classroomId || !date || !Array.isArray(entries)) {
    throw errValidation('classroomId, date and entries[] are required', 'entries')
  }

  const classroom = await db.classroom.findFirst({
    where: { id: classroomId, tenantId: session.tenantId },
  })
  if (!classroom) {
    throw errNotFound('Classroom')
  }

  // Calendar consumption — M00 config is the single source of truth
  const day = await dayStatus(session.tenantId, date, classroom.branchId)
  if (!day.attendanceExpected && !force) {
    throw errBusiness(
      'BUSINESS_SCHOOL_CLOSED',
      `Attendance not expected on ${date} (${day.status.replace('_', ' ').toLowerCase()}${day.eventTitle ? `: ${day.eventTitle}` : ''}). Send force=true to override — override is audited.`
    )
  }

  const dateObj = new Date(date)
  const sessionRow = await resolveSessionId(session.tenantId, { classroomId })

  // Look up existing records to detect changes (corrections vs new marks)
  const existingRecords = await db.attendance.findMany({
    where: {
      tenantId: session.tenantId,
      classroomId,
      date: dateObj,
      studentId: { in: entries.map((e) => e.studentId) },
    },
  })
  const existingMap = new Map<string, any>(existingRecords.map((r) => [r.studentId, r]))

  let upserts = 0
  let corrections = 0
  const newExceptions: { studentId: string; status: string; name: string }[] = []
  const resolvedExceptions: { studentId: string; prevStatus: string; newStatus: string }[] = []

  await db.$transaction(async (tx) => {
    for (const e of entries) {
      const student = await tx.student.findFirst({
        where: { id: e.studentId, tenantId: session.tenantId! },
      })
      if (!student) continue

      const prev = existingMap.get(e.studentId)
      const isCorrection = prev && prev.status !== e.status
      if (isCorrection) corrections++

      await tx.attendance.upsert({
        where: { studentId_date: { studentId: e.studentId, date: dateObj } },
        create: {
          tenantId: session.tenantId!,
          branchId: classroom.branchId,
          classroomId,
          studentId: e.studentId,
          date: dateObj,
          status: e.status,
          notes: e.notes || (reason && isCorrection ? `[Correction] ${reason}` : undefined),
          markedById: session.uid,
          academicSessionId: sessionRow?.id,
        },
        update: {
          status: e.status,
          notes: e.notes || (reason && isCorrection ? `[Correction] ${reason}` : prev?.notes ?? undefined),
          markedById: session.uid,
          markedAt: new Date(),
          academicSessionId: sessionRow?.id,
        },
      })
      upserts++

      // Exception raised: newly marked as ABSENT or LATE
      if ((!prev || prev.status !== e.status) && (e.status === 'ABSENT' || e.status === 'LATE')) {
        newExceptions.push({ studentId: e.studentId, status: e.status, name: student.firstName })
      }

      // Exception resolved: was ABSENT or LATE, now corrected to PRESENT, HALF_DAY, or LEAVE
      if (prev && (prev.status === 'ABSENT' || prev.status === 'LATE') && e.status !== 'ABSENT' && e.status !== 'LATE') {
        resolvedExceptions.push({ studentId: e.studentId, prevStatus: prev.status, newStatus: e.status })
      }
    }
  })

  // Raise new exceptions via event bus
  for (const ex of newExceptions) {
    await emit({
      type: 'AttendanceExceptionDetected',
      tenantId: session.tenantId,
      studentId: ex.studentId,
      classroomId,
      date,
      status: ex.status as 'ABSENT' | 'LATE',
      detail:
        ex.status === 'LATE'
          ? `Marked LATE on ${date}. Reason/notes to follow.`
          : `Marked ABSENT on ${date}. Reason capture + follow-up required.`,
    })
  }

  // Auto-resolve any pending follow-up tickets for corrected exceptions
  if (resolvedExceptions.length > 0) {
    const { transitionFollowUp } = await import('@/lib/followups')
    const { recordChildEvent } = await import('@/lib/notify')

    for (const res of resolvedExceptions) {
      const dedupeKey = `attendance:${res.studentId}:${date}:${res.prevStatus}`
      const openFu = await db.followUp.findUnique({ where: { dedupeKey } })
      if (openFu && !['RESOLVED', 'CLOSED'].includes(openFu.status)) {
        await transitionFollowUp({
          id: openFu.id,
          tenantId: session.tenantId,
          action: 'resolve',
          outcome: `Attendance corrected to ${res.newStatus}${reason ? `: ${reason}` : ''}`,
          actorId: session.uid,
          actorName: session.name,
        })
      }
      await recordChildEvent({
        tenantId: session.tenantId,
        studentId: res.studentId,
        type: 'NOTE',
        title: `Attendance updated to ${res.newStatus}`,
        body: `Status revised from ${res.prevStatus} to ${res.newStatus}${reason ? ` (${reason})` : ''}`,
        classroomId,
      })
    }
  }

  const { audit: auditLog } = await import('@/lib/sequence')
  const actionDesc = corrections > 0 ? 'UPDATE' : 'CREATE'
  await auditLog({
    tenantId: session.tenantId,
    actorId: session.uid,
    actorName: session.name,
    action: actionDesc,
    entity: 'Attendance',
    entityId: classroomId,
    summary: `Attendance ${corrections > 0 ? 'corrected' : 'marked'} for ${classroom.name} on ${date} — ${upserts} students (${corrections} corrections)${!day.attendanceExpected ? ' (FORCED on closed day)' : ''}${reason ? ` [Reason: ${reason}]` : ''}`,
  })

  return ok({
    markedCount: upserts,
    correctionsCount: corrections,
    absentCount: entries.filter((x) => x.status === 'ABSENT').length,
    lateCount: entries.filter((x) => x.status === 'LATE').length,
    exceptionsRaised: newExceptions.length,
    exceptionsResolved: resolvedExceptions.length,
    dayStatus: day.status,
  })
}, { module: 'attendance' })
