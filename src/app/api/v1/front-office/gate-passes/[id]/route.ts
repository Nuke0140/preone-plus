import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { FrontOfficeService } from '@/lib/front-office/front-office-service'

type Params = { params: Promise<{ id: string }> }

/** PATCH /api/v1/front-office/gate-passes/[id] — approve|reject|mark_out|mark_returned */
async function _PATCH(req: NextRequest, { params }: Params) {
  const session = await requireApi(req, 'frontoffice:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const { id } = await params
    const body = await req.json()
    if (!body.action) return Errors.validation('action is required')
    const actor = { id: session.uid, name: session.name, role: session.role }
    const pass = await FrontOfficeService.updateGatePassStatus(session.tenantId, id, body.action, actor)
    return ok(pass)
  } catch (err: any) {
    return bad(err.message, 'GATE_PASS_ACTION_FAILED')
  }
}

export const PATCH = withApi(_PATCH)
