import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { getRequestMeta } from '@/lib/audit'
import { InventoryService } from '@/lib/inventory/inventory-service'

async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'inventory:approve')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const meta = getRequestMeta(req)

    const cancelled = await InventoryService.cancelPurchaseOrder(
      session.tenantId,
      id,
      body.reason || 'Cancelled by admin',
      {
        id: session.uid,
        name: session.name,
        role: session.role,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      }
    )

    return ok(cancelled)
  } catch (err: any) {
    return bad(err.message, 'PURCHASE_ORDER_CANCEL_FAILED')
  }
}

export const POST = withApi(_POST)
