import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, forbidden, serverError } from '@/lib/api'
import { requireApi, isResponse, requireCanManageUser } from '@/lib/auth-api'
import { UserStatus } from '@prisma/client'
import {
  UserLifecycleService,
  LifecycleActionType,
  LIFECYCLE_ACTION_MAP,
  VALID_LIFECYCLE_TRANSITIONS,
} from '@/lib/users/user-lifecycle-service'

export type ActionType = LifecycleActionType
export const ACTION_MAP = LIFECYCLE_ACTION_MAP
export const VALID_TRANSITIONS = VALID_LIFECYCLE_TRANSITIONS

/** POST /api/v1/users/[id]/status — manage user lifecycle states (UAM-E1) */
async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireApi(req, 'users:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return bad('Tenant required', 'TENANT_REQUIRED')

  const manageCheck = await requireCanManageUser(session, id)
  if (isResponse(manageCheck)) return manageCheck
  const { targetMember: member } = manageCheck

  try {
    const body = await req.json()
    const { action, status: explicitStatus, reason } = body as {
      action?: ActionType
      status?: UserStatus
      reason?: string
    }

    const result = await UserLifecycleService.transitionUserStatus({
      member,
      actorSession: {
        uid: session.uid,
        name: session.name,
        role: session.role,
        tenantId: session.tenantId,
      },
      targetStatus: explicitStatus,
      action,
      reason,
      req,
    })

    if (!result.success) {
      if (result.statusHttp === 403) return forbidden(result.error)
      return bad(result.error, result.code)
    }

    if (result.unchanged) {
      return ok({
        userId: member.userId,
        status: member.status,
        message: 'Status already set to requested state',
      })
    }

    return ok({
      userId: result.userId,
      status: result.status,
      updatedAt: result.updatedAt,
    })
  } catch (err: any) {
    return serverError(err.message)
  }
}

export const POST = withApi(_POST)
