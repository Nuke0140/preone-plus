import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportService } from '@/lib/transport/transport-service'

/**
 * GET /api/v1/transport/vehicles — List all vehicles for tenant
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'transport:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || undefined
    const branchId = searchParams.get('branchId') || session.branchId || undefined

    const vehicles = await TransportService.getVehicles({
      tenantId: session.tenantId,
      branchId,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    }, { status: status as any })

    return ok(vehicles)
  } catch (e: any) {
    return Errors.system(e)
  }
}

/**
 * POST /api/v1/transport/vehicles — Create a new vehicle
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'transport:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json().catch(() => ({}))
    const { registrationNumber, vehicleType, capacity, makeModel, notes, branchId } = body

    if (!registrationNumber || typeof registrationNumber !== 'string' || !registrationNumber.trim()) {
      return Errors.validation('Registration number is required')
    }
    if (!capacity || Number(capacity) <= 0) {
      return Errors.validation('Vehicle capacity must be greater than 0')
    }

    const vehicle = await TransportService.createVehicle(
      {
        tenantId: session.tenantId,
        branchId: branchId || session.branchId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      {
        registrationNumber: registrationNumber.trim(),
        vehicleType: vehicleType || 'BUS',
        capacity: Number(capacity),
        makeModel,
        notes,
      }
    )

    return ok({ vehicle }, undefined, 201)
  } catch (e: any) {
    if (e.message?.includes('already exists')) {
      return Errors.conflict('VEHICLE_EXISTS', e.message)
    }
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
