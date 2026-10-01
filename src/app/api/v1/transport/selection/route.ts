import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportService } from '@/lib/transport/transport-service'

/**
 * POST /api/v1/transport/selection — Parent Route Selection Request
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'transport:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json().catch(() => ({}))
    const { studentId, routeId, pickupStopId, dropStopId, tripType } = body

    if (!studentId || !routeId || !pickupStopId || !dropStopId) {
      return Errors.validation('studentId, routeId, pickupStopId, and dropStopId are required')
    }

    const context = {
      tenantId: session.tenantId,
      branchId: session.branchId || undefined,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    }

    const assignment = await TransportService.createParentRouteSelection(context, {
      studentId,
      routeId,
      pickupStopId,
      dropStopId,
      tripType,
    })

    return ok(assignment)
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const POST = withApi(_POST)
