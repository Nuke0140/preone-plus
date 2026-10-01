import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportService } from '@/lib/transport/transport-service'

/**
 * GET /api/v1/transport/dashboard â€” Real-time transport KPIs and active operations
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'transport:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('Tenant context required')

  try {
    const data = await TransportService.getDashboardMetrics({
      tenantId: session.tenantId,
      branchId: session.branchId,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    })
    return ok(data)
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
