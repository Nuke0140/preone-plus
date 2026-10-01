import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { LibraryService } from '@/lib/library/library-service'

/** POST { lost?: boolean, remarks?: string } — return a book (or mark lost) */
async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApi(req, 'library:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params
  try {
    let body: any = {}
    try { body = await req.json() } catch {}
    const result = await LibraryService.returnBook(session.tenantId, id, { lost: body.lost, remarks: body.remarks })
    return ok(result)
  } catch (err: any) {
    return bad(err.message, 'BOOK_RETURN_FAILED')
  }
}

export const POST = withApi(_POST)
