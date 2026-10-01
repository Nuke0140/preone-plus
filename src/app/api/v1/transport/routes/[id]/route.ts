import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportService } from '@/lib/transport/transport-service'

import { TransportSecurityService } from '@/lib/transport/transport-security'

/**
 * GET /api/v1/transport/routes/[id] — Get single route details with role authorization
 */
async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApi(req, 'transport:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params

  try {
    const context = {
      tenantId: session.tenantId,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    }

    const scope = await TransportSecurityService.getRoleScopingFilter(context)

    if (scope.isDriver && scope.allowedRouteIds !== null && !scope.allowedRouteIds.includes(id)) {
      return Errors.forbidden('Unauthorized access to unassigned route')
    }

    const route = await TransportService.getRoute(context, id)

    if (!route) return Errors.notFound('Route not found')
    return ok(route)
  } catch (e: any) {
    return Errors.system(e)
  }
}

/**
 * PATCH /api/v1/transport/routes/[id] — Update route details & stop order
 */
async function _PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApi(req, 'transport:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params

  try {
    const body = await req.json().catch(() => ({}))
    const updated = await TransportService.updateRoute(
      {
        tenantId: session.tenantId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      body
    )

    return ok({ route: updated })
  } catch (e: any) {
    if (e.message?.includes('not found')) return Errors.notFound(e.message)
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const PATCH = withApi(_PATCH)
