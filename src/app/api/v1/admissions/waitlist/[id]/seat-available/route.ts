import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { WaitingListService } from '@/lib/admissions/waiting-list-service'

/**
 * POST /api/v1/admissions/waitlist/[id]/seat-available
 * Mark that a seat opportunity has opened up and notify parent (Opportunity != Admitted).
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
    const updated = await WaitingListService.markSeatAvailable(
      {
        tenantId: session.tenantId,
        branchId: session.branchId || '',
        academicYearId: '',
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id
    )

    return ok(updated)
  } catch (e: any) {
    return Errors.business('MARK_SEAT_AVAILABLE_FAILED', e.message || 'Failed to update seat opportunity', 422)
  }
}

export const POST = withApi(_POST)
