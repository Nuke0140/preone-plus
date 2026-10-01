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
    const itemId = searchParams.get('itemId') || undefined
    const movementType = searchParams.get('movementType') as any || undefined
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 100

    const movements = await db.stockMovement.findMany({
      where: {
        tenantId: session.tenantId,
        ...(branchId ? { branchId } : {}),
        ...(itemId ? { itemId } : {}),
        ...(movementType ? { movementType } : {}),
      },
      include: {
        item: { select: { id: true, sku: true, name: true, unit: { select: { symbol: true } } } },
        location: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const mapped = movements.map((m) => ({
      ...m,
      item: m.item ? { ...m.item, code: m.item.sku } : null,
    }))

    return ok(mapped)
  } catch (err: any) {
    return bad(err.message, 'MOVEMENTS_FETCH_FAILED')
  }
}

export const GET = withApi(_GET)
