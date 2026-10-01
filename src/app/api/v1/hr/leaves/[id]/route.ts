import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { LeaveService } from '@/lib/hr/leave-service'

async function _PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApi(req, 'hr:approve')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const { id } = await params
    const body = await req.json()
    const { action, rejectionReason } = body

    if (action !== 'APPROVE' && action !== 'REJECT') {
      return Errors.validation('Action must be APPROVE or REJECT')
    }

    const result = await LeaveService.actionLeave(
      session.tenantId,
      id,
      action,
      {
        id: session.uid,
        name: session.name,
        role: session.role,
      },
      rejectionReason
    )

    return ok(result)
  } catch (e: any) {
    return Errors.validation(e.message || 'Failed to action leave request')
  }
}

export const PATCH = withApi(_PATCH)
