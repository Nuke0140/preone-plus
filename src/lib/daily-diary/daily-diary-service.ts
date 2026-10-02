import { db } from '@/lib/db'
import { SessionPayload } from '@/lib/auth'
import { recordAudit } from '@/lib/audit'
import { AttendanceStatus, ActivityStatus, ObservationConcern } from '@prisma/client'

export interface DailyDiaryScope {
  tenantId: string
  branchId?: string | null
  userId: string
  role: string
  isTeacher: boolean
  isAdmin: boolean
}

export function getScopeFromSession(session: SessionPayload): DailyDiaryScope {
  const role = session.role
  const roles = session.roles || [role]
  const isTeacher = roles.includes('TEACHER')
  const isAdmin = roles.some((r) => ['OWNER', 'PRINCIPAL', 'COORDINATOR', 'PLATFORM_ADMIN', 'ADMIN'].includes(r))

  return {
    tenantId: session.tenantId!,
    branchId: session.branchId || null,
    userId: session.uid,
    role,
    isTeacher: isTeacher && !isAdmin, // strict teacher if not admin
    isAdmin,
  }
}

function getDayBounds(dateStr: string) {
  const startOfDay = new Date(`${dateStr}T00:00:00.000Z`)
  const endOfDay = new Date(`${dateStr}T23:59:59.999Z`)
  const dateOnly = new Date(dateStr)
  dateOnly.setUTCHours(0, 0, 0, 0)
  return { startOfDay, endOfDay, dateOnly }
}

/** Convert HH:MM or HH:MM AM/PM time string to total minutes from midnight for overlap comparison */
function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0
  const clean = timeStr.trim().toUpperCase()
  const isPM = clean.includes('PM')
  const isAM = clean.includes('AM')
  const digitsOnly = clean.replace(/[^0-9:]/g, '')
  const parts = digitsOnly.split(':')
  let hours = parseInt(parts[0], 10) || 0
  const minutes = parseInt(parts[1], 10) || 0
  if (isPM && hours < 12) hours += 12
  if (isAM && hours === 12) hours = 0
  return hours * 60 + minutes
}

/** Helper: Assert that a teacher only accesses their assigned classroom */
async function assertClassroomAccess(session: SessionPayload, classroomId: string) {
  const tenantId = session.tenantId!
  const scope = getScopeFromSession(session)
  if (scope.isAdmin) return

  const classroom = await db.classroom.findFirst({
    where: { id: classroomId, tenantId },
    select: { primaryTeacherId: true },
  })

  if (!classroom) {
    throw new Error('Classroom not found')
  }

  if (classroom.primaryTeacherId === session.uid) {
    return
  }

  const isMapped = await db.classroomSubject.findFirst({
    where: { classroomId, specialistTeacherId: session.uid },
  })

  if (!isMapped) {
    throw new Error('FORBIDDEN_TEACHER_CLASSROOM_ACCESS: You are only authorized to manage your assigned classroom')
  }
}

export class DailyDiaryService {
  /**
   * Resolve context: Active Academic Session, available Branches, available Classrooms.
   * If user is a Teacher, return only their assigned classrooms.
   */
  static async getContext(session: SessionPayload) {
    const tenantId = session.tenantId!
    const scope = getScopeFromSession(session)

    // 1. Fetch current/active academic session
    const academicSession = await db.academicSession.findFirst({
      where: { tenantId, status: 'ACTIVE' },
      orderBy: { isCurrent: 'desc' },
      select: { id: true, name: true, isCurrent: true, startDate: true, endDate: true },
    })

    // 2. Fetch branches for tenant
    const branches = await db.branch.findMany({
      where: { tenantId, isActive: true, deletedAt: null },
      select: { id: true, name: true, code: true, isMain: true },
      orderBy: { isMain: 'desc' },
    })

    // 3. Resolve assigned classrooms
    let classroomsWhere: any = { tenantId, isActive: true }
    if (scope.isTeacher) {
      // Teacher sees only assigned classrooms (primary teacher or mapped specialist)
      classroomsWhere = {
        tenantId,
        isActive: true,
        OR: [
          { primaryTeacherId: session.uid },
          { subjectMappings: { some: { specialistTeacherId: session.uid } } },
        ],
      }
    } else if (scope.branchId) {
      // Admin scoped by branch if branchId present
      classroomsWhere.branchId = scope.branchId
    }

    const classrooms = await db.classroom.findMany({
      where: classroomsWhere,
      select: {
        id: true,
        name: true,
        code: true,
        programType: true,
        capacity: true,
        branchId: true,
        academicSessionId: true,
        primaryTeacherId: true,
        primaryTeacher: {
          select: { id: true, fullName: true, email: true },
        },
        _count: {
          select: {
            students: { where: { status: 'ACTIVE', deletedAt: null } },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    // 4. Fetch teachers for Admin dropdown scheduling
    let teachers: { id: string; fullName: string; email: string | null }[] = []
    if (scope.isAdmin) {
      teachers = await db.user.findMany({
        where: {
          memberships: { some: { tenantId, role: { in: ['TEACHER', 'COORDINATOR', 'PRINCIPAL'] } } },
          status: 'ACTIVE',
        },
        select: { id: true, fullName: true, email: true },
        orderBy: { fullName: 'asc' },
      })
    }

    // 5. Fetch reusable subject list for tenant
    const subjects = await db.subject.findMany({
      where: { tenantId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true, code: true, shortName: true, subjectType: true },
      orderBy: { name: 'asc' },
    })

    return {
      user: {
        id: session.uid,
        name: session.name,
        email: session.email,
        role: session.role,
        isTeacher: scope.isTeacher,
        isAdmin: scope.isAdmin,
      },
      academicSession,
      branches,
      classrooms: classrooms.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        programType: c.programType,
        capacity: c.capacity,
        branchId: c.branchId,
        academicSessionId: c.academicSessionId,
        primaryTeacherId: c.primaryTeacherId,
        teacherName: c.primaryTeacher?.fullName || 'Unassigned',
        studentCount: c._count.students,
      })),
      teachers,
      subjects,
    }
  }

  /**
   * Get Overview summary for a specific classroom & date.
   */
  static async getOverview(session: SessionPayload, classroomId: string, dateStr: string) {
    const tenantId = session.tenantId!
    const { startOfDay, endOfDay, dateOnly } = getDayBounds(dateStr)

    // Enforce teacher classroom scoping
    await assertClassroomAccess(session, classroomId)

    const classroom = await db.classroom.findFirst({
      where: { id: classroomId, tenantId },
      include: {
        primaryTeacher: { select: { id: true, fullName: true, email: true } },
        academicSession: { select: { id: true, name: true } },
      },
    })

    if (!classroom) {
      throw new Error('Classroom not found')
    }

    const branch = classroom.branchId
      ? await db.branch.findUnique({
          where: { id: classroom.branchId },
          select: { id: true, name: true, code: true },
        })
      : null

    // Fetch active students in classroom
    const students = await db.student.findMany({
      where: { currentClassroomId: classroomId, tenantId, status: 'ACTIVE', deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNo: true,
        photoUrl: true,
        gender: true,
      },
      orderBy: { firstName: 'asc' },
    })

    // Fetch attendance on date
    const attendanceRecords = await db.attendance.findMany({
      where: { classroomId, tenantId, date: dateOnly },
    })

    const attendanceMap = new Map<string, any>(attendanceRecords.map((a) => [a.studentId, a]))

    let present = 0
    let absent = 0
    let late = 0
    let halfDay = 0
    let unmarked = 0

    students.forEach((s) => {
      const rec = attendanceMap.get(s.id)
      if (!rec) {
        unmarked++
      } else {
        switch (rec.status) {
          case 'PRESENT':
            present++
            break
          case 'ABSENT':
            absent++
            break
          case 'LATE':
            late++
            break
          case 'HALF_DAY':
            halfDay++
            break
          default:
            unmarked++
            break
        }
      }
    })

    // Fetch today's activities chronologically sorted by startTime
    const activities = await db.classroomActivity.findMany({
      where: {
        classroomId,
        tenantId,
        activityDate: { gte: startOfDay, lte: endOfDay },
        deletedAt: null,
      },
      include: {
        teacher: { select: { id: true, fullName: true } },
      },
      orderBy: [{ startTime: 'asc' }, { createdAt: 'asc' }],
    })

    const completedActivities = activities.filter((a) => a.status === 'COMPLETED').length
    const coreSubjectsCount = activities.filter((a) =>
      ['CORE_TEACHING', 'CORE_SUBJECT'].includes(a.activityType || '')
    ).length
    const activitiesCount = activities.length - coreSubjectsCount

    // Fetch today's observations
    const observations = await db.observation.findMany({
      where: {
        classroomId,
        tenantId,
        observedAt: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { observedAt: 'desc' },
    })

    return {
      classroom: {
        id: classroom.id,
        name: classroom.name,
        code: classroom.code,
        programType: classroom.programType,
        capacity: classroom.capacity,
        teacherName: classroom.primaryTeacher?.fullName || 'Unassigned',
        teacherId: classroom.primaryTeacherId,
        branchName: branch?.name,
        sessionName: classroom.academicSession?.name,
      },
      date: dateStr,
      stats: {
        totalStudents: students.length,
        present,
        absent,
        late,
        halfDay,
        unmarked,
        totalActivities: activities.length,
        coreSubjectsCount,
        activitiesCount,
        completedActivities,
        totalObservations: observations.length,
      },
      activities: activities.map((a) => ({
        id: a.id,
        title: a.title,
        activityType: a.activityType || 'ACTIVITY',
        startTime: a.startTime || '09:00',
        endTime: a.endTime || '09:30',
        teacherId: a.teacherId,
        teacherName: a.teacher?.fullName || classroom.primaryTeacher?.fullName || 'Teacher',
        status: a.status,
        description: a.description,
        actualOutcome: a.actualOutcome,
      })),
      observations: observations.map((o) => ({
        id: o.id,
        studentId: o.studentId,
        studentName: o.student ? `${o.student.firstName} ${o.student.lastName || ''}`.trim() : 'General Class Observation',
        narrative: o.narrative,
        category: o.category || 'General',
        concern: o.concern,
        observedAt: o.observedAt,
      })),
    }
  }

  /**
   * Get Attendance Register for class + date.
   */
  static async getAttendanceRegister(session: SessionPayload, classroomId: string, dateStr: string) {
    const tenantId = session.tenantId!
    const { dateOnly } = getDayBounds(dateStr)

    // Enforce teacher classroom scoping
    await assertClassroomAccess(session, classroomId)

    const students = await db.student.findMany({
      where: { currentClassroomId: classroomId, tenantId, status: 'ACTIVE', deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNo: true,
        photoUrl: true,
        gender: true,
      },
      orderBy: { firstName: 'asc' },
    })

    const attendanceRows = await db.attendance.findMany({
      where: { classroomId, tenantId, date: dateOnly },
    })

    const attMap = new Map<string, any>(attendanceRows.map((r) => [r.studentId, r]))

    return students.map((s) => {
      const att = attMap.get(s.id)
      return {
        studentId: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        name: `${s.firstName} ${s.lastName || ''}`.trim(),
        admissionNo: s.admissionNo,
        photoUrl: s.photoUrl,
        gender: s.gender,
        status: (att?.status as AttendanceStatus) || null,
        notes: att?.notes || '',
        markedAt: att?.markedAt || null,
        markedById: att?.markedById || null,
      }
    })
  }

  /**
   * Batch Save / Update Attendance.
   */
  static async saveAttendanceRegister(
    session: SessionPayload,
    classroomId: string,
    dateStr: string,
    records: { studentId: string; status: AttendanceStatus; notes?: string }[]
  ) {
    const tenantId = session.tenantId!
    const { dateOnly } = getDayBounds(dateStr)

    // Enforce teacher classroom scoping
    await assertClassroomAccess(session, classroomId)

    const classroom = await db.classroom.findUnique({
      where: { id: classroomId },
      select: { branchId: true, academicSessionId: true, name: true },
    })

    if (!classroom) throw new Error('Classroom not found')

    const scope = getScopeFromSession(session)

    // Process each student record inside transaction
    const saved = await db.$transaction(async (tx) => {
      const results: any[] = []
      for (const rec of records) {
        const item = await tx.attendance.upsert({
          where: {
            studentId_date: {
              studentId: rec.studentId,
              date: dateOnly,
            },
          },
          update: {
            status: rec.status,
            notes: rec.notes || null,
            markedById: session.uid,
            markedAt: new Date(),
            classroomId,
            branchId: classroom.branchId,
            academicSessionId: classroom.academicSessionId,
          },
          create: {
            tenantId,
            branchId: classroom.branchId,
            classroomId,
            studentId: rec.studentId,
            date: dateOnly,
            status: rec.status,
            notes: rec.notes || null,
            markedById: session.uid,
            academicSessionId: classroom.academicSessionId,
          },
        })
        results.push(item)
      }
      return results
    })

    // Record audit if admin updated
    if (scope.isAdmin) {
      await recordAudit({
        tenantId,
        actorId: session.uid,
        action: 'ATTENDANCE_BATCH_SAVE',
        entity: 'ATTENDANCE',
        entityId: classroomId,
        summary: `Admin ${session.name} updated attendance for class ${classroom.name} on ${dateStr}`,
        newValues: { classroomId, date: dateStr, count: records.length },
      })
    }

    return { success: true, count: saved.length }
  }

  /**
   * Create Today's Timetable / Activity Entry (With time validation & overlap detection)
   */
  static async createActivity(
    session: SessionPayload,
    data: {
      classroomId: string
      dateStr: string
      title: string
      activityType?: string
      startTime?: string
      endTime?: string
      teacherId?: string
      description?: string
    }
  ) {
    const tenantId = session.tenantId!
    const { startOfDay, endOfDay, dateOnly } = getDayBounds(data.dateStr)

    // Enforce teacher classroom scoping
    await assertClassroomAccess(session, data.classroomId)

    const classroom = await db.classroom.findUnique({
      where: { id: data.classroomId },
      select: { academicSessionId: true, primaryTeacherId: true },
    })

    if (!classroom) throw new Error('Classroom not found')

    const startStr = data.startTime || '09:00'
    const endStr = data.endTime || '09:30'
    const startMin = timeToMinutes(startStr)
    const endMin = timeToMinutes(endStr)

    if (endMin <= startMin) {
      throw new Error('VALIDATION_ERROR: End Time must be after Start Time')
    }

    // Time Overlap Check with existing active activities for this classroom on the date
    const existingActivities = await db.classroomActivity.findMany({
      where: {
        classroomId: data.classroomId,
        tenantId,
        activityDate: { gte: startOfDay, lte: endOfDay },
        status: { not: 'CANCELLED' },
        deletedAt: null,
      },
    })

    for (const ext of existingActivities) {
      const extStart = timeToMinutes(ext.startTime || '00:00')
      const extEnd = timeToMinutes(ext.endTime || '23:59')
      if (startMin < extEnd && extStart < endMin) {
        throw new Error(
          `OVERLAP_ERROR: This activity overlaps with "${ext.title}" (${ext.startTime || '00:00'}–${ext.endTime || '23:59'})`
        )
      }
    }

    const activeSession = await db.academicSession.findFirst({
      where: { tenantId, status: 'ACTIVE' },
      select: { id: true },
    })

    const targetSessionId = classroom.academicSessionId || activeSession?.id
    if (!targetSessionId) {
      throw new Error('VALIDATION_ERROR: No active academic session found')
    }

    let targetTeacherId = data.teacherId && data.teacherId.trim() !== '' ? data.teacherId : classroom.primaryTeacherId || session.uid
    if (targetTeacherId) {
      const validUser = await db.user.findUnique({ where: { id: targetTeacherId }, select: { id: true } })
      if (!validUser) targetTeacherId = session.uid
    } else {
      targetTeacherId = session.uid
    }

    const activity = await db.classroomActivity.create({
      data: {
        tenantId,
        academicSessionId: targetSessionId,
        classroomId: data.classroomId,
        teacherId: targetTeacherId,
        title: data.title,
        activityType: data.activityType || 'ACTIVITY',
        activityDate: dateOnly,
        startTime: startStr,
        endTime: endStr,
        description: data.description || null,
        status: 'PLANNED',
        createdBy: session.uid,
      },
      include: {
        teacher: { select: { id: true, fullName: true } },
      },
    })

    return activity
  }

  /**
   * Create multiple schedule activity entries at once (Daily Schedule Builder)
   */
  static async createActivitiesBatch(
    session: SessionPayload,
    data: {
      classroomId: string
      dateStr: string
      activities: {
        title: string
        activityType?: string
        startTime?: string
        endTime?: string
        teacherId?: string
        description?: string
      }[]
    }
  ) {
    const tenantId = session.tenantId!
    const { startOfDay, endOfDay, dateOnly } = getDayBounds(data.dateStr)

    // Enforce teacher classroom scoping
    await assertClassroomAccess(session, data.classroomId)

    const classroom = await db.classroom.findUnique({
      where: { id: data.classroomId },
      select: { academicSessionId: true, primaryTeacherId: true },
    })

    if (!classroom) throw new Error('Classroom not found')

    const activeSession = await db.academicSession.findFirst({
      where: { tenantId, status: 'ACTIVE' },
      select: { id: true },
    })

    const targetSessionId = classroom.academicSessionId || activeSession?.id
    if (!targetSessionId) {
      throw new Error('VALIDATION_ERROR: No active academic session found')
    }

    if (!data.activities || data.activities.length === 0) {
      throw new Error('VALIDATION_ERROR: At least one activity row is required')
    }

    // 1. Validate internal time ranges and internal overlaps inside the batch
    const parsedRows = data.activities.map((item, idx) => {
      const startStr = item.startTime || '09:00'
      const endStr = item.endTime || '09:30'
      const startMin = timeToMinutes(startStr)
      const endMin = timeToMinutes(endStr)

      if (endMin <= startMin) {
        throw new Error(`VALIDATION_ERROR: Row ${idx + 1} (${item.title || 'Untitled'}): End Time must be after Start Time`)
      }

      return { ...item, startStr, endStr, startMin, endMin }
    })

    for (let i = 0; i < parsedRows.length; i++) {
      for (let j = i + 1; j < parsedRows.length; j++) {
        const r1 = parsedRows[i]
        const r2 = parsedRows[j]
        if (r1.startMin < r2.endMin && r2.startMin < r1.endMin) {
          throw new Error(
            `OVERLAP_ERROR: "${r1.title}" (${r1.startStr}–${r1.endStr}) overlaps with "${r2.title}" (${r2.startStr}–${r2.endStr}) in schedule builder.`
          )
        }
      }
    }

    // 2. Validate overlaps against existing saved database activities
    const existingActivities = await db.classroomActivity.findMany({
      where: {
        classroomId: data.classroomId,
        tenantId,
        activityDate: { gte: startOfDay, lte: endOfDay },
        status: { not: 'CANCELLED' },
        deletedAt: null,
      },
    })

    for (const row of parsedRows) {
      for (const ext of existingActivities) {
        const extStart = timeToMinutes(ext.startTime || '00:00')
        const extEnd = timeToMinutes(ext.endTime || '23:59')
        if (row.startMin < extEnd && extStart < row.endMin) {
          throw new Error(
            `OVERLAP_ERROR: "${row.title}" (${row.startStr}–${row.endStr}) overlaps with existing activity "${ext.title}" (${ext.startTime || '00:00'}–${ext.endTime || '23:59'})`
          )
        }
      }
    }

    // 3. Create all records in database
    const createdActivities = await db.$transaction(
      parsedRows.map((row) => {
        let targetTeacherId = row.teacherId && row.teacherId.trim() !== '' ? row.teacherId : classroom.primaryTeacherId || session.uid

        return db.classroomActivity.create({
          data: {
            tenantId,
            academicSessionId: targetSessionId,
            classroomId: data.classroomId,
            teacherId: targetTeacherId,
            title: row.title.trim(),
            activityType: row.activityType || 'CORE_SUBJECT',
            activityDate: dateOnly,
            startTime: row.startStr,
            endTime: row.endStr,
            description: row.description || null,
            status: 'PLANNED',
            createdBy: session.uid,
          },
          include: {
            teacher: { select: { id: true, fullName: true } },
          },
        })
      })
    )

    return createdActivities
  }

  /**
   * Update Activity Entry (With time validation & overlap detection)
   */
  static async updateActivity(
    session: SessionPayload,
    activityId: string,
    data: {
      status?: ActivityStatus
      notes?: string
      title?: string
      activityType?: string
      startTime?: string
      endTime?: string
      teacherId?: string
      description?: string
    }
  ) {
    const tenantId = session.tenantId!

    const existing = await db.classroomActivity.findFirst({
      where: { id: activityId, tenantId },
    })

    if (!existing) throw new Error('Activity not found')

    // Enforce teacher classroom scoping
    await assertClassroomAccess(session, existing.classroomId)

    const newStart = data.startTime || existing.startTime || '09:00'
    const newEnd = data.endTime || existing.endTime || '09:30'
    const startMin = timeToMinutes(newStart)
    const endMin = timeToMinutes(newEnd)

    if (endMin <= startMin) {
      throw new Error('VALIDATION_ERROR: End Time must be after Start Time')
    }

    // Overlap validation if updating times
    if (data.startTime || data.endTime) {
      const { startOfDay, endOfDay } = getDayBounds(existing.activityDate.toISOString().split('T')[0])
      const otherActivities = await db.classroomActivity.findMany({
        where: {
          classroomId: existing.classroomId,
          tenantId,
          id: { not: activityId },
          activityDate: { gte: startOfDay, lte: endOfDay },
          status: { not: 'CANCELLED' },
          deletedAt: null,
        },
      })

      for (const ext of otherActivities) {
        const extStart = timeToMinutes(ext.startTime || '00:00')
        const extEnd = timeToMinutes(ext.endTime || '23:59')
        if (startMin < extEnd && extStart < endMin) {
          throw new Error(
            `OVERLAP_ERROR: This activity overlaps with "${ext.title}" (${ext.startTime || '00:00'}–${ext.endTime || '23:59'})`
          )
        }
      }
    }

    const updated = await db.classroomActivity.update({
      where: { id: activityId },
      data: {
        ...(data.status ? { status: data.status } : {}),
        ...(data.notes !== undefined ? { actualOutcome: data.notes } : {}),
        ...(data.title ? { title: data.title } : {}),
        ...(data.activityType ? { activityType: data.activityType } : {}),
        ...(data.startTime ? { startTime: data.startTime } : {}),
        ...(data.endTime ? { endTime: data.endTime } : {}),
        ...(data.teacherId !== undefined ? { teacherId: data.teacherId } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        updatedBy: session.uid,
      },
      include: {
        teacher: { select: { id: true, fullName: true } },
      },
    })

    return updated
  }

  /**
   * Delete Activity Entry
   */
  static async deleteActivity(session: SessionPayload, activityId: string) {
    const tenantId = session.tenantId!

    const existing = await db.classroomActivity.findFirst({
      where: { id: activityId, tenantId },
    })

    if (!existing) throw new Error('Activity not found')

    await assertClassroomAccess(session, existing.classroomId)

    await db.classroomActivity.update({
      where: { id: activityId },
      data: { deletedAt: new Date(), updatedBy: session.uid },
    })

    return { success: true, id: activityId }
  }

  /**
   * Create Observation (Support General Class or Individual Child)
   */
  static async createObservation(
    session: SessionPayload,
    data: {
      studentId?: string | null
      classroomId: string
      narrative: string
      category?: string
      concern?: ObservationConcern
      activityId?: string
    }
  ) {
    const tenantId = session.tenantId!

    // Enforce teacher classroom scoping
    await assertClassroomAccess(session, data.classroomId)

    const classroom = await db.classroom.findUnique({
      where: { id: data.classroomId },
      select: { academicSessionId: true },
    })

    const obs = await db.observation.create({
      data: {
        tenantId,
        academicSessionId: classroom?.academicSessionId,
        studentId: data.studentId || '',
        classroomId: data.classroomId,
        teacherId: session.uid,
        narrative: data.narrative,
        category: data.category || 'General',
        concern: data.concern || 'NORMAL',
        activityId: data.activityId || null,
        status: 'PUBLISHED',
        observedAt: new Date(),
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return obs
  }

  /**
   * Fetch History (Attendance, Activities, Observations) for a classroom over a date range.
   */
  static async getHistory(
    session: SessionPayload,
    classroomId: string,
    startDateStr: string,
    endDateStr: string,
    studentId?: string
  ) {
    const tenantId = session.tenantId!
    const { startOfDay } = getDayBounds(startDateStr)
    const { endOfDay } = getDayBounds(endDateStr)

    // Enforce teacher classroom scoping
    await assertClassroomAccess(session, classroomId)

    // Attendance History
    const attendanceWhere: any = {
      classroomId,
      tenantId,
      date: { gte: startOfDay, lte: endOfDay },
    }
    if (studentId) attendanceWhere.studentId = studentId

    const attendance = await db.attendance.findMany({
      where: attendanceWhere,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
      },
      orderBy: { date: 'desc' },
      take: 100,
    })

    // Activities History
    const activities = await db.classroomActivity.findMany({
      where: {
        classroomId,
        tenantId,
        activityDate: { gte: startOfDay, lte: endOfDay },
        deletedAt: null,
      },
      include: {
        teacher: { select: { id: true, fullName: true } },
      },
      orderBy: { activityDate: 'desc' },
      take: 50,
    })

    // Observations History
    const obsWhere: any = {
      classroomId,
      tenantId,
      observedAt: { gte: startOfDay, lte: endOfDay },
    }
    if (studentId) obsWhere.studentId = studentId

    const observations = await db.observation.findMany({
      where: obsWhere,
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { observedAt: 'desc' },
      take: 50,
    })

    return {
      attendance: attendance.map((a) => ({
        id: a.id,
        date: a.date.toISOString().split('T')[0],
        studentName: `${a.student.firstName} ${a.student.lastName || ''}`.trim(),
        admissionNo: a.student.admissionNo,
        status: a.status,
        notes: a.notes,
      })),
      activities: activities.map((a) => ({
        id: a.id,
        date: a.activityDate.toISOString().split('T')[0],
        title: a.title,
        activityType: a.activityType || 'ACTIVITY',
        status: a.status,
        actualOutcome: a.actualOutcome,
        teacherName: a.teacher?.fullName || 'Teacher',
      })),
      observations: observations.map((o) => ({
        id: o.id,
        date: o.observedAt.toISOString().split('T')[0],
        studentName: o.student ? `${o.student.firstName} ${o.student.lastName || ''}`.trim() : 'General Class Observation',
        narrative: o.narrative,
        category: o.category || 'General',
        concern: o.concern,
      })),
    }
  }

  /**
   * Admin School-wide Daily Overview (across all classes)
   */
  static async getAdminSchoolOverview(session: SessionPayload, dateStr: string, branchId?: string) {
    const tenantId = session.tenantId!
    const scope = getScopeFromSession(session)

    if (!scope.isAdmin) {
      throw new Error('FORBIDDEN: Admin or Coordinator access required for school overview')
    }

    const { startOfDay, endOfDay, dateOnly } = getDayBounds(dateStr)

    const classroomsWhere: any = { tenantId, isActive: true }
    if (branchId) classroomsWhere.branchId = branchId

    const classrooms = await db.classroom.findMany({
      where: classroomsWhere,
      include: {
        primaryTeacher: { select: { id: true, fullName: true } },
        _count: { select: { students: { where: { status: 'ACTIVE', deletedAt: null } } } },
      },
      orderBy: { name: 'asc' },
    })

    const classroomIds = classrooms.map((c) => c.id)

    const attendanceRecords = await db.attendance.findMany({
      where: { classroomId: { in: classroomIds }, tenantId, date: dateOnly },
    })

    const activities = await db.classroomActivity.findMany({
      where: {
        classroomId: { in: classroomIds },
        tenantId,
        activityDate: { gte: startOfDay, lte: endOfDay },
        deletedAt: null,
      },
      include: {
        classroom: { select: { id: true, name: true } },
        teacher: { select: { id: true, fullName: true } },
      },
      orderBy: { startTime: 'asc' },
    })

    let totalStudents = 0
    let present = 0
    let absent = 0
    let late = 0
    let halfDay = 0

    classrooms.forEach((c) => {
      totalStudents += c._count.students
    })

    attendanceRecords.forEach((a) => {
      switch (a.status) {
        case 'PRESENT':
          present++
          break
        case 'ABSENT':
          absent++
          break
        case 'LATE':
          late++
          break
        case 'HALF_DAY':
          halfDay++
          break
      }
    })

    const unmarked = Math.max(0, totalStudents - present - absent - late - halfDay)

    const coreSubjectsCount = activities.filter((a) =>
      ['CORE_TEACHING', 'CORE_SUBJECT'].includes(a.activityType || '')
    ).length
    const activitiesCount = activities.length - coreSubjectsCount

    const classSummaries = classrooms.map((c) => {
      const cAtt = attendanceRecords.filter((a) => a.classroomId === c.id)
      const cPres = cAtt.filter((a) => a.status === 'PRESENT').length
      const cAbs = cAtt.filter((a) => a.status === 'ABSENT').length
      const cLate = cAtt.filter((a) => a.status === 'LATE').length
      const cHalf = cAtt.filter((a) => a.status === 'HALF_DAY').length
      const cUnmarked = Math.max(0, c._count.students - cPres - cAbs - cLate - cHalf)
      const cAct = activities.filter((a) => a.classroomId === c.id)
      const cCore = cAct.filter((a) => ['CORE_TEACHING', 'CORE_SUBJECT'].includes(a.activityType || '')).length

      return {
        id: c.id,
        name: c.name,
        programType: c.programType,
        teacherName: c.primaryTeacher?.fullName || 'Unassigned',
        studentCount: c._count.students,
        present: cPres,
        absent: cAbs,
        late: cLate,
        halfDay: cHalf,
        unmarked: cUnmarked,
        activitiesCount: cAct.length,
        coreSubjectsCount: cCore,
        nonCoreActivitiesCount: cAct.length - cCore,
        completedActivities: cAct.filter((a) => a.status === 'COMPLETED').length,
      }
    })

    return {
      date: dateStr,
      stats: {
        totalClasses: classrooms.length,
        totalStudents,
        present,
        absent,
        late,
        halfDay,
        unmarked,
        totalActivities: activities.length,
        coreSubjectsCount,
        activitiesCount,
      },
      classes: classSummaries,
      schedule: activities.map((a) => ({
        id: a.id,
        classroomId: a.classroomId,
        className: a.classroom.name,
        teacherName: a.teacher?.fullName || 'Teacher',
        title: a.title,
        activityType: a.activityType || 'ACTIVITY',
        startTime: a.startTime || '09:00',
        endTime: a.endTime || '09:30',
        status: a.status,
      })),
    }
  }
}
