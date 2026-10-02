import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { LeadService } from '@/lib/admissions/lead-service'
import type { LeadStatus } from '@prisma/client'

/**
 * GET /api/v1/leads/[id] — Retrieve single enquiry details with assigned staff, history & activity timeline
 */
async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'admissions:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params

  try {
    const data = await LeadService.getLead(session.tenantId, id)
    if (!data) return Errors.notFound('Enquiry')

    const activity = await LeadService.getActivity(session.tenantId, id)

    return ok({
      enquiry: data.lead,
      lead: data.lead,
      assignedStaff: data.assignedStaff,
      followUps: data.followUps,
      auditLogs: data.auditLogs,
      activity,
    })
  } catch (e: any) {
    return Errors.system(e)
  }
}

/**
 * PATCH /api/v1/leads/[id] — Update status, assignment, lost reason, notes, or details
 */
async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'admissions:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params

  try {
    const body = await req.json()
    const {
      status,
      notes,
      nextFollowUpAt,
      branchId,
      academicYearId,
      assignedToId,
      assignedStaffName,
      lostReason,
      lostNotes,
      ...detailUpdates
    } = body

    const ctx = {
      tenantId: session.tenantId,
      branchId: branchId || session.branchId || '',
      academicYearId: academicYearId || '',
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    }

    // 1. If marked lost
    if (status === 'LOST') {
      const lostRes = await LeadService.markLost(ctx, id, lostReason || 'OTHER', lostNotes || notes)
      return ok(lostRes)
    }

    // 2. If status change requested
    if (status) {
      const updatedStatus = await LeadService.transitionStatus(
        ctx,
        id,
        status as LeadStatus,
        notes,
        nextFollowUpAt
      )
      return ok(updatedStatus)
    }

    // 3. If assignment requested
    if (assignedToId !== undefined) {
      const updatedAssign = await LeadService.assignLead(
        ctx,
        id,
        assignedToId,
        assignedStaffName
      )
      return ok(updatedAssign)
    }

    // 4. Detail updates
    const updated = await LeadService.updateLead(ctx, id, {
      ...detailUpdates,
      notes,
    })

    return ok(updated)
  } catch (e: any) {
    return Errors.business('UPDATE_FAILED', e.message || 'Failed to update enquiry', 422)
  }
}

export const GET = withApi(_GET)
export const PATCH = withApi(_PATCH)
