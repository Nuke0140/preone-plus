import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { LeadService } from '@/lib/admissions/lead-service'

/**
 * POST /api/v1/leads/:id/duplicate — Mark lead as DUPLICATE and preserve primary link
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
    const { primaryLeadId, notes, branchId, academicYearId } = body

    if (!primaryLeadId) {
      return Errors.badRequest('primaryLeadId is required')
    }

    const updated = await LeadService.markDuplicate(
      {
        tenantId: session.tenantId,
        branchId: branchId || session.branchId || '',
        academicYearId: academicYearId || '',
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      primaryLeadId,
      notes
    )

    return ok(updated)
  } catch (e: any) {
    return Errors.business('MARK_DUPLICATE_FAILED', e.message || 'Failed to mark lead as duplicate', 422)
  }
}

export const POST = withApi(_POST)
