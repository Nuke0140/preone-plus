import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { getRequestMeta } from '@/lib/audit/audit-service'
import { FrontOfficeService } from '@/lib/front-office/front-office-service'

async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'frontoffice:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const { searchParams } = new URL(req.url)
    const stats = searchParams.get('stats') === '1'
    if (stats) return ok(await FrontOfficeService.stats(session.tenantId))
    const visitors = await FrontOfficeService.listVisitors(session.tenantId, {
      date: searchParams.get('date') || undefined,
      open: searchParams.get('open') === '1',
      search: searchParams.get('search') || undefined,
    })
    return ok(visitors)
  } catch (err: any) {
    return bad(err.message, 'VISITORS_FETCH_FAILED')
  }
}

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'frontoffice:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const body = await req.json()
    const meta = getRequestMeta(req)
    const actor = { id: session.uid, name: session.name, role: session.role, ipAddress: meta.ipAddress, userAgent: meta.userAgent }
    if (body.kind === 'gate-pass') {
      const pass = await FrontOfficeService.createGatePass(session.tenantId, body, actor)
      return ok(pass, undefined, 201)
    }
    if (body.action === 'check-out') {
      if (!body.id) return Errors.validation('id is required')
      const visitor = await FrontOfficeService.checkOutVisitor(session.tenantId, body.id, actor)
      return ok(visitor)
    }
    const visitor = await FrontOfficeService.checkInVisitor(session.tenantId, body, actor)
    return ok(visitor, undefined, 201)
  } catch (err: any) {
    return bad(err.message, 'FRONTOFFICE_ACTION_FAILED')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
