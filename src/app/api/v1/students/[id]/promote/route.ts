import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { StudentService } from '@/lib/students/student-service'

/**
 * POST /api/v1/students/[id]/promote — Promote student to next academic session
 */
async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'students:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params

  try {
    const body = await req.json()
    const { nextAcademicSessionId, nextProgramId, nextClassroomId, reason } = body

    if (!nextAcademicSessionId || !nextProgramId || !nextClassroomId) {
      return Errors.validation('nextAcademicSessionId, nextProgramId, and nextClassroomId are required')
    }

    const updated = await StudentService.promoteStudent(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      {
        targetAcademicSessionId: nextAcademicSessionId,
        targetClassroomId: nextClassroomId,
        notes: reason,
      }
    )


    return ok(updated)
  } catch (e: any) {
    return Errors.business('PROMOTION_FAILED', e.message || 'Failed to promote student', 422)
  }
}

export const POST = withApi(_POST)
