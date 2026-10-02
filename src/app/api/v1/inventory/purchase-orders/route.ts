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
    const branchId = searchParams.get('branchId') || session.branchId || undefined
    const vendorId = searchParams.get('vendorId') || undefined
    const status = searchParams.get('status') as any || undefined
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : undefined

    const result = await InventoryService.listPurchaseOrders(session.tenantId, {
      branchId,
      vendorId,
      status,
      page,
      pageSize,
    })

    return ok(result)
  } catch (err: any) {
    return bad(err.message, 'PURCHASE_ORDERS_FETCH_FAILED')
  }
}

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'inventory:order')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const meta = getRequestMeta(req)

    const order = await InventoryService.createPurchaseOrder(
      session.tenantId,
      {
        ...body,
        branchId: body.branchId || session.branchId,
      },
      {
        id: session.uid,
        name: session.name,
        role: session.role,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      }
    )

    return ok(order, undefined, 201)
  } catch (err: any) {
    return bad(err.message, 'PURCHASE_ORDER_CREATE_FAILED')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
