import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { can } from '@/lib/auth'
import { db } from '@/lib/db'
import { TimetableService } from '@/lib/timetable/timetable-service'

/**
 * GET /api/v1/timetable
 * ?classroomId=...  → class weekly grid
 * ?teacherId=...    → teacher weekly grid
 * ?meta=classrooms  → classroom + session list for pickers
 * ?meta=teachers    → active staff list for pickers
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req)
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const effectiveRoles = session.roles && session.roles.length > 0 ? session.roles : [session.role]
  const hasFull = can(effectiveRoles, 'timetable:read')
  const hasLinked = can(effectiveRoles, 'timetable:read-linked')
  if (!hasFull && !hasLinked) {
    return Errors.forbidden('Missing permission: timetable:read or timetable:read-linked')
  }
  if (!hasFull) {
    // PARENT/GUARDIAN — resolve the child's classroom and show that timetable
    const guardian = await db.guardian.findFirst({
      where: { tenantId: session.tenantId, userId: session.uid, deletedAt: null },
      include: {
        studentLinks: {
          take: 1,
          include: { student: { select: { currentClassroomId: true } } },
        },
      },
    })
    const classroomId = guardian?.studentLinks?.[0]?.student?.currentClassroomId
    if (!classroomId) return ok({ classroom: null, slots: [] })
    return ok(await TimetableService.getClassTimetable(session.tenantId, classroomId))
  }
  try {
    const { searchParams } = new URL(req.url)
    const classroomId = searchParams.get('classroomId')
    const teacherId = searchParams.get('teacherId')
    const meta = searchParams.get('meta')

    if (meta === 'classrooms') {
      return ok(await TimetableService.listClassrooms(session.tenantId))
    }
    if (meta === 'teachers') {
      return ok(await TimetableService.listTeachers(session.tenantId))
    }
    if (classroomId) {
      return ok(await TimetableService.getClassTimetable(session.tenantId, classroomId))
    }
    if (teacherId) {
      return ok(await TimetableService.getTeacherTimetable(session.tenantId, teacherId))
    }
    return Errors.validation('Provide classroomId, teacherId or meta=classrooms|teachers')
  } catch (err: any) {
    return bad(err.message, 'TIMETABLE_FETCH_FAILED')
  }
}

/** POST — upsert a slot */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'timetable:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const body = await req.json()
    if (!body.classroomId || !body.day || !body.periodNumber || !body.startTime || !body.endTime) {
      return Errors.validation('classroomId, day, periodNumber, startTime and endTime are required')
    }
    const slot = await TimetableService.upsertSlot(session.tenantId, body)
    return ok(slot, undefined, 201)
  } catch (err: any) {
    return bad(err.message, 'SLOT_SAVE_FAILED')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
