import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { ClassroomPlacementService } from '@/lib/admissions/classroom-placement-service'

/**
 * POST /api/v1/classroom-placements/[id]/complete
 * Atomic transactional completion of Classroom Placement and Admission.
 */
async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'admissions:enroll')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params

  try {
    const body = await req.json().catch(() => ({}))
    if (!body.classroomId) {
      return Errors.validation('classroomId is required')
    }
    if (!body.seatNumber) {
      return Errors.validation('seatNumber is required')
    }

    const branchId = body.branchId || session.branchId
    const academicYearId = body.academicYearId

    const result = await ClassroomPlacementService.completePlacement(
      {
        tenantId: session.tenantId,
        branchId: branchId || '',
        academicYearId: academicYearId || '',
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      {
        classroomId: body.classroomId,
        seatNumber: body.seatNumber,
        branchId,
        academicSessionId: academicYearId,
        primaryParent: body.primaryParent,
        additionalGuardians: body.additionalGuardians,
        childOverrides: body.childOverrides,
        notes: body.notes,
      }
    )

    return ok(result)
  } catch (e: any) {
    if (e.code === 'CLASSROOM_FULL') {
      return Errors.conflict(e.message)
    }
    if (e.code === 'SEAT_ALREADY_ASSIGNED') {
      return Errors.conflict(e.message)
    }
    return Errors.business('PLACEMENT_FAILED', e.message || 'Failed to complete placement', 422)
  }
}

export const POST = withApi(_POST)
