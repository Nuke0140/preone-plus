import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AdmissionService } from '@/lib/admissions/admission-service'

/**
 * GET /api/v1/visits — Query follow-ups & visits workspace queues with metric counters
 * Query params: branchId, queue (DUE_TODAY | OVERDUE | UPCOMING | COMPLETED), limit
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'admissions:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const url = new URL(req.url)
  const branchId = url.searchParams.get('branchId') || session.branchId || undefined
  const queue = (url.searchParams.get('queue') as any) || 'DUE_TODAY'
  const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined

  try {
    const data = await AdmissionService.listFollowUpWorkspace(session.tenantId, {
      branchId,
      queue,
      limit,
    })
    return ok(data)
  } catch (e: any) {
    return Errors.internal(e.message || 'Failed to list workspace items')
  }
}

export const GET = withApi(_GET)
