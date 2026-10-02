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
    return ok(await ExamsService.publishResults(session.tenantId, id))
  } catch (err: any) {
    return bad(err.message, 'PUBLISH_FAILED')
  }
}

export const GET = withApi(_GET)
