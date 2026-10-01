import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { LeadService } from '@/lib/admissions/lead-service'

/**
 * GET /api/v1/leads/:id/activity — Chronological unified activity timeline
 */
async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'admissions:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params

  try {
    const activity = await LeadService.getActivity(session.tenantId, id)
    return ok(activity)
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
