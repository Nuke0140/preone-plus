import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { OperationsService } from '@/lib/operations/operations-service'

/**
 * GET /api/v1/operations/reports/daily?studentId=&date=
 * Compiles parent-facing daily report aggregating attendance, care, activities, and pickup
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'timeline:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const studentId = req.nextUrl.searchParams.get('studentId')
  const date = req.nextUrl.searchParams.get('date') || undefined

  if (!studentId) return bad('studentId is required', 'MISSING_STUDENT_ID')

  try {
    if (session.role === 'PARENT') {
      const isLinked = await db.studentGuardian.findFirst({
        where: {
          studentId,
          guardian: { userId: session.uid, tenantId: session.tenantId, deletedAt: null },
        },
      })
      if (!isLinked) {
        return Errors.forbidden('You are not authorized to access this child’s daily report')
      }
    }

    const report = await OperationsService.generateDailyReport(session.tenantId, studentId, date)
    return ok(report)
  } catch (err: any) {
    return bad(err.message, 'REPORT_GENERATION_FAILED')
  }
}

export const GET = withApi(_GET)
