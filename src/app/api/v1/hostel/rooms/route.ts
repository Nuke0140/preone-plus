import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { HostelService } from '@/lib/hostel/hostel-service'

async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'hostel:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const { searchParams } = new URL(req.url)
    if (searchParams.get('meta') === 'dashboard') return ok(await HostelService.dashboard(session.tenantId))
    return ok(await HostelService.listRooms(session.tenantId, {
      branchId: searchParams.get('branchId') || undefined,
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
    }))
  } catch (err: any) {
    return bad(err.message, 'ROOMS_FETCH_FAILED')
  }
}

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'hostel:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const body = await req.json()
    if (!body.branchId || !body.roomNumber || !body.capacity) {
      return Errors.validation('branchId, roomNumber and capacity are required')
    }
    return ok(await HostelService.createRoom(session.tenantId, body), undefined, 201)
  } catch (err: any) {
    return bad(err.message, 'ROOM_CREATE_FAILED')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
