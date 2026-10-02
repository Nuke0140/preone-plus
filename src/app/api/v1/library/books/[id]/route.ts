import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { LibraryService } from '@/lib/library/library-service'

async function _PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApi(req, 'library:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params
  try {
    const body = await req.json()
    return ok(await LibraryService.updateBook(session.tenantId, id, body))
  } catch (err: any) {
    return bad(err.message, 'BOOK_UPDATE_FAILED')
  }
}

async function _DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApi(req, 'library:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params
  try {
    return ok(await LibraryService.softDeleteBook(session.tenantId, id))
  } catch (err: any) {
    return bad(err.message, 'BOOK_DELETE_FAILED')
  }
}

export const PATCH = withApi(_PATCH)
export const DELETE = withApi(_DELETE)
