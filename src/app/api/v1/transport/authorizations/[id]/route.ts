import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportSecurityService } from '@/lib/transport/transport-security'

/**
 * PATCH /api/v1/transport/authorizations/[id] — Approve, Reject, or Cancel temporary pickup authorization
 */
async function _PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const session = await requireApi(req, 'transport:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json().catch(() => ({}))
    const { action, remarks } = body

    if (!action || !['APPROVE', 'REJECT', 'CANCEL'].includes(action)) {
      return Errors.validation('Action must be APPROVE, REJECT, or CANCEL')
    }

    const context = {
      tenantId: session.tenantId,
      branchId: session.branchId || undefined,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    }

    const scope = await TransportSecurityService.getRoleScopingFilter(context)

    if (scope.isDriver) {
      return Errors.forbidden('Drivers are not authorized to approve or reject pickup authorizations')
    }

    let authorization
    if (action === 'APPROVE') {
      authorization = await TransportSecurityService.approvePickupAuthorization(
        {
          tenantId: session.tenantId,
          branchId: session.branchId || undefined,
          actorId: session.uid,
          actorName: session.name,
          actorRole: session.role,
        },
        id,
        remarks
      )
    } else if (action === 'REJECT') {
      authorization = await TransportSecurityService.rejectPickupAuthorization(
        {
          tenantId: session.tenantId,
          branchId: session.branchId || undefined,
          actorId: session.uid,
          actorName: session.name,
          actorRole: session.role,
        },
        id,
        remarks
      )
    } else if (action === 'CANCEL') {
      authorization = await TransportSecurityService.cancelPickupAuthorization(
        {
          tenantId: session.tenantId,
          branchId: session.branchId || undefined,
          actorId: session.uid,
          actorName: session.name,
          actorRole: session.role,
        },
        id,
        remarks
      )
    }

    return ok({ authorization, message: `Authorization ${action.toLowerCase()}d successfully` })
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const PATCH = withApi(_PATCH)
