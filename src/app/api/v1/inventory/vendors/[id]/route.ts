import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { getRequestMeta } from '@/lib/audit'
import { InventoryService } from '@/lib/inventory/inventory-service'

async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'inventory:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const { id } = await params
    const vendor = await InventoryService.getVendorDetail(session.tenantId, id)
    if (!vendor) return Errors.notFound('Vendor not found')
    return ok(vendor)
  } catch (err: any) {
    return bad(err.message, 'VENDOR_FETCH_FAILED')
  }
}

async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'inventory:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const { id } = await params
    const body = await req.json()
    const meta = getRequestMeta(req)

    const updated = await InventoryService.updateVendor(
      session.tenantId,
      id,
      body,
      {
        id: session.uid,
        name: session.name,
        role: session.role,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      }
    )

    return ok(updated)
  } catch (err: any) {
    return bad(err.message, 'VENDOR_UPDATE_FAILED')
  }
}

export const GET = withApi(_GET)
export const PATCH = withApi(_PATCH)
