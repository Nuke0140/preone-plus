import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AcademicService } from '@/lib/academics/academic-service'

/**
 * GET /api/v1/academics/reports/student/[studentId] — Generate student academic progress report
 */
async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const session = await requireApi(req, 'academics:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { studentId } = await params
  const { searchParams } = new URL(req.url)
  const academicSessionId = searchParams.get('academicSessionId') || undefined

  try {
    const report = await AcademicService.generateStudentReport(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        academicSessionId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      studentId,
      academicSessionId
    )

    return ok(report)
  } catch (e: any) {
    return Errors.business('REPORT_GENERATE_FAILED', e.message || 'Failed to generate student report', 422)
  }
}

export const GET = withApi(_GET)
