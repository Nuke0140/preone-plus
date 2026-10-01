import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { WaitingListService } from '@/lib/admissions/waiting-list-service'

/**
 * POST /api/v1/admissions/waitlist/[id]/withdraw
 * Withdraw candidate from waiting list.
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
    const updated = await WaitingListService.withdraw(
      {
        tenantId: session.tenantId,
        branchId: session.branchId || '',
        academicYearId: '',
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      body.reason || 'Candidate withdrawn from waiting list'
    )

    return ok(updated)
  } catch (e: any) {
    return Errors.business('WITHDRAW_FAILED', e.message || 'Failed to withdraw from waiting list', 422)
  }
}

export const POST = withApi(_POST)
