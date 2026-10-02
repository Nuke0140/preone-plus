import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AcademicService } from '@/lib/academics/academic-service'

/**
 * GET /api/v1/academics/dashboard — Aggregated preschool academic dashboard metrics
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'academics:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get('branchId') || session.branchId || undefined
  const academicSessionId = searchParams.get('academicSessionId') || undefined

  try {
    const stats = await AcademicService.getDashboardStats(
      {
        tenantId: session.tenantId,
        branchId,
        academicSessionId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      { branchId, academicSessionId }
    )

    return ok(stats)
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
