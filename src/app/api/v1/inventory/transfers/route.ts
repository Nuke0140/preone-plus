import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { getRequestMeta } from '@/lib/audit'
import { InventoryService } from '@/lib/inventory/inventory-service'

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'inventory:issue')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const meta = getRequestMeta(req)

    const transfer = await InventoryService.transferStock(
      session.tenantId,
      {
        ...body,
        fromBranchId: body.fromBranchId || session.branchId,
        toBranchId: body.toBranchId || session.branchId,
      },
      {
        id: session.uid,
        name: session.name,
        role: session.role,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      }
    )

    return ok(transfer, undefined, 201)
  } catch (err: any) {
    return bad(err.message, 'STOCK_TRANSFER_FAILED')
  }
}

export const POST = withApi(_POST)
