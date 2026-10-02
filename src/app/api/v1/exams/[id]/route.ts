import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { ExamsService } from '@/lib/exams/exam-service'

async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApi(req, 'exams:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params
  try {
    return ok(await ExamsService.get(session.tenantId, id))
  } catch (err: any) {
    return bad(err.message, 'EXAM_FETCH_FAILED')
  }
}

async function _PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApi(req, 'exams:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params
  try {
    const body = await req.json()
    return ok(await ExamsService.update(session.tenantId, id, body))
  } catch (err: any) {
    return bad(err.message, 'EXAM_UPDATE_FAILED')
  }
}

async function _DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApi(req, 'exams:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params
  try {
    return ok(await ExamsService.softDelete(session.tenantId, id))
  } catch (err: any) {
    return bad(err.message, 'EXAM_DELETE_FAILED')
  }
}

export const GET = withApi(_GET)
export const PATCH = withApi(_PATCH)
export const DELETE = withApi(_DELETE)
