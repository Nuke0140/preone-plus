import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { getRequestMeta } from '@/lib/audit/audit-service'
import { HostelService } from '@/lib/hostel/hostel-service'

async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'hostel:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const { searchParams } = new URL(req.url)
    return ok(await HostelService.listAllocations(session.tenantId, {
      roomId: searchParams.get('roomId') || undefined,
      status: searchParams.get('status') || undefined,
    }))
  } catch (err: any) {
    return bad(err.message, 'ALLOCATIONS_FETCH_FAILED')
  }
}

/** POST — allocate student to room with atomic capacity guard */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'hostel:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const body = await req.json()
    if (!body.roomId || !body.studentId) return Errors.validation('roomId and studentId are required')
    const meta = getRequestMeta(req)
    const allocation = await HostelService.allocate(session.tenantId, body, {
      id: session.uid, name: session.name, role: session.role,
      ipAddress: meta.ipAddress, userAgent: meta.userAgent,
    })
    return ok(allocation, undefined, 201)
  } catch (err: any) {
    return bad(err.message, 'ALLOCATION_FAILED')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
