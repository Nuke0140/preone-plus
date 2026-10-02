import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { HomeworkService } from '@/lib/homework/homework-service'

type Params = { params: Promise<{ id: string }> }

async function _GET(req: NextRequest, { params }: Params) {
  const session = await requireApi(req, 'homework:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const { id } = await params
    const homework = await HomeworkService.get(session.tenantId, id)
    if (!homework) return Errors.notFound('Homework not found')
    return ok(homework)
  } catch (err: any) {
    return bad(err.message, 'HOMEWORK_FETCH_FAILED')
  }
}

async function _PATCH(req: NextRequest, { params }: Params) {
  const session = await requireApi(req, 'homework:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const { id } = await params
    const body = await req.json()
    const homework = await HomeworkService.update(session.tenantId, id, body)
    return ok(homework)
  } catch (err: any) {
    return bad(err.message, 'HOMEWORK_UPDATE_FAILED')
  }
}

async function _DELETE(req: NextRequest, { params }: Params) {
  const session = await requireApi(req, 'homework:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const { id } = await params
    const homework = await HomeworkService.softDelete(session.tenantId, id)
    return ok(homework)
  } catch (err: any) {
    return bad(err.message, 'HOMEWORK_DELETE_FAILED')
  }
}

export const GET = withApi(_GET)
export const PATCH = withApi(_PATCH)
export const DELETE = withApi(_DELETE)
