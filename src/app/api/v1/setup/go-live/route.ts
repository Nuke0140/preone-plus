import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { goLive } from '@/lib/setup/validate'

/** POST /api/v1/setup/go-live — final gate → SetupStatus.LIVE */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const result = await goLive(session.tenantId, { id: session.uid, name: session.name })
    if (!result.ok) {
      return Errors.business('SETUP_001', result.message, 422)
    }
    return ok({ message: result.message, goLiveAt: new Date().toISOString() })
  } catch (e) {
    return Errors.system(e)
  }
}

export const POST = withApi(_POST)
