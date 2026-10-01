import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { ClassroomPlacementService } from '@/lib/admissions/classroom-placement-service'
import type { ProgramType } from '@prisma/client'

/**
 * GET /api/v1/classroom-placements
 * Main ledger listing placed students and pending eligible candidates count.
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'admissions:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const sp = req.nextUrl.searchParams
  const branchId = sp.get('branchId') || session.branchId
  const academicYearId = sp.get('academicYearId')
  const programType = (sp.get('programType') as ProgramType) || undefined
  const classroomId = sp.get('classroomId') || undefined
  const status = (sp.get('status') as 'ALL' | 'PLACED' | 'PENDING') || 'ALL'
  const search = sp.get('search') || undefined

  try {
    const data = await ClassroomPlacementService.getPlacementsLedger(
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
        classroomId,
        status,
        search,
      }
    )

    return ok(data)
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
