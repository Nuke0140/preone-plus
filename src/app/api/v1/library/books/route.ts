import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { LibraryService } from '@/lib/library/library-service'

async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'library:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const { searchParams } = new URL(req.url)
    if (searchParams.get('meta') === 'dashboard') return ok(await LibraryService.dashboard(session.tenantId))
    if (searchParams.get('meta') === 'categories') return ok(await LibraryService.listCategories(session.tenantId))
    await LibraryService.syncOverdue(session.tenantId)
    const result = await LibraryService.listBooks(session.tenantId, {
      category: searchParams.get('category') || undefined,
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined,
      pageSize: searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : undefined,
    })
    return ok(result)
  } catch (err: any) {
    return bad(err.message, 'BOOKS_FETCH_FAILED')
  }
}

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'library:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const body = await req.json()
    if (!body.title) return Errors.validation('Book title is required')
    const book = await LibraryService.createBook(session.tenantId, body)
    return ok(book, undefined, 201)
  } catch (err: any) {
    return bad(err.message, 'BOOK_CREATE_FAILED')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
