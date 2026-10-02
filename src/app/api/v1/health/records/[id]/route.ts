import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { HealthService } from '@/lib/health/health-service'

type Params = { params: Promise<{ id: string }> }

async function _PATCH(req: NextRequest, { params }: Params) {
  const session = await requireApi(req, 'health:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const { id } = await params
    const body = await req.json()
    const record = await HealthService.updateRecord(session.tenantId, id, body)
    return ok(record)
  } catch (err: any) {
    return bad(err.message, 'HEALTH_UPDATE_FAILED')
  }
}

async function _DELETE(req: NextRequest, { params }: Params) {
  const session = await requireApi(req, 'health:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const { id } = await params
    const record = await HealthService.deleteRecord(session.tenantId, id)
    return ok(record)
  } catch (err: any) {
    return bad(err.message, 'HEALTH_DELETE_FAILED')
  }
}

export const PATCH = withApi(_PATCH)
export const DELETE = withApi(_DELETE)
