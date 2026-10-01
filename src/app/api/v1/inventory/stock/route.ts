import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { db } from '@/lib/db'

async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'inventory:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const { searchParams } = new URL(req.url)
    const branchId = searchParams.get('branchId') || session.branchId || undefined
    const locationId = searchParams.get('locationId') || undefined
    const itemId = searchParams.get('itemId') || undefined

    const stocks = await db.inventoryStock.findMany({
      where: {
        tenantId: session.tenantId,
        ...(branchId ? { branchId } : {}),
        ...(locationId ? { locationId } : {}),
        ...(itemId ? { itemId } : {}),
      },
      include: {
        item: {
          select: {
            id: true,
            sku: true,
            name: true,
            itemType: true,
            unit: { select: { code: true, symbol: true } },
            category: { select: { name: true } },
            reorderLevel: true,
          },
        },
        location: {
          select: { id: true, name: true, code: true, type: true },
        },
        branch: { select: { id: true, name: true } },
      },
      orderBy: [{ item: { name: 'asc' } }, { location: { name: 'asc' } }],
    })

    const mapped = stocks.map((s) => ({
      ...s,
      item: s.item ? { ...s.item, code: s.item.sku } : null,
    }))

    return ok(mapped)
  } catch (err: any) {
    return bad(err.message, 'STOCK_FETCH_FAILED')
  }
}

export const GET = withApi(_GET)
