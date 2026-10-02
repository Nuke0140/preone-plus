import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AdmissionService } from '@/lib/admissions/admission-service'

/**
 * GET /api/v1/visits/[id] — Retrieve detailed visit record with lead, child info, and past interactions
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
    const data = await AdmissionService.getVisitDetails(session.tenantId, id)
    return ok(data)
  } catch (e: any) {
    return Errors.notFound(e.message || 'Visit not found')
  }
}

export const GET = withApi(_GET)
