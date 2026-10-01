import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { StudentService } from '@/lib/students/student-service'

/**
 * GET /api/v1/students/dashboard — Student directory dashboard statistics
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'students:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const { searchParams } = new URL(req.url)
    const branchId = searchParams.get('branchId') || session.branchId || undefined
    const academicSessionId = searchParams.get('academicSessionId') || undefined

    const stats = await StudentService.getStudentDashboardStats(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      { branchId, academicSessionId }
    )

    return ok(stats)
  } catch (e: any) {
    return Errors.business('DASHBOARD_STATS_FAILED', e.message || 'Failed to calculate student dashboard statistics', 500)
  }
}

export const GET = withApi(_GET)
