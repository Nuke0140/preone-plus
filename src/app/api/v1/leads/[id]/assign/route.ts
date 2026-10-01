import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { LeadService } from '@/lib/admissions/lead-service'

/**
 * POST /api/v1/leads/:id/assign — Assign or reassign lead to a staff member
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
    const { assignedToId, assignedStaffName, branchId, academicYearId } = body

    if (!assignedToId) {
      return Errors.badRequest('assignedToId is required')
    }

    const updated = await LeadService.assignLead(
      {
        tenantId: session.tenantId,
        branchId: branchId || session.branchId || '',
        academicYearId: academicYearId || '',
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      assignedToId,
      assignedStaffName
    )

    return ok(updated)
  } catch (e: any) {
    return Errors.business('ASSIGN_FAILED', e.message || 'Failed to assign lead', 422)
  }
}

export const POST = withApi(_POST)
