import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { can } from '@/lib/auth'
import { EventsService } from '@/lib/events/events-service'

async function _GET(req: NextRequest) {
  const session = await requireApi(req)
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const effectiveRoles = session.roles && session.roles.length > 0 ? session.roles : [session.role]
  const hasFull = can(effectiveRoles, 'events:read')
  const hasLinked = can(effectiveRoles, 'events:read-linked')
  if (!hasFull && !hasLinked) {
    return Errors.forbidden('Missing permission: events:read or events:read-linked')
  }
  try {
    const { searchParams } = new URL(req.url)
    const stats = searchParams.get('stats') === '1'
    if (stats && hasFull) return ok(await EventsService.stats(session.tenantId))
    // Events are school-wide — PARENT/GUARDIAN can browse them too
    const events = await EventsService.list(session.tenantId, {
      type: searchParams.get('type') || undefined,
      status: searchParams.get('status') || undefined,
      upcoming: searchParams.get('upcoming') === '1',
      search: searchParams.get('search') || undefined,
    })
    return ok(events)
  } catch (err: any) {
    return bad(err.message, 'EVENTS_FETCH_FAILED')
  }
}

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'events:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const body = await req.json()
    const event = await EventsService.create(
      session.tenantId,
      body,
      { id: session.uid, name: session.name, role: session.role },
    )
    return ok(event, undefined, 201)
  } catch (err: any) {
    return bad(err.message, 'EVENT_CREATE_FAILED')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
