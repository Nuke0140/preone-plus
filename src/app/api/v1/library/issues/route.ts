import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { getRequestMeta } from '@/lib/audit/audit-service'
import { LibraryService } from '@/lib/library/library-service'

async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'library:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const { searchParams } = new URL(req.url)
    await LibraryService.syncOverdue(session.tenantId)
    return ok(await LibraryService.listIssues(session.tenantId, {
      status: searchParams.get('status') || undefined,
      studentId: searchParams.get('studentId') || undefined,
      bookId: searchParams.get('bookId') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined,
    }))
  } catch (err: any) {
    return bad(err.message, 'ISSUES_FETCH_FAILED')
  }
}

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'library:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const body = await req.json()
    if (!body.bookId || !body.dueDate) return Errors.validation('bookId and dueDate are required')
    const meta = getRequestMeta(req)
    const issue = await LibraryService.issueBook(session.tenantId, body, {
      id: session.uid, name: session.name, role: session.role,
      ipAddress: meta.ipAddress, userAgent: meta.userAgent,
    })
    return ok(issue, undefined, 201)
  } catch (err: any) {
    return bad(err.message, 'BOOK_ISSUE_FAILED')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
