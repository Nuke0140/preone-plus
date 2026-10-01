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
    const status = searchParams.get('status') as any || undefined
    const classroomId = searchParams.get('classroomId') || undefined
    const requestedById = searchParams.get('requestedById') || undefined
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : undefined

    const result = await InventoryService.listMaterialRequests(session.tenantId, {
      branchId,
      status,
      classroomId,
      requestedById,
      page,
      pageSize,
    })

    return ok(result)
  } catch (err: any) {
    return bad(err.message, 'MATERIAL_REQUESTS_FETCH_FAILED')
  }
}

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'inventory:request')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const meta = getRequestMeta(req)

    const request = await InventoryService.createMaterialRequest(
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

    return ok(request, undefined, 201)
  } catch (err: any) {
    return bad(err.message, 'MATERIAL_REQUEST_CREATE_FAILED')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
