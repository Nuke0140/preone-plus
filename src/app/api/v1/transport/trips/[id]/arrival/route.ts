import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportService } from '@/lib/transport/transport-service'

/**
 * POST /api/v1/transport/trips/:id/arrival — Driver Submit Bus Arrival
 */
async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params
  const session = await requireApi(req, 'transport:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json().catch(() => ({}))
    const { studentIds } = body

    if (!Array.isArray(studentIds)) {
      return Errors.validation('studentIds array is required')
    }

    const context = {
      tenantId: session.tenantId,
      branchId: session.branchId || undefined,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    }

    const updatedTrip = await TransportService.submitTripArrival(context, tripId, studentIds)
    return ok(updatedTrip)
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const POST = withApi(_POST)
