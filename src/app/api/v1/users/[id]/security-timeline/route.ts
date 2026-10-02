import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, bad, notFound, forbidden, serverError } from '@/lib/api'
import { requireApi, isResponse, requireCanManageUser } from '@/lib/auth-api'

/**
 * GET /api/v1/users/[id]/security-timeline — Security & Audit Event Timeline (UAM-E11)
 * Retrieves security, auth, lifecycle, and administrative events for a given user from AuditLog.
 */
async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await requireApi(req, 'users:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return bad('Tenant required', 'TENANT_REQUIRED')

  // Allow self or users with management authority
  const isSelf = session.uid === id
  if (!isSelf) {
    const manageCheck = await requireCanManageUser(session, id)
    if (isResponse(manageCheck)) return manageCheck
  }

  try {
    const logs = await db.auditLog.findMany({
      where: {
        OR: [{ actorId: id }, { entityId: id }],
        tenantId: session.tenantId,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const timeline = logs.map((log) => {
      let oldValues = null
      let newValues = null
      try {
        if (log.oldValues) {
          oldValues = typeof log.oldValues === 'string' ? JSON.parse(log.oldValues) : log.oldValues
        }
      } catch {
        oldValues = log.oldValues
      }
      try {
        if (log.newValues) {
          newValues = typeof log.newValues === 'string' ? JSON.parse(log.newValues) : log.newValues
        }
      } catch {
        newValues = log.newValues
      }

      return {
        id: log.id,
        action: log.action,
        module: log.module,
        summary: log.summary,
        severity: log.severity,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
        actor: {
          id: log.actorId,
          name: log.actorName,
          role: log.actorRole,
        },
        oldValues,
        newValues,
      }
    })

    return ok({
      userId: id,
      totalEvents: timeline.length,
      timeline,
    })
  } catch (err: any) {
    return serverError(err.message)
  }
}

export const GET = withApi(_GET)
