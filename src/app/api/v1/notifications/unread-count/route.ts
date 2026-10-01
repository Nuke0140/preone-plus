import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'

/**
 * GET /api/v1/notifications/unread-count
 * Returns the unread notification count for the Topbar badge.
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req)
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const count = await db.inAppNotification.count({
      where: {
        tenantId: session.tenantId,
        userId: session.uid,
        isRead: false,
      },
    })

    return ok({ count })
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
