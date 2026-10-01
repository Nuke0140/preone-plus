import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { ClassroomPlacementService } from '@/lib/admissions/classroom-placement-service'

/**
 * GET /api/v1/classroom-placements/[id]/seats?classroomId=...
 * Returns seat inventory for a classroom (available vs occupied).
 */
async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'admissions:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params
  const sp = req.nextUrl.searchParams
  const classroomId = sp.get('classroomId')
  if (!classroomId) {
    return Errors.validation('classroomId query parameter is required')
  }

  const branchId = sp.get('branchId') || session.branchId
  const academicYearId = sp.get('academicYearId')

  try {
    const seatData = await ClassroomPlacementService.getAvailableSeats(
      {
        tenantId: session.tenantId,
        branchId: branchId || '',
        academicYearId: academicYearId || '',
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      classroomId
    )

    return ok(seatData)
  } catch (e: any) {
    return Errors.business('SEAT_QUERY_FAILED', e.message || 'Failed to retrieve classroom seats', 422)
  }
}

export const GET = withApi(_GET)
