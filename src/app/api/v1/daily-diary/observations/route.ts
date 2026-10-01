import { NextRequest } from 'next/server'
import { withApi } from '@/lib/with-api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { ok, Errors } from '@/lib/api'
import { DailyDiaryService } from '@/lib/daily-diary/daily-diary-service'

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'academics:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { studentId, classroomId, narrative, category, concern, activityId } = body

    if (!studentId || !classroomId || !narrative) {
      return Errors.badRequest('studentId, classroomId, and narrative are required')
    }

    const obs = await DailyDiaryService.createObservation(session, {
      studentId,
      classroomId,
      narrative,
      category,
      concern,
      activityId,
    })

    return ok(obs)
  } catch (err: any) {
    if (err.message?.includes('FORBIDDEN_TEACHER_CLASSROOM_ACCESS')) {
      return Errors.forbidden(err.message)
    }
    return Errors.badRequest(err.message || 'Failed to create observation')
  }
}

export const POST = withApi(_POST)
