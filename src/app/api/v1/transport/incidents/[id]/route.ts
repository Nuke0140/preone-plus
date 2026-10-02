import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors, bad } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportService } from '@/lib/transport/transport-service'

/**
 * PATCH /api/v1/transport/incidents/[id] — Update, resolve, or correct a transport incident
 */
async function _PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApi(req, 'transport:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('Tenant context required')

  const { id } = await params
  try {
    const body = await req.json()
    const { status, actionTaken, resolutionNotes, severity, category, correctionReason } = body

    const updated = await TransportService.updateIncident(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      {
        status,
        actionTaken,
        resolutionNotes,
        severity,
        category,
        correctionReason,
      }
    )

    return ok(updated)
  } catch (e: any) {
    return bad(e.message)
  }
}

export const PATCH = withApi(_PATCH)
