import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportService } from '@/lib/transport/transport-service'

/**
 * GET /api/v1/transport/vehicles/[id] — Get vehicle details
 */
async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApi(req, 'transport:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params

  try {
    const vehicle = await TransportService.getVehicle(
      {
        tenantId: session.tenantId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id
    )

    if (!vehicle) return Errors.notFound('Vehicle not found')
    return ok(vehicle)
  } catch (e: any) {
    return Errors.system(e)
  }
}

/**
 * PATCH /api/v1/transport/vehicles/[id] — Update vehicle
 */
async function _PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApi(req, 'transport:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params

  try {
    const body = await req.json().catch(() => ({}))
    const updated = await TransportService.updateVehicle(
      {
        tenantId: session.tenantId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      body
    )

    return ok({ vehicle: updated })
  } catch (e: any) {
    if (e.message?.includes('not found')) return Errors.notFound(e.message)
    return Errors.system(e)
  }
}

/**
 * DELETE /api/v1/transport/vehicles/[id] — Deactivate/delete vehicle
 */
async function _DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApi(req, 'transport:admin')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params

  try {
    const deleted = await TransportService.updateVehicle(
      {
        tenantId: session.tenantId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      { status: 'DECOMMISSIONED' } as any
    )

    return ok({ success: true, vehicle: deleted })
  } catch (e: any) {
    if (e.message?.includes('not found')) return Errors.notFound(e.message)
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const PATCH = withApi(_PATCH)
export const DELETE = withApi(_DELETE)
