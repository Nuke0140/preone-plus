import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TimetableService } from '@/lib/timetable/timetable-service'

/** POST { classroomId, fromDay, toDay } — clone a day's timetable */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'timetable:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const body = await req.json()
    if (!body.classroomId || !body.fromDay || !body.toDay) {
      return Errors.validation('classroomId, fromDay and toDay are required')
    }
    return ok(await TimetableService.copyDay(session.tenantId, body.classroomId, body.fromDay, body.toDay))
  } catch (err: any) {
    return bad(err.message, 'COPY_DAY_FAILED')
  }
}

export const POST = withApi(_POST)
