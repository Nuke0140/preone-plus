import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { FeeService } from '@/lib/fees/fee-service'

async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'finance:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const config = await FeeService.getPaymentGatewayConfig(session.tenantId)
    return ok(config)
  } catch (e: any) {
    return Errors.system(e)
  }
}

async function _PUT(req: NextRequest) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const updated = await FeeService.updatePaymentGatewayConfig(
      {
        tenantId: session.tenantId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      body
    )
    return ok(updated)
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const PUT = withApi(_PUT)
