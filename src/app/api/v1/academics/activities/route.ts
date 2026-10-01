import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AcademicService } from '@/lib/academics/academic-service'
import type { ActivityStatus } from '@prisma/client'

/**
 * GET /api/v1/academics/activities — List classroom activities with filters
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'academics:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { searchParams } = new URL(req.url)
  const classroomId = searchParams.get('classroomId') || undefined
  const curriculumId = searchParams.get('curriculumId') || undefined
  const learningGoalId = searchParams.get('learningGoalId') || undefined
  const status = (searchParams.get('status') as ActivityStatus) || undefined
  const dateFrom = searchParams.get('dateFrom') || undefined
  const dateTo = searchParams.get('dateTo') || undefined
  const teacherId = searchParams.get('teacherId') || undefined
  const academicSessionId = searchParams.get('academicSessionId') || undefined

  try {
    const list = await AcademicService.listActivities(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        academicSessionId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      { classroomId, curriculumId, learningGoalId, status, dateFrom, dateTo, teacherId }
    )

    return ok(list)
  } catch (e: any) {
    return Errors.system(e)
  }
}

/**
 * POST /api/v1/academics/activities — Schedule a classroom activity
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'academics:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const {
      classroomId,
      title,
      activityDate,
      curriculumId,
      learningGoalId,
      teacherId,
      description,
      startTime,
      endTime,
      durationMinutes,
      materials,
      instructions,
      expectedOutcome,
      academicSessionId,
    } = body

    if (!classroomId || !title || !activityDate) {
      return Errors.validation('classroomId, title, and activityDate are required')
    }

    const activity = await AcademicService.createActivity(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        academicSessionId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      {
        classroomId,
        title,
        activityDate,
        curriculumId,
        learningGoalId,
        teacherId,
        description,
        startTime,
        endTime,
        durationMinutes: durationMinutes ? parseInt(String(durationMinutes), 10) : undefined,
        materials,
        instructions,
        expectedOutcome,
      }
    )

    return ok(activity, undefined, 201)
  } catch (e: any) {
    return Errors.business('ACTIVITY_CREATE_FAILED', e.message || 'Failed to schedule activity', 422)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
