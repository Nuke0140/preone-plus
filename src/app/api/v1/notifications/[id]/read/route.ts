import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { NotificationEngine } from '@/lib/notifications/notification-engine'

/**
 * PATCH /api/v1/notifications/[id]/read
 * Marks a specific in-app notification as read.
 */
async function _PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApi(req)
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const { id } = await params
    const updated = await NotificationEngine.markAsRead(session.tenantId, session.uid, id)
    return ok(updated)
  } catch (e: any) {
    if (e.message?.includes('not found')) {
      return Errors.notFound(e.message)
    }
    return Errors.system(e)
  }
}

export const PATCH = withApi(_PATCH)
