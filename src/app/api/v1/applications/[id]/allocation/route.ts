import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AdmissionService } from '@/lib/admissions/admission-service'
import { db } from '@/lib/db'

/**
 * GET /api/v1/applications/[id]/allocation
 * Returns live classroom divisions, capacity, seat counts, and policy recommendation
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
    const ctx = {
      tenantId: session.tenantId,
      branchId: session.branchId || '',
      academicYearId: '',
    }

    const recommendations = await AdmissionService.getAllocationRecommendations(ctx, id)
    return ok(recommendations)
  } catch (err: any) {
    return Errors.business('ALLOCATION_EVAL_FAILED', err.message || 'Could not evaluate allocation', 422)
  }
}

/**
 * POST /api/v1/applications/[id]/allocation
 * Confirms classroom division allocation or routes to waitlist
 */
async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'admissions:approve')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params

  try {
    const body = await req.json().catch(() => ({}))
    const { classroomId, action = 'allocate', reason } = body

    const ctx = {
      tenantId: session.tenantId,
      branchId: session.branchId || '',
      academicYearId: body.academicYearId || '',
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    }

    if (action === 'waitlist') {
      const waitlisted = await AdmissionService.waitlistApplication(ctx, id, reason || 'Classroom division full')
      return ok({ status: 'WAITLISTED', application: waitlisted })
    }

    if (action === 'promote') {
      const promoted = await AdmissionService.promoteWaitingListEntry(ctx, id, classroomId, reason)
      return ok({ status: 'PROMOTED', application: promoted })
    }

    // Direct division allocation
    if (!classroomId) {
      return Errors.badRequest('classroomId is required for allocation')
    }

    const cls = await db.classroom.findFirst({
      where: { id: classroomId, tenantId: session.tenantId, isActive: true },
      include: { allocations: { where: { status: 'ACTIVE' } } },
    })
    if (!cls) return Errors.notFound('Classroom not found')

    if (cls.allocations.length >= cls.capacity) {
      return Errors.business('CAPACITY_FULL', `Classroom division ${cls.name} has no available seats (${cls.allocations.length}/${cls.capacity})`, 409)
    }

    const updated = await db.admissionApplication.update({
      where: { id },
      data: {
        classroomId,
      },
    })

    return ok({ status: 'ALLOCATED', classroomId, classroomName: cls.name, application: updated })
  } catch (err: any) {
    return Errors.business('ALLOCATION_FAILED', err.message || 'Could not allocate classroom', 422)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
