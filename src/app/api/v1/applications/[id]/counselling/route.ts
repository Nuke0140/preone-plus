import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AdmissionService } from '@/lib/admissions/admission-service'

/**
 * POST /api/v1/applications/[id]/counselling — Record or schedule a counselling session
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
    const body = await req.json()
    const { scheduledAt, counselorName, mode, notes, outcome, branchId, academicYearId } = body

    if (!scheduledAt) {
      return Errors.validation('Session date and time are required')
    }

    const res = await AdmissionService.recordCounselling(
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
        scheduledAt,
        counselorName,
        mode,
        notes,
        outcome,
      }
    )

    return ok(res, undefined, 201)
  } catch (e: any) {
    return Errors.business('COUNSELLING_FAILED', e.message || 'Failed to record counselling session', 422)
  }
}

export const POST = withApi(_POST)
