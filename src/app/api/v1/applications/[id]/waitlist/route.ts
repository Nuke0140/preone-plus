import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AdmissionService } from '@/lib/admissions/admission-service'

/**
 * POST /api/v1/applications/{id}/waitlist — Move application to waiting list
 */
async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'admissions:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  try {
    const res = await AdmissionService.waitlistApplication(
      {
        tenantId: session.tenantId,
        branchId: session.branchId || '',
        academicYearId: body.academicYearId || '',
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      body.reason
    )

    return ok(res)
  } catch (e: any) {
    return Errors.business('WAITLIST_FAILED', e.message || 'Failed to waitlist application', 422)
  }
}

export const POST = withApi(_POST)
