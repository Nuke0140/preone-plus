import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { WaitingListService } from '@/lib/admissions/waiting-list-service'

/**
 * PATCH /api/v1/admissions/waitlist/[id]/priority
 * Change priority between NORMAL and HIGH with mandatory audit reason.
 */
async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'admissions:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  if (!body.newPriority || !['NORMAL', 'HIGH'].includes(body.newPriority)) {
    return Errors.business('INVALID_PRIORITY', 'newPriority must be NORMAL or HIGH', 400)
  }

  if (!body.reason || !body.reason.trim()) {
    return Errors.business('MISSING_REASON', 'A documented reason is required to change priority', 400)
  }

  try {
    const updated = await WaitingListService.changePriority(
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
        newPriority: body.newPriority,
        reason: body.reason,
      }
    )

    return ok(updated)
  } catch (e: any) {
    return Errors.business('PRIORITY_CHANGE_FAILED', e.message || 'Failed to change priority', 422)
  }
}

export const PATCH = withApi(_PATCH)
