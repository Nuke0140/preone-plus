import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { requireApi, isResponse } from '@/lib/auth-api'
import { ok, bad, serverError } from '@/lib/api'
import { enqueueJob, listJobs, JobType } from '@/lib/jobs'

async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'finance:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return bad('Tenant required', 'TENANT_REQUIRED')

  try {
    const jobs = await listJobs(session.tenantId, 25)
    return ok(jobs)
  } catch (err: any) {
    return serverError(err.message)
  }
}

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'finance:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return bad('Tenant required', 'TENANT_REQUIRED')

  try {
    const body = await req.json()
    const { jobType, payload } = body

    if (!jobType || !['BULK_INVOICE', 'BULK_RECEIPT', 'PAYMENT_EXPORT', 'DATA_EXPORT'].includes(jobType)) {
      return bad('Invalid jobType', 'INVALID_JOB_TYPE')
    }

    const job = await enqueueJob({
      tenantId: session.tenantId,
      jobType: jobType as JobType,
      payload,
      createdById: session.uid,
    })

    return ok(job, undefined, 202)
  } catch (err: any) {
    return serverError(err.message)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
