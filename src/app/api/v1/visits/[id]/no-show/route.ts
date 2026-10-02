import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AdmissionService } from '@/lib/admissions/admission-service'

/**
 * POST /api/v1/visits/[id]/no-show — Record school visit no-show and schedule recovery follow-up
 */
async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'admissions:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params

  try {
    const body = await req.json().catch(() => ({}))
    const { notes, recoveryCallDueAt, branchId, academicYearId } = body

    const result = await AdmissionService.recordVisitNoShow(
      {
        tenantId: session.tenantId,
        branchId: branchId || session.branchId || '',
        academicYearId: academicYearId || '',
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      {
        notes,
        recoveryCallDueAt,
      }
    )

    return ok(result)
  } catch (e: any) {
    return Errors.business('VISIT_NO_SHOW_FAILED', e.message || 'Failed to record no-show', 422)
  }
}

export const POST = withApi(_POST)
