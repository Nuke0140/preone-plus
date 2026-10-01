import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { ClassroomPlacementService } from '@/lib/admissions/classroom-placement-service'
import type { ProgramType } from '@prisma/client'

/**
 * GET /api/v1/classroom-placements/eligible
 * Returns candidates authorized and ready for classroom placement.
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'admissions:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const sp = req.nextUrl.searchParams
  const branchId = sp.get('branchId') || session.branchId
  const academicYearId = sp.get('academicYearId')
  const programType = (sp.get('programType') as ProgramType) || undefined
  const search = sp.get('search') || undefined

  try {
    const candidates = await ClassroomPlacementService.getEligibleCandidates(
      {
        tenantId: session.tenantId,
        branchId: branchId || '',
        academicYearId: academicYearId || '',
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      {
        branchId: branchId || undefined,
        academicYearId: academicYearId || undefined,
        programType,
        search,
      }
    )

    return ok({ candidates, total: candidates.length })
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
