import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { LeadService } from '@/lib/admissions/lead-service'
import type { LeadStatus } from '@prisma/client'

/**
 * POST /api/v1/leads/:id/status — Canonical state transition with validation
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
    const { status, notes, nextFollowUpAt, branchId, academicYearId } = body

    if (!status) {
      return Errors.badRequest('Target status is required')
    }

    const updated = await LeadService.transitionStatus(
      {
        tenantId: session.tenantId,
        branchId: branchId || session.branchId || '',
        academicYearId: academicYearId || '',
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      status as LeadStatus,
      notes,
      nextFollowUpAt
    )

    return ok(updated)
  } catch (e: any) {
    return Errors.business('STATUS_TRANSITION_FAILED', e.message || 'Failed to transition lead status', 422)
  }
}

export const POST = withApi(_POST)
