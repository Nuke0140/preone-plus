import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { getRequestMeta } from '@/lib/audit/audit-service'
import { ExamsService } from '@/lib/exams/exam-service'

/** GET — marks entry grid (roster + existing marks) */
async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApi(req, 'exams:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params
  try {
    return ok(await ExamsService.getMarkSheet(session.tenantId, id))
  } catch (err: any) {
    return bad(err.message, 'MARKSHEET_FETCH_FAILED')
  }
}

/** POST — bulk save marks */
async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApi(req, 'exams:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params
  try {
    const body = await req.json()
    if (!Array.isArray(body.entries)) return Errors.validation('entries array is required')
    const meta = getRequestMeta(req)
    const result = await ExamsService.saveMarks(
      session.tenantId, id, body.entries,
      { id: session.uid, name: session.name, role: session.role, ipAddress: meta.ipAddress, userAgent: meta.userAgent },
    )
    return ok(result)
  } catch (err: any) {
    return bad(err.message, 'MARKS_SAVE_FAILED')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
