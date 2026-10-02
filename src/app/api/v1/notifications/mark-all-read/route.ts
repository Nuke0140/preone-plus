import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { NotificationEngine } from '@/lib/notifications/notification-engine'

/**
 * POST /api/v1/notifications/mark-all-read
 * Marks all unread in-app notifications for the current user as read.
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req)
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const result = await NotificationEngine.markAllAsRead(session.tenantId, session.uid)
    return ok({ markedCount: result.count })
  } catch (e) {
    return Errors.system(e)
  }
}

export const POST = withApi(_POST)
