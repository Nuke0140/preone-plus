import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { getRequestMeta } from '@/lib/audit/audit-service'
import { ExamsService } from '@/lib/exams/exam-service'

async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'exams:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const { searchParams } = new URL(req.url)
    const exams = await ExamsService.list(session.tenantId, {
      status: searchParams.get('status') || undefined,
      academicSessionId: searchParams.get('academicSessionId') || undefined,
      search: searchParams.get('search') || undefined,
    })
    return ok(exams)
  } catch (err: any) {
    return bad(err.message, 'EXAMS_FETCH_FAILED')
  }
}

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'exams:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const body = await req.json()
    if (!body.name || !body.code || !body.startDate || !body.endDate || !body.academicSessionId) {
      return Errors.validation('name, code, startDate, endDate and academicSessionId are required')
    }
    const meta = getRequestMeta(req)
    const exam = await ExamsService.create(session.tenantId, body, {
      id: session.uid, name: session.name, role: session.role,
      ipAddress: meta.ipAddress, userAgent: meta.userAgent,
    })
    return ok(exam, undefined, 201)
  } catch (err: any) {
    return bad(err.message, 'EXAM_CREATE_FAILED')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
