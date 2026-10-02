import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportService } from '@/lib/transport/transport-service'

/**
 * GET /api/v1/transport/trips/[id] — Get trip details and manifest
 */
async function _GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const session = await requireApi(req, 'transport:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const trip = await TransportService.getTripById(
      {
        tenantId: session.tenantId,
        branchId: session.branchId || undefined,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id
    )

    if (!trip) return Errors.notFound('Trip not found')
    return ok(trip)
  } catch (e: any) {
    return Errors.system(e)
  }
}

/**
 * PATCH /api/v1/transport/trips/[id] — Update trip status (e.g., mark arrival submitted, completed, etc.)
 */
async function _PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const session = await requireApi(req, 'transport:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json().catch(() => ({}))
    const { action, studentIds, notes } = body

    if (action === 'SUBMIT_ARRIVAL') {
      const trip = await TransportService.submitTripArrival(
        {
          tenantId: session.tenantId,
          branchId: session.branchId || undefined,
          actorId: session.uid,
          actorName: session.name,
          actorRole: session.role,
        },
        id,
        studentIds || []
      )
      return ok({ trip, message: 'Arrival submitted for verification' })
    }

    if (action === 'VERIFY_ARRIVAL') {
      const trip = await TransportService.verifyTripArrival(
        {
          tenantId: session.tenantId,
          branchId: session.branchId || undefined,
          actorId: session.uid,
          actorName: session.name,
          actorRole: session.role,
        },
        id,
        notes
      )
      return ok({ trip, message: 'Arrival verified by staff' })
    }

    if (action === 'COMPLETE_TRIP') {
      const trip = await TransportService.completeTrip(
        {
          tenantId: session.tenantId,
          branchId: session.branchId || undefined,
          actorId: session.uid,
          actorName: session.name,
          actorRole: session.role,
        },
        id
      )
      return ok({ trip, message: 'Trip completed successfully' })
    }

    return Errors.validation('Invalid action. Use SUBMIT_ARRIVAL, VERIFY_ARRIVAL, or COMPLETE_TRIP')
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const PATCH = withApi(_PATCH)
