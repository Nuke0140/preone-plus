import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { getRequestMeta } from '@/lib/audit/audit-service'
import { EventsService } from '@/lib/events/events-service'

type Params = { params: Promise<{ id: string }> }

async function _GET(req: NextRequest, { params }: Params) {
  const session = await requireApi(req, 'events:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const { id } = await params
    const event = await EventsService.get(session.tenantId, id)
    return ok(event)
  } catch (err: any) {
    return bad(err.message, 'EVENT_FETCH_FAILED')
  }
}

async function _PATCH(req: NextRequest, { params }: Params) {
  const session = await requireApi(req, 'events:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const { id } = await params
    const body = await req.json()
    const meta = getRequestMeta(req)
    const actor = { id: session.uid, name: session.name, role: session.role, ipAddress: meta.ipAddress, userAgent: meta.userAgent }
    if (body.action === 'register') {
      if (!body.studentId) return Errors.validation('studentId is required')
      const reg = await EventsService.register(session.tenantId, id, body.studentId, actor)
      return ok(reg)
    }
    if (body.action === 'cancel-registration') {
      if (!body.studentId) return Errors.validation('studentId is required')
      const reg = await EventsService.cancelRegistration(session.tenantId, id, body.studentId)
      return ok(reg)
    }
    if (body.action === 'mark-attendance') {
      if (!body.studentId) return Errors.validation('studentId is required')
      const reg = await EventsService.markAttendance(session.tenantId, id, body.studentId, Boolean(body.attended))
      return ok(reg)
    }
    if (body.action === 'promote-waitlist') {
      const promoted = await EventsService.promoteFromWaitlist(session.tenantId, id)
      return ok(promoted)
    }
    const event = await EventsService.update(session.tenantId, id, body)
    return ok(event)
  } catch (err: any) {
    return bad(err.message, 'EVENT_ACTION_FAILED')
  }
}

async function _DELETE(req: NextRequest, { params }: Params) {
  const session = await requireApi(req, 'events:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const { id } = await params
    const event = await EventsService.softDelete(session.tenantId, id)
    return ok(event)
  } catch (err: any) {
    return bad(err.message, 'EVENT_DELETE_FAILED')
  }
}

export const GET = withApi(_GET)
export const PATCH = withApi(_PATCH)
export const DELETE = withApi(_DELETE)
