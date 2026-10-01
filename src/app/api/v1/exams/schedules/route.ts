import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { ExamsService } from '@/lib/exams/exam-service'

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'exams:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const body = await req.json()
    if (!body.examId || !body.classroomId || !body.subjectId || !body.examDate || !body.startTime || !body.endTime) {
      return Errors.validation('examId, classroomId, subjectId, examDate, startTime and endTime are required')
    }
    const schedule = await ExamsService.addSchedule(session.tenantId, body.examId, body)
    return ok(schedule, undefined, 201)
  } catch (err: any) {
    return bad(err.message, 'SCHEDULE_CREATE_FAILED')
  }
}

export const POST = withApi(_POST)
