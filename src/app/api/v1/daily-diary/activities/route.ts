import { NextRequest } from 'next/server'
import { withApi } from '@/lib/with-api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { ok, Errors } from '@/lib/api'
import { DailyDiaryService } from '@/lib/daily-diary/daily-diary-service'
import { isoDate } from '@/lib/format'

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'attendance:mark')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { classroomId, date, title, activityType, startTime, endTime, teacherId, description, activities } = body

    if (!classroomId) {
      return Errors.badRequest('classroomId is required')
    }

    const dateStr = date || isoDate()

    if (Array.isArray(activities) && activities.length > 0) {
      const result = await DailyDiaryService.createActivitiesBatch(session, {
        classroomId,
        dateStr,
        activities,
      })
      return ok(result)
    }

    if (!title) {
      return Errors.badRequest('title is required')
    }

    const activity = await DailyDiaryService.createActivity(session, {
      classroomId,
      dateStr,
      title,
      activityType,
      startTime,
      endTime,
      teacherId,
      description,
    })

    return ok(activity)
  } catch (err: any) {
    if (err.message?.includes('FORBIDDEN_TEACHER_CLASSROOM_ACCESS')) {
      return Errors.forbidden(err.message)
    }
    return Errors.badRequest(err.message || 'Failed to create daily activity')
  }
}

export const POST = withApi(_POST)
