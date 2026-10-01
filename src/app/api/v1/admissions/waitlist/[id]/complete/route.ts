import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { WaitingListService } from '@/lib/admissions/waiting-list-service'

/**
 * POST /api/v1/admissions/waitlist/[id]/complete
 * Complete admission: Executes atomic student creation, classroom allocation, and marks CONVERTED.
 */
async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'admissions:approve')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  try {
    const result = await WaitingListService.completeAdmission(
      {
        tenantId: session.tenantId,
        branchId: session.branchId || '',
        academicYearId: '',
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      body.classroomId
    )

    return ok(result.entry, { student: result.student })
  } catch (e: any) {
    return Errors.business('COMPLETE_ADMISSION_FAILED', e.message || 'Failed to complete admission', 422)
  }
}

export const POST = withApi(_POST)
