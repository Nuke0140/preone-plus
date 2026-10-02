import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, serverError } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { SessionService } from '@/lib/users/session-service'
import { SESSION_COOKIE } from '@/lib/auth'
import { recordAudit, getRequestMeta } from '@/lib/audit'

/**
 * GET /api/v1/users/sessions — List active sessions for the authenticated user (UAM-E5, UAM-E6)
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req)
  if (isResponse(session)) return session

  try {
    const rawSessions = await SessionService.getUserSessions(session.uid)

    // Identify current session
    let currentToken: string | null = null
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      currentToken = authHeader.slice(7).trim()
    } else {
      const cookieHeader = req.headers.get('cookie')
      if (cookieHeader) {
        const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]*)`))
        if (match && match[1]) currentToken = decodeURIComponent(match[1])
      }
    }
    const currentHash = currentToken ? SessionService.hashToken(currentToken) : null

    const sessions = rawSessions.map((s) => ({
      id: s.id,
      device: s.device,
      platform: s.platform,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
      isCurrent: currentHash ? (s as any).tokenHash === currentHash : false,
    }))

    return ok(sessions)
  } catch (err: any) {
    return serverError(err.message)
  }
}

/**
 * POST /api/v1/users/sessions — Bulk terminate sessions (e.g., Logout from all other devices)
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req)
  if (isResponse(session)) return session

  try {
    let body: any = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const keepCurrent = body.keepCurrent !== false

    let currentHash: string | undefined = undefined
    if (keepCurrent) {
      let currentToken: string | null = null
      const authHeader = req.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        currentToken = authHeader.slice(7).trim()
      } else {
        const cookieHeader = req.headers.get('cookie')
        if (cookieHeader) {
          const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]*)`))
          if (match && match[1]) currentToken = decodeURIComponent(match[1])
        }
      }
      if (currentToken) {
        currentHash = SessionService.hashToken(currentToken)
      }
    }

    const count = await SessionService.revokeAllUserSessions(session.uid, currentHash)

    const meta = getRequestMeta(req)
    await recordAudit({
      tenantId: session.tenantId,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
      action: keepCurrent ? 'REVOKE_OTHER_SESSIONS' : 'REVOKE_ALL_SESSIONS',
      entity: 'UserSession',
      module: 'AUTH',
      severity: 'INFO',
      summary: `User revoked ${count} active sessions (${keepCurrent ? 'kept current device' : 'all devices'})`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      newValues: { revokedCount: count, keepCurrent },
    })

    return ok({ success: true, revokedCount: count })
  } catch (err: any) {
    return serverError(err.message)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
