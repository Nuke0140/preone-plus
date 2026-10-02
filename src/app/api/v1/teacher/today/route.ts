import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { isoDate } from '@/lib/format'
import { dayStatus } from '@/lib/calendar'

/**
 * GET /api/v1/teacher/today — the teacher's action board (Spec §11, §40).
 * Teacher → branch scope → AY → assigned sections → students. Surfaces ACTIONS
 * (pending attendance, care, observations, follow-ups, messages) — never config tables.
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'attendance:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const tenantId = session.tenantId
    const today = isoDate()
    const todayDate = new Date(today)

    const day = await dayStatus(tenantId, todayDate)

    // assigned sections (branch+AY scoped via classroom), never manual lists
    const mySections = await db.classroom.findMany({
      where: { tenantId, primaryTeacherId: session.uid, isActive: true },
      include: {
        students: {
          where: { status: 'ACTIVE', deletedAt: null },
          select: { id: true, firstName: true, lastName: true, admissionNo: true, photoUrl: true },
          orderBy: { firstName: 'asc' },
        },
        _count: { select: { students: { where: { status: 'ACTIVE', deletedAt: null } } } },
      },
      orderBy: { name: 'asc' },
    })

    const todayAttendance = await db.attendance.findMany({
      where: { tenantId, date: todayDate, classroomId: { in: mySections.map((c) => c.id) } },
      select: { classroomId: true, studentId: true, status: true },
    })

    const sections = mySections.map((c) => {
      const rows = todayAttendance.filter((a) => a.classroomId === c.id)
      const present = rows.filter((r) => ['PRESENT', 'LATE', 'HALF_DAY'].includes(r.status)).length
      const absent = rows.filter((r) => r.status === 'ABSENT').length
      return {
        id: c.id, name: c.name, programType: c.programType, capacity: c.capacity,
        expected: c.students.length,
        present, absent,
        attendancePending: day.attendanceExpected && rows.length === 0,
        students: c.students,
      }
    })

    const myStudentIds = mySections.flatMap((c) => c.students.map((s) => s.id))

    // pending follow-ups assigned to me / my sections
    const followUps = await db.followUp.findMany({
      where: {
        tenantId,
        status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'WAITING'] },
        OR: [
          { assignedToId: session.uid },
          { classroomId: { in: mySections.map((c) => c.id) } },
        ],
      },
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    })

    // today's care entries across my sections
    const careToday = await db.timelineEntry.count({
      where: {
        tenantId,
        studentId: { in: myStudentIds },
        createdAt: { gte: todayDate },
        type: { in: ['MEAL', 'NAP', 'BATHROOM', 'ACTIVITY', 'ARRIVAL'] },
      },
    })

    // observations due heuristic: sections where no observation recorded in last 14 days
    const lastObservation = await db.observation.findFirst({
      where: { tenantId, teacherId: session.uid },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })
    const observationDue =
      !lastObservation ||
      Date.now() - lastObservation.createdAt.getTime() > 14 * 864e5

    return ok({
      today,
      dayStatus: day.status,
      attendanceExpected: day.attendanceExpected,
      sections,
      actions: {
        attendancePending: sections.some((s) => s.attendancePending),
        careEventsToday: careToday,
        observationDue,
        followUpsOpen: followUps.length,
      },
      followUps: followUps.map((f) => ({
        id: f.id, severity: f.severity, domain: f.domain, status: f.status,
        title: f.title,
        student: f.student ? `${f.student.firstName} ${f.student.lastName || ''}`.trim() : null,
        dueAt: f.dueAt, createdAt: f.createdAt,
      })),
    })
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
