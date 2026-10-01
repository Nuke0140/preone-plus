import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors, bad } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportService } from '@/lib/transport/transport-service'

/**
 * POST /api/v1/transport/trips/[id]/drop â€” Record child drop with authorized guardian verification
 */
async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApi(req, 'transport:drop')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('Tenant context required')

  const { id } = await params
  try {
    const body = await req.json()
    const { studentId, guardianId, phone, userId, pin, notes } = body

    if (!studentId) return bad('studentId is required')

    const updated = await TransportService.recordDrop(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      {
        tripId: id,
        studentId,
        guardianId,
        phone,
        userId,
        pin,
        notes,
      }
    )

    return ok(updated)
  } catch (e: any) {
    return bad(e.message)
  }
}

export const POST = withApi(_POST)
