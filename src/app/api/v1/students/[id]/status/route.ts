import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { StudentService } from '@/lib/students/student-service'
import type { StudentStatus } from '@prisma/client'

/**
 * POST /api/v1/students/[id]/status — Lifecycle status update (including non-destructive withdrawal)
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
    const { status, reason, notes, forceWithPendingFees } = body

    if (!status) {
      return Errors.validation('status is required')
    }

    if (status === 'WITHDRAWN') {
      const withdrawn = await StudentService.withdrawStudent(
        {
          tenantId: session.tenantId,
          branchId: session.branchId,
          actorId: session.uid,
          actorName: session.name,
          actorRole: session.role,
        },
        id,
        {
          reason: reason || 'Parent Request',
          notes,
          forceWithPendingFees,
        }
      )
      return ok(withdrawn)
    }

    const updated = await StudentService.updateStatus(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      status as StudentStatus,
      reason
    )

    return ok(updated)
  } catch (e: any) {
    return Errors.business('STATUS_UPDATE_FAILED', e.message || 'Failed to update student status', 422)
  }
}

export const POST = withApi(_POST)
