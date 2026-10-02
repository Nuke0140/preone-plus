import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { getRequestMeta } from '@/lib/audit'
import { InventoryService } from '@/lib/inventory/inventory-service'

async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'inventory:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const { searchParams } = new URL(req.url)
    const branchId = searchParams.get('branchId') || undefined
    const search = searchParams.get('search') || undefined
    const type = searchParams.get('type') as any || undefined
    const isActive = searchParams.get('isActive') !== null ? searchParams.get('isActive') === 'true' : undefined

    const locations = await InventoryService.listLocations(session.tenantId, { branchId, search, type, isActive })
    return ok(locations)
  } catch (err: any) {
    return bad(err.message, 'LOCATIONS_FETCH_FAILED')
  }
}

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'inventory:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const meta = getRequestMeta(req)

    const location = await InventoryService.createLocation(
      session.tenantId,
      body,
      {
        id: session.uid,
        name: session.name,
        role: session.role,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      }
    )

    return ok(location, undefined, 201)
  } catch (err: any) {
    return bad(err.message, 'LOCATION_CREATE_FAILED')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
