import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { transitionFollowUp } from '@/lib/followups'

/**
 * PATCH /api/v1/operations/follow-ups/{id} — human transition of the
 * exception/follow-up state machine (notification ≠ resolution).
 * Body: { action: acknowledge|start|wait|resolve|close|reopen, note?, outcome? }
 */
async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'operations:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const action = body?.action as string
  if (!['acknowledge', 'start', 'wait', 'resolve', 'close', 'reopen'].includes(action)) {
    return Errors.validation('action must be acknowledge|start|wait|resolve|close|reopen')
  }

  try {
    const result = await transitionFollowUp({
      id,
      tenantId: session.tenantId,
      action: action as 'resolve',
      note: body.note,
      outcome: body.outcome,
      actorId: session.uid,
      actorName: session.name,
    })

    if ('error' in result) {
      if (result.error === 'NOT_FOUND') return Errors.notFound('Follow-up')
      return Errors.conflict(`Cannot ${action} from status ${('from' in result && result.from) || ''}`)
    }

    return ok({
      id: result.followUp.id, status: result.followUp.status,
      outcome: result.followUp.outcome, resolvedAt: result.followUp.resolvedAt,
    })
  } catch (e) {
    return Errors.system(e)
  }
}

export const PATCH = withApi(_PATCH)
