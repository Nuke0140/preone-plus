import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AdmissionService } from '@/lib/admissions/admission-service'

/**
 * POST /api/v1/applications/[id]/enroll — Final Admission Enrollment & Student Conversion
 * Atomically converts Application -> Student + Guardian + Classroom Allocation + Fee Invoice + Parent Portal sync
 */
async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'admissions:approve')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params

  try {
    const body = await req.json().catch(() => ({}))
    const classroomId: string | undefined = body.classroomId
    const academicYearId: string | undefined = body.academicYearId

    const result = await AdmissionService.completeEnrollment(
      {
        tenantId: session.tenantId,
        branchId: session.branchId || '',
        academicYearId: academicYearId || '',
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      classroomId
    )

    return ok(result)
  } catch (e: any) {
    return Errors.business('ADMISSION_ENROLL_FAILED', e.message || 'Could not complete final admission', 422)
  }
}

export const POST = withApi(_POST)
