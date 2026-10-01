import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { LeadService } from '@/lib/admissions/lead-service'

/**
 * POST /api/v1/leads/:id/lost — Close lead as LOST with mandatory reason
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
    const { lostReason, lostNotes, branchId, academicYearId } = body

    if (!lostReason || !String(lostReason).trim()) {
      return Errors.badRequest('lostReason is mandatory to close an enquiry as LOST')
    }

    const updated = await LeadService.markLost(
      {
        tenantId: session.tenantId,
        branchId: branchId || session.branchId || '',
        academicYearId: academicYearId || '',
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      lostReason,
      lostNotes
    )

    return ok(updated)
  } catch (e: any) {
    return Errors.business('MARK_LOST_FAILED', e.message || 'Failed to mark lead as lost', 422)
  }
}

export const POST = withApi(_POST)
