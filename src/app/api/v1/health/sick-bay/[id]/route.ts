import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { HealthService } from '@/lib/health/health-service'

type Params = { params: Promise<{ id: string }> }

/** PATCH /api/v1/health/sick-bay/[id] — mark student returned to class */
async function _PATCH(req: NextRequest, { params }: Params) {
  const session = await requireApi(req, 'health:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    if (body.action !== 'return-to-class') return Errors.validation('action=return-to-class required')
    const visit = await HealthService.returnToClass(session.tenantId, id)
    return ok(visit)
  } catch (err: any) {
    return bad(err.message, 'SICKBAY_UPDATE_FAILED')
  }
}

export const PATCH = withApi(_PATCH)
