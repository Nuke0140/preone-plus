import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { InventoryService } from '@/lib/inventory/inventory-service'

async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'inventory:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const { searchParams } = new URL(req.url)
    const branchId = searchParams.get('branchId') || session.branchId || undefined

    const metrics = await InventoryService.getDashboardMetrics(session.tenantId, branchId)
    return ok(metrics)
  } catch (err: any) {
    return bad(err.message, 'DASHBOARD_FETCH_FAILED')
  }
}

export const GET = withApi(_GET)
