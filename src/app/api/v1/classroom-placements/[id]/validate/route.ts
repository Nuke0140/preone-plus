import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { ClassroomPlacementService } from '@/lib/admissions/classroom-placement-service'

/**
 * POST /api/v1/classroom-placements/[id]/validate
 * Pre-placement validation check (branch, session, program, capacity, seat, class teacher).
 */
async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'admissions:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params

  try {
    const body = await req.json().catch(() => ({}))
    if (!body.classroomId) {
      return Errors.validation('classroomId is required for validation')
    }
    if (!body.seatNumber) {
      return Errors.validation('seatNumber is required for validation')
    }

    const branchId = body.branchId || session.branchId
    const academicYearId = body.academicYearId

    const validation = await ClassroomPlacementService.validatePlacement(
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
      }
    )

    return ok(validation)
  } catch (e: any) {
    return Errors.business('VALIDATION_FAILED', e.message || 'Validation failed', 422)
  }
}

export const POST = withApi(_POST)
