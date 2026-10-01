import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors, bad } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportService } from '@/lib/transport/transport-service'

/**
 * POST /api/v1/transport/trips/[id]/substitute-vehicle — In-flight vehicle substitution
 */
async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApi(req, 'transport:trip')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('Tenant context required')

  const { id } = await params
  try {
    const body = await req.json()
    const { vehicleId, reason } = body

    if (!vehicleId) {
      return bad('vehicleId is required for vehicle substitution')
    }

    const updated = await TransportService.replaceTripVehicle(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      vehicleId,
      reason
    )

    return ok(updated)
  } catch (e: any) {
    return bad(e.message)
  }
}

export const POST = withApi(_POST)
