import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AdmissionService } from '@/lib/admissions/admission-service'

/**
 * POST /api/v1/applications/[id]/request-information
 * Request additional information from applicant, moving status to UNDER_REVIEW
 * and creating an operational follow-up task.
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

    if (!body.reason || !body.reason.trim()) {
      return Errors.validation('A reason is required to request more information')
    }

    const ctx = {
      tenantId: session.tenantId,
      branchId: body.branchId || session.branchId || '',
      academicYearId: body.academicYearId || '',
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    }

    const result = await AdmissionService.requestMoreInformation(ctx, id, {
      reason: body.reason.trim(),
      note: body.note || body.notes,
      dueAt: body.dueAt,
    })

    return ok(result)
  } catch (e: any) {
    return Errors.business('REQUEST_INFO_FAILED', e.message || 'Failed to request more information', 422)
  }
}

export const POST = withApi(_POST)
