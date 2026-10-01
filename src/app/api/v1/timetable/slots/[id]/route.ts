import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TimetableService } from '@/lib/timetable/timetable-service'

async function _DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApi(req, 'timetable:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params
  try {
    return ok(await TimetableService.deleteSlot(session.tenantId, id))
  } catch (err: any) {
    return bad(err.message, 'SLOT_DELETE_FAILED')
  }
}

export const DELETE = withApi(_DELETE)
