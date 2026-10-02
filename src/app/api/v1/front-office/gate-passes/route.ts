import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { getRequestMeta } from '@/lib/audit/audit-service'
import { FrontOfficeService } from '@/lib/front-office/front-office-service'

/** GET /api/v1/front-office/gate-passes — list (supports ?status=&studentId=&date=) */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'frontoffice:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const { searchParams } = new URL(req.url)
    const passes = await FrontOfficeService.listGatePasses(session.tenantId, {
      status: searchParams.get('status') || undefined,
      studentId: searchParams.get('studentId') || undefined,
      date: searchParams.get('date') || undefined,
    })
    return ok(passes)
  } catch (err: any) {
    return bad(err.message, 'GATE_PASSES_FETCH_FAILED')
  }
}

/** POST /api/v1/front-office/gate-passes — create gate pass */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'frontoffice:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const body = await req.json()
    const meta = getRequestMeta(req)
    const pass = await FrontOfficeService.createGatePass(
      session.tenantId, body,
      { id: session.uid, name: session.name, role: session.role, ipAddress: meta.ipAddress, userAgent: meta.userAgent },
    )
    return ok(pass, undefined, 201)
  } catch (err: any) {
    return bad(err.message, 'GATE_PASS_CREATE_FAILED')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
