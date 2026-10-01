import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { getRequestMeta } from '@/lib/audit'
import { OperationsService } from '@/lib/operations/operations-service'

/**
 * POST /api/v1/operations/incidents
 * Records safety / health incident and initiates escalation workflow
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'operations:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const meta = getRequestMeta(req)

    const res = await OperationsService.recordIncident(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      body
    )

    return ok(res, undefined, 201)
  } catch (err: any) {
    return bad(err.message, 'INCIDENT_RECORD_FAILED')
  }
}

export const POST = withApi(_POST)
