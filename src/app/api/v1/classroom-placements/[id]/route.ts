import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { ClassroomPlacementService } from '@/lib/admissions/classroom-placement-service'

/**
 * GET /api/v1/classroom-placements/[id]
 * Complete pre-placement dossier for a candidate (Child, Parent, Academic, Classrooms, Fee Setup).
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
  const branchId = sp.get('branchId') || session.branchId
  const academicYearId = sp.get('academicYearId')

  try {
    const dossier = await ClassroomPlacementService.getPlacementDossier(
      {
        tenantId: session.tenantId,
        branchId: branchId || '',
        academicYearId: academicYearId || '',
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id
    )

    return ok(dossier)
  } catch (e: any) {
    return Errors.notFound(e.message || 'Placement dossier')
  }
}

export const GET = withApi(_GET)
