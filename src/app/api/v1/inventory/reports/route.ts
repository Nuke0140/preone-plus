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
    const type = searchParams.get('type') || 'summary'
    const branchId = searchParams.get('branchId') || session.branchId || undefined

    if (type === 'low-stock') {
      const data = await InventoryService.getLowStockItems(session.tenantId, branchId)
      return ok(data)
    }

    if (type === 'expiring') {
      const days = searchParams.get('days') ? parseInt(searchParams.get('days')!, 10) : undefined
      const data = await InventoryService.getExpiringStock(session.tenantId, branchId, days)
      return ok(data)
    }

    if (type === 'consumption') {
      const fromDate = searchParams.get('fromDate') ? new Date(searchParams.get('fromDate')!) : undefined
      const toDate = searchParams.get('toDate') ? new Date(searchParams.get('toDate')!) : undefined
      const classroomId = searchParams.get('classroomId') || undefined
      const categoryId = searchParams.get('categoryId') || undefined

      const data = await InventoryService.getConsumptionAnalytics(session.tenantId, {
        branchId,
        fromDate,
        toDate,
        classroomId,
        categoryId,
      })
      return ok(data)
    }

    if (type === 'reconciliation') {
      const data = await InventoryService.getFinanceReconciliation(session.tenantId, branchId)
      return ok(data)
    }

    const summary = await InventoryService.getDashboardMetrics(session.tenantId, branchId)
    return ok(summary)
  } catch (err: any) {
    return bad(err.message, 'REPORTS_FETCH_FAILED')
  }
}

export const GET = withApi(_GET)
