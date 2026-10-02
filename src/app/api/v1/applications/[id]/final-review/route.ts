import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AdmissionService } from '@/lib/admissions/admission-service'

/**
 * POST /api/v1/applications/[id]/final-review
 * Boundary gate for the Application module.
 * Final Staff Review before handoff to Waiting List & Classroom Allocation.
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

    const ctx = {
      tenantId: session.tenantId,
      branchId: body.branchId || session.branchId || '',
      academicYearId: body.academicYearId || '',
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    }

    const result = await AdmissionService.finalStaffReview(ctx, id, body.notes)
    return ok(result)
  } catch (e: any) {
    return Errors.business('FINAL_REVIEW_FAILED', e.message || 'Staff final review failed', 422)
  }
}

export const POST = withApi(_POST)
