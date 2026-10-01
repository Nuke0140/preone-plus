import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportService } from '@/lib/transport/transport-service'

import { TransportSecurityService } from '@/lib/transport/transport-security'

/**
 * GET /api/v1/transport/trips — List daily transport trips with role scoping
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'transport:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const { searchParams } = new URL(req.url)
    let routeId = searchParams.get('routeId') || undefined
    const driverId = searchParams.get('driverId') || undefined
    const status = searchParams.get('status') || undefined
    const dateStr = searchParams.get('date') || undefined

    const date = dateStr ? new Date(dateStr) : undefined

    const context = {
      tenantId: session.tenantId,
      branchId: session.branchId || undefined,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    }

    const scope = await TransportSecurityService.getRoleScopingFilter(context)

    if (scope.isDriver) {
      if (routeId) {
        if (!scope.allowedRouteIds?.includes(routeId)) {
          return Errors.forbidden('Unauthorized access to unassigned transport route trips')
        }
      } else if (scope.allowedRouteIds && scope.allowedRouteIds.length === 0) {
        return ok([])
      }
    }

    const trips = await TransportService.getTrips(context, { routeId, driverId, status: status as any, date })

    const filtered = scope.isDriver && scope.allowedRouteIds !== null
      ? trips.filter((t: any) => scope.allowedRouteIds?.includes(t.routeId))
      : scope.isParent && scope.allowedStudentIds !== null
      ? trips.filter((t: any) => t.manifest?.some((m: any) => scope.allowedStudentIds?.includes(m.studentId)))
      : trips

    return ok(filtered)
  } catch (e: any) {
    return Errors.system(e)
  }
}

/**
 * POST /api/v1/transport/trips — Start/Create a trip (Pickup or Drop)
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'transport:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json().catch(() => ({}))
    const { routeId, vehicleId, driverId, tripType, date } = body

    if (!routeId || !tripType) {
      return Errors.validation('routeId and tripType (PICKUP/DROP) are required')
    }

    const context = {
      tenantId: session.tenantId,
      branchId: session.branchId || undefined,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    }

    const scope = await TransportSecurityService.getRoleScopingFilter(context)

    if (scope.isDriver && scope.allowedRouteIds !== null && !scope.allowedRouteIds.includes(routeId)) {
      return Errors.forbidden('Drivers are not permitted to start trips for unassigned routes')
    }

    const trip = await TransportService.startTrip(context, {
      routeId,
      vehicleId,
      driverId: driverId || session.uid,
      tripType,
      date: date ? new Date(date) : new Date(),
    } as any)

    return ok({ trip }, undefined, 201)
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
