import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, notFound, serverError } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { SessionService } from '@/lib/users/session-service'
import { recordAudit, getRequestMeta } from '@/lib/audit'

/**
 * DELETE /api/v1/users/sessions/[sessionId] — Revoke a specific session (UAM-E5)
 */
async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const session = await requireApi(req)
  if (isResponse(session)) return session

  if (!sessionId) {
    return bad('Session ID required', 'SESSION_ID_REQUIRED')
  }

  try {
    const success = await SessionService.revokeSession(sessionId, session.uid)
    if (!success) {
      return notFound('Session not found or already revoked')
    }

    const meta = getRequestMeta(req)
    await recordAudit({
      tenantId: session.tenantId,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
      action: 'REVOKE_SESSION',
      entity: 'UserSession',
      entityId: sessionId,
      module: 'AUTH',
      severity: 'INFO',
      summary: `User revoked session ${sessionId}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    })

    return ok({ success: true, sessionId })
  } catch (err: any) {
    return serverError(err.message)
  }
}

export const DELETE = withApi(_DELETE)
