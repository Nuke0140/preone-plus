import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportService } from '@/lib/transport/transport-service'

/**
 * GET /api/v1/transport/stops?routeId=... — List stops for a route
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'transport:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const { searchParams } = new URL(req.url)
    const routeId = searchParams.get('routeId')
    if (!routeId) {
      return Errors.validation('routeId parameter is required')
    }

    const stops = await TransportService.getStopsForRoute(
      {
        tenantId: session.tenantId,
        branchId: session.branchId || undefined,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      routeId
    )

    return ok(stops)
  } catch (e: any) {
    return Errors.system(e)
  }
}

/**
 * POST /api/v1/transport/stops — Add a stop to a route
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'transport:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json().catch(() => ({}))
    const { routeId, name, stopOrder, pickupTime, dropTime, landmark, address } = body

    if (!routeId || !name || stopOrder === undefined) {
      return Errors.validation('routeId, name, and stopOrder are required')
    }

    const stop = await TransportService.addStopToRoute(
      {
        tenantId: session.tenantId,
        branchId: session.branchId || undefined,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      {
        routeId,
        name: name.trim(),
        stopOrder: Number(stopOrder),
        pickupTime,
        dropTime,
        landmark,
        address,
      }
    )

    return ok({ stop }, undefined, 201)
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
