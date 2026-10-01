import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { StudentService } from '@/lib/students/student-service'

/**
 * POST /api/v1/students/[id]/transfer — Inter-branch student transfer
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
    const { destinationBranchId, destinationClassroomId, reason } = body

    if (!destinationBranchId || !destinationClassroomId) {
      return Errors.validation('destinationBranchId and destinationClassroomId are required')
    }

    const updated = await StudentService.transferBranch(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      {
        destinationBranchId,
        destinationClassroomId,
        reason,
      }
    )

    return ok(updated)
  } catch (e: any) {
    return Errors.business('TRANSFER_FAILED', e.message || 'Failed to transfer branch', 422)
  }
}

export const POST = withApi(_POST)
