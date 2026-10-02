import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { EventsService } from '@/lib/events/events-service'

type Params = { params: Promise<{ id: string }> }

/** GET /api/v1/events/[id]/registrations */
async function _GET(req: NextRequest, { params }: Params) {
  const session = await requireApi(req, 'events:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const { id } = await params
    const registrations = await EventsService.listRegistrations(session.tenantId, id)
    return ok(registrations)
  } catch (err: any) {
    return bad(err.message, 'REGISTRATIONS_FETCH_FAILED')
  }
}

export const GET = withApi(_GET)
