import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { HostelService } from '@/lib/hostel/hostel-service'

async function _PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApi(req, 'hostel:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params
  try {
    const body = await req.json()
    return ok(await HostelService.updateRoom(session.tenantId, id, body))
  } catch (err: any) {
    return bad(err.message, 'ROOM_UPDATE_FAILED')
  }
}

async function _DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApi(req, 'hostel:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params
  try {
    return ok(await HostelService.softDeleteRoom(session.tenantId, id))
  } catch (err: any) {
    return bad(err.message, 'ROOM_DELETE_FAILED')
  }
}

export const PATCH = withApi(_PATCH)
export const DELETE = withApi(_DELETE)
