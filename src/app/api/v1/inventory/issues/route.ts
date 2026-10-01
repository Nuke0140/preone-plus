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
    const destinationType = searchParams.get('destinationType') as any || undefined
    const classroomId = searchParams.get('classroomId') || undefined
    const materialRequestId = searchParams.get('materialRequestId') || undefined
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : undefined

    const result = await InventoryService.listStockIssues(session.tenantId, {
      branchId,
      destinationType,
      classroomId,
      materialRequestId,
      page,
      pageSize,
    })

    return ok(result)
  } catch (err: any) {
    return bad(err.message, 'STOCK_ISSUES_FETCH_FAILED')
  }
}

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'inventory:issue')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const meta = getRequestMeta(req)

    const issue = await InventoryService.issueStock(
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

    return ok(issue, undefined, 201)
  } catch (err: any) {
    return bad(err.message, 'STOCK_ISSUE_FAILED')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
