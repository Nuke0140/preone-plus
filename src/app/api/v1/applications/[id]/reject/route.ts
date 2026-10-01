import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AdmissionService } from '@/lib/admissions/admission-service'

/**
 * POST /api/v1/applications/{id}/reject — Reject application with structured reason
 */
async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'admissions:approve')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params

  try {
    const body = await req.json().catch(() => ({}))
    const reason: string = body.reason || 'Did not meet admission criteria'
    const notes: string | undefined = body.notes

    const updated = await AdmissionService.rejectApplication(
      {
        tenantId: session.tenantId,
        branchId: session.branchId || '',
        academicYearId: '',
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      reason,
      notes
    )

    return ok(updated)
  } catch (e: any) {
    return Errors.business('REJECT_FAILED', e.message || 'Failed to reject application', 422)
  }
}

export const POST = withApi(_POST)
