import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AdmissionService } from '@/lib/admissions/admission-service'

/**
 * POST /api/v1/applications/[id]/offer/accept — Parent Offer Acceptance or Decline
 * Body: { action?: 'ACCEPT' | 'DECLINE', acceptNote?: string, declineReason?: string, branchId?: string, academicYearId?: string }
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
    const action = body.action || 'ACCEPT'

    const ctx = {
      tenantId: session.tenantId,
      branchId: body.branchId || session.branchId || '',
      academicYearId: body.academicYearId || '',
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    }

    if (action === 'DECLINE') {
      if (!body.declineReason?.trim()) {
        return Errors.validation('A reason is required to decline the offer')
      }
      const res = await AdmissionService.declineOffer(ctx, id, body.declineReason.trim())
      return ok(res)
    }

    const res = await AdmissionService.acceptOffer(ctx, id, body.acceptNote)
    return ok(res)
  } catch (e: any) {
    return Errors.business('OFFER_ACTION_FAILED', e.message || 'Failed to process offer decision', 422)
  }
}

export const POST = withApi(_POST)
