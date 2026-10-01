import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { StudentService } from '@/lib/students/student-service'

/**
 * POST /api/v1/students/[id]/classroom — Reallocate classroom section with capacity concurrency guard
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
    const { destinationClassroomId, classroomId, reason } = body
    const targetRoomId = destinationClassroomId || classroomId

    if (!targetRoomId) {
      return Errors.validation('destinationClassroomId is required')
    }

    const updated = await StudentService.reallocateClassroom(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      {
        destinationClassroomId: targetRoomId,
        reason,
      }
    )

    return ok(updated)
  } catch (e: any) {
    return Errors.business('REALLOCATION_FAILED', e.message || 'Failed to reallocate classroom', 422)
  }
}

export const POST = withApi(_POST)
