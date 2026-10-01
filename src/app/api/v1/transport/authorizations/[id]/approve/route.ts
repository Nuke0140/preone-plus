import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportSecurityService } from '@/lib/transport/transport-security'

/**
 * POST /api/v1/transport/authorizations/:id/approve — Approve Unknown Person Request
 */
async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: authId } = await params
  const session = await requireApi(req, 'transport:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json().catch(() => ({}))
    const { remarks } = body

    const context = {
      tenantId: session.tenantId,
      branchId: session.branchId || undefined,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    }

    const updated = await TransportSecurityService.approvePickupAuthorization(context, authId, remarks)
    return ok(updated)
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const POST = withApi(_POST)
