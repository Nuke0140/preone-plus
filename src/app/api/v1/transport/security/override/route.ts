import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportSecurityService } from '@/lib/transport/transport-security'

/**
 * POST /api/v1/transport/security/override — Record manual security override
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'transport:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const context = {
    tenantId: session.tenantId,
    branchId: session.branchId || undefined,
    actorId: session.uid,
    actorName: session.name,
    actorRole: session.role,
  }

  const scope = await TransportSecurityService.getRoleScopingFilter(context)
  if (!scope.isAdmin) {
    return Errors.forbidden('Only school administrators are authorized to execute manual security overrides')
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { studentId, action, reason } = body

    if (!studentId || !action || !reason || !reason.trim()) {
      return Errors.validation('studentId, action, and detailed reason are required for manual override')
    }

    const event = await TransportSecurityService.recordManualOverride(
      {
        tenantId: session.tenantId,
        branchId: session.branchId || undefined,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      {
        studentId,
        action,
        reason: reason.trim(),
      }
    )

    return ok({ event, message: 'Manual override logged and approved' }, undefined, 201)
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const POST = withApi(_POST)
