import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { WaitingListService } from '@/lib/admissions/waiting-list-service'

/**
 * POST /api/v1/admissions/waitlist/[id]/offer
 * Issue a formal admission seat offer for the waiting list candidate.
 */
async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'admissions:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  try {
    const result = await WaitingListService.createSeatOffer(
      {
        tenantId: session.tenantId,
        branchId: session.branchId || '',
        academicYearId: '',
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      {
        feePlanId: body.feePlanId,
        validDays: body.validDays ? parseInt(body.validDays, 10) : undefined,
        terms: body.terms,
      }
    )

    return ok(result.entry, { offer: result.offer })
  } catch (e: any) {
    return Errors.business('CREATE_OFFER_FAILED', e.message || 'Failed to create seat offer', 422)
  }
}

export const POST = withApi(_POST)
