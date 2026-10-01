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
    const categoryId = searchParams.get('categoryId') || undefined
    const itemType = searchParams.get('itemType') as any || undefined
    const search = searchParams.get('search') || undefined
    const isActive = searchParams.get('isActive') !== null ? searchParams.get('isActive') === 'true' : undefined
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : undefined

    const result = await InventoryService.listItems(session.tenantId, {
      categoryId,
      itemType,
      search,
      isActive,
      page,
      pageSize,
    })

    return ok(result)
  } catch (err: any) {
    return bad(err.message, 'ITEMS_FETCH_FAILED')
  }
}

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'inventory:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const meta = getRequestMeta(req)

    const item = await InventoryService.createItem(
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

    return ok(item, undefined, 201)
  } catch (err: any) {
    return bad(err.message, 'ITEM_CREATE_FAILED')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
