import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { requireApi, isResponse } from '@/lib/auth-api'
import { ok, notFound, bad, serverError } from '@/lib/api'
import { getJob } from '@/lib/jobs'

async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireApi(req, 'finance:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return bad('Tenant required', 'TENANT_REQUIRED')

  try {
    const job = await getJob(id, session.tenantId)
    if (!job) return notFound('Job not found')
    return ok(job)
  } catch (err: any) {
    return serverError(err.message)
  }
}

export const GET = withApi(_GET)
