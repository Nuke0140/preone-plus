import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { WaitingListService } from '@/lib/admissions/waiting-list-service'

/**
 * POST /api/v1/admissions/waitlist/[id]/parent-response
 * Record parent response (ACCEPTED or DECLINED).
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

  if (!body.response || !['ACCEPTED', 'DECLINED'].includes(body.response)) {
    return Errors.business('INVALID_RESPONSE', 'Response must be ACCEPTED or DECLINED', 400)
  }

  try {
    const updated = await WaitingListService.recordParentResponse(
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
        response: body.response,
        notes: body.notes,
      }
    )

    return ok(updated)
  } catch (e: any) {
    return Errors.business('RECORD_RESPONSE_FAILED', e.message || 'Failed to record parent response', 422)
  }
}

export const POST = withApi(_POST)
