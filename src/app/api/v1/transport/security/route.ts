import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportSecurityService } from '@/lib/transport/transport-security'

/**
 * GET /api/v1/transport/security — Fetch transport security events & audit logs
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'transport:read')
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
    return Errors.forbidden('Only school administrators are authorized to view security audit logs')
  }

  try {
    const { searchParams } = new URL(req.url)
    const eventType = searchParams.get('eventType') || undefined
    const studentId = searchParams.get('studentId') || undefined
    const driverId = searchParams.get('driverId') || undefined
    const limitStr = searchParams.get('limit') || '50'

    const logs = await TransportSecurityService.getSecurityLogs(
      {
        tenantId: session.tenantId,
        branchId: session.branchId || undefined,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      { eventType: eventType as any, studentId, driverId, limit: Number(limitStr) }
    )

    return ok(logs)
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
