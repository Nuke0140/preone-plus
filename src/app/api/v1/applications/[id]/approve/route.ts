import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AdmissionService } from '@/lib/admissions/admission-service'

/**
 * POST /api/v1/applications/{id}/approve — Admission Approval
 * If classroomId is provided, performs direct final enrollment for backward compatibility.
 * Otherwise, performs formal approval gate transition.
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

    const ctx = {
      tenantId: session.tenantId,
      branchId: session.branchId || '',
      academicYearId: academicYearId || '',
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    }

    const action = body.action || 'APPROVE'

    if (action === 'NEED_MORE_INFORMATION') {
      const result = await AdmissionService.requestMoreInformation(ctx, id, {
        reason: body.reason || 'Additional information required',
        note: body.notes,
      })
      return ok(result)
    }

    if (action === 'WAITLIST') {
      const result = await AdmissionService.waitlistApplication(ctx, id, body.reason)
      return ok(result)
    }

    if (action === 'NOT_PROCEEDING') {
      const result = await AdmissionService.rejectApplication(ctx, id, body.reason || 'Not proceeding', body.notes)
      return ok(result)
    }

    if (classroomId) {
      // Legacy or direct enrollment path
      const result = await AdmissionService.completeEnrollment(ctx, id, classroomId)
      return ok(result)
    }

    const approvedApp = await AdmissionService.approveApplication(ctx, id, body.notes)
    return ok(approvedApp)
  } catch (e: any) {
    return Errors.business('ADMISSION_APPROVE_FAILED', e.message || 'Could not approve application', 422)
  }
}

export const POST = withApi(_POST)
