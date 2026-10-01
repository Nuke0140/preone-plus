import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { NotificationEngine } from '@/lib/notifications/notification-engine'

/**
 * GET /api/v1/notifications
 * Lists in-app notifications for the currently authenticated user.
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req)
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const { searchParams } = new URL(req.url)
    const unreadOnly = searchParams.get('unread') === 'true'
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 20
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0

    const result = await NotificationEngine.getUserNotifications(session.tenantId, session.uid, {
      unreadOnly,
      limit,
      offset,
    })

    return ok(result)
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
