import { NextRequest } from 'next/server'
import { withApi } from '@/lib/with-api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { ok, Errors } from '@/lib/api'
import { DailyDiaryService } from '@/lib/daily-diary/daily-diary-service'
import { isoDate } from '@/lib/format'

async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'attendance:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { searchParams } = new URL(req.url)
  const classroomId = searchParams.get('classroomId')
  const startDate = searchParams.get('startDate') || isoDate()
  const endDate = searchParams.get('endDate') || isoDate()
  const studentId = searchParams.get('studentId') || undefined

  if (!classroomId) {
    return Errors.badRequest('classroomId is required')
  }

  try {
    const history = await DailyDiaryService.getHistory(session, classroomId, startDate, endDate, studentId)
    return ok(history)
  } catch (err: any) {
    if (err.message?.includes('FORBIDDEN_TEACHER_CLASSROOM_ACCESS')) {
      return Errors.forbidden(err.message)
    }
    return Errors.badRequest(err.message || 'Failed to fetch history')
  }
}

export const GET = withApi(_GET)
