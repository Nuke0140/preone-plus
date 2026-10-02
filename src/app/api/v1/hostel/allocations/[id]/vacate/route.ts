import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { HostelService } from '@/lib/hostel/hostel-service'

/** POST — vacate a student from a room */
async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApi(req, 'hostel:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params
  try {
    let body: any = {}
    try { body = await req.json() } catch {}
    return ok(await HostelService.vacate(session.tenantId, id, { notes: body.notes }))
  } catch (err: any) {
    return bad(err.message, 'VACATE_FAILED')
  }
}

export const POST = withApi(_POST)
