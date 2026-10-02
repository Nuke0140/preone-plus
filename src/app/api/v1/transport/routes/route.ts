import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportService } from '@/lib/transport/transport-service'

import { TransportSecurityService } from '@/lib/transport/transport-security'

/**
 * GET /api/v1/transport/routes — List routes for tenant (Driver role scoped)
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'transport:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || undefined

    const context = {
      tenantId: session.tenantId,
      branchId: session.branchId || undefined,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    }

    const scope = await TransportSecurityService.getRoleScopingFilter(context)

    const routes = await TransportService.getRoutes(context, { status: status as any })

    // Scope driver view to assigned routes only
    const filtered = scope.isDriver && scope.allowedRouteIds !== null
      ? routes.filter((r: any) => scope.allowedRouteIds?.includes(r.id))
      : scope.isParent && scope.allowedStudentIds !== null
      ? routes.filter((r: any) => r.assignments?.some((a: any) => scope.allowedStudentIds?.includes(a.studentId)))
      : routes

    return ok(filtered)
  } catch (e: any) {
    return Errors.system(e)
  }
}

/**
 * POST /api/v1/transport/routes — Create a new transport route
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'transport:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json().catch(() => ({}))
    const { code, name, description, vehicleId, driverProfileId, attendantProfileId, stops, branchId } = body

    if (!code || typeof code !== 'string' || !code.trim()) {
      return Errors.validation('Route code is required')
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return Errors.validation('Route name is required')
    }

    const route = await TransportService.createRoute(
      {
        tenantId: session.tenantId,
        branchId: branchId || session.branchId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      {
        code: code.trim(),
        name: name.trim(),
        description,
        vehicleId,
        driverProfileId,
        attendantProfileId,
        stops,
      }
    )

    return ok({ route }, undefined, 201)
  } catch (e: any) {
    if (e.message?.includes('already exists')) {
      return Errors.conflict('ROUTE_EXISTS', e.message)
    }
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
