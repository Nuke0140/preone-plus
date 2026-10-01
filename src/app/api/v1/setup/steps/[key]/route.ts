import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { completeStep, skipStep, reopenStep } from '@/lib/setup/engine'

/**
 * POST /api/v1/setup/steps/{key} — explicit step actions
 * body: { action: 'complete' | 'skip' | 'reopen' }
 */
async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { key } = await params

  try {
    const body = await req.json().catch(() => ({}))
    const action = (body as { action?: string }).action ?? 'complete'
    const actor = { id: session.uid, name: session.name }

    let result: { ok: boolean; message: string; detail?: string }
    if (action === 'complete') result = await completeStep(session.tenantId, key, actor)
    else if (action === 'skip') result = await skipStep(session.tenantId, key, actor)
    else if (action === 'reopen') result = await reopenStep(session.tenantId, key, actor)
    else return Errors.validation('action must be complete | skip | reopen')

    if (!result.ok) {
      return Errors.business('SETUP_002', result.message, 422)
    }
    return ok(result)
  } catch (e) {
    return Errors.system(e)
  }
}

export const POST = withApi(_POST)
