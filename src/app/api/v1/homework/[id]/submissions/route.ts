import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { getRequestMeta } from '@/lib/audit/audit-service'
import { HomeworkService } from '@/lib/homework/homework-service'

type Params = { params: Promise<{ id: string }> }

/** GET /api/v1/homework/[id]/submissions — list all submissions for a homework */
async function _GET(req: NextRequest, { params }: Params) {
  const session = await requireApi(req, 'homework:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const { id } = await params
    const submissions = await HomeworkService.listSubmissions(session.tenantId, id)
    return ok(submissions)
  } catch (err: any) {
    return bad(err.message, 'SUBMISSIONS_FETCH_FAILED')
  }
}

/** POST /api/v1/homework/[id]/submissions — submit (student/parent) or grade (teacher) */
async function _POST(req: NextRequest, { params }: Params) {
  const session = await requireApi(req, 'homework:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const { id } = await params
    const body = await req.json()
    const meta = getRequestMeta(req)
    const actor = { id: session.uid, name: session.name, role: session.role, ipAddress: meta.ipAddress, userAgent: meta.userAgent }
    if (body.action === 'grade') {
      const canGrade = await requireApi(req, 'homework:write')
      if (isResponse(canGrade)) return canGrade
      if (!body.studentId) return Errors.validation('studentId is required')
      const graded = await HomeworkService.grade(session.tenantId, id, body.studentId, body, actor)
      return ok(graded)
    }
    if (!body.studentId) return Errors.validation('studentId is required')
    const submitted = await HomeworkService.submit(
      session.tenantId, id, body.studentId,
      { remarks: body.remarks, contentUrl: body.contentUrl },
      actor,
    )
    return ok(submitted)
  } catch (err: any) {
    return bad(err.message, 'SUBMISSION_ACTION_FAILED')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
