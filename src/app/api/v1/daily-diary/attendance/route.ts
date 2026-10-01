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
  const dateStr = searchParams.get('date') || isoDate()

  if (!classroomId) {
    return Errors.badRequest('classroomId is required')
  }

  try {
    const register = await DailyDiaryService.getAttendanceRegister(session, classroomId, dateStr)
    return ok(register)
  } catch (err: any) {
    if (err.message?.includes('FORBIDDEN_TEACHER_CLASSROOM_ACCESS')) {
      return Errors.forbidden(err.message)
    }
    return Errors.badRequest(err.message || 'Failed to fetch attendance register')
  }
}

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'attendance:mark')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { classroomId, date, records } = body

    if (!classroomId || !records || !Array.isArray(records)) {
      return Errors.badRequest('classroomId and records array are required')
    }

    const dateStr = date || isoDate()
    const res = await DailyDiaryService.saveAttendanceRegister(session, classroomId, dateStr, records)
    return ok(res)
  } catch (err: any) {
    if (err.message?.includes('FORBIDDEN_TEACHER_CLASSROOM_ACCESS')) {
      return Errors.forbidden(err.message)
    }
    return Errors.badRequest(err.message || 'Failed to save attendance register')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
