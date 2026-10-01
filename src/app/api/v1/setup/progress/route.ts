import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { syncSetup } from '@/lib/setup/engine'

/** GET /api/v1/setup/progress — lightweight progress widget payload */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'settings:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const payload = await syncSetup(session.tenantId, { id: session.uid, name: session.name })
    if (!payload) return Errors.notFound('Tenant')
    const next = payload.steps.find((s) => s.key === payload.nextStepKey)
    return ok({
      status: payload.status,
      progress: payload.progress,
      nextStepKey: payload.nextStepKey,
      nextStepLabel: next?.label ?? null,
      mandatoryRemaining: payload.steps.filter((s) => s.applicability === 'MANDATORY' && (s.status === 'PENDING' || s.status === 'BLOCKED')).length,
    })
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
