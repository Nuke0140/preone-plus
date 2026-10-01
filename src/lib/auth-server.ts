import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE, SessionPayload } from './auth'
import { SessionService } from './users/session-service'

/** Server-only: read the session from cookies (server components / route handlers) or request headers. */
export async function getSession(req?: Request | null): Promise<SessionPayload | null> {
  let token: string | null = null

  // 1. Try Authorization: Bearer <token>
  if (req) {
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim()
    }

    // 2. Try Cookie header directly from request
    if (!token) {
      const cookieHeader = req.headers.get('cookie')
      if (cookieHeader) {
        const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]*)`))
        if (match && match[1]) {
          token = decodeURIComponent(match[1])
        }
      }
    }
  }

  // 3. Fallback to next/headers cookies()
  if (!token) {
    try {
      const store = await cookies()
      token = store.get(SESSION_COOKIE)?.value || null
    } catch {
      token = null
    }
  }

  if (!token) return null

  const session = await verifySession(token)
  if (!session) return null

  // Verify against database session revocation (UAM-E5)
  const dbCheck = await SessionService.validateSession(token)
  if (!dbCheck.valid) {
    return null
  }

  return session
}
