import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportSecurityService } from '@/lib/transport/transport-security'
import { db } from '@/lib/db'

/**
 * POST /api/v1/transport/authorizations/:id/complete — Complete Handover (Strict Re-Validation)
 */
async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: authId } = await params
  const session = await requireApi(req, 'transport:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const context = {
      tenantId: session.tenantId,
      branchId: session.branchId || undefined,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    }

    const auth = await db.transportPickupAuthorization.findFirst({
      where: { id: authId, tenantId: session.tenantId },
      include: { student: true },
    })

    if (!auth) {
      return Errors.notFound('Authorization request not found')
    }

    // STRICT SECURITY RE-VALIDATION: Check authorization status
    if (auth.status !== 'APPROVED') {
      await TransportSecurityService.logSecurityEvent(context, {
        eventType: 'UNAUTHORIZED_PICKUP_ATTEMPT',
        studentId: auth.studentId,
        authorizationId: auth.id,
        action: `Complete Handover (${auth.actionType})`,
        result: 'BLOCKED',
        reason: `Handover blocked: Authorization status is ${auth.status} (Parent approval required)`,
      })

      return Errors.forbidden(`ACCESS DENIED: This person is not authorized to ${auth.actionType.toLowerCase()} this student. Current Status: ${auth.status}`)
    }

    const now = new Date()
    if (now < auth.validFrom || now > auth.validUntil) {
      await TransportSecurityService.logSecurityEvent(context, {
        eventType: 'UNAUTHORIZED_PICKUP_ATTEMPT',
        studentId: auth.studentId,
        authorizationId: auth.id,
        action: `Complete Handover (${auth.actionType})`,
        result: 'BLOCKED',
        reason: `Handover blocked: Authorization expired`,
      })

      return Errors.forbidden('ACCESS DENIED: Pickup authorization date has expired')
    }

    // Update authorization to USED / COMPLETED
    const updated = await db.transportPickupAuthorization.update({
      where: { id: authId },
      data: {
        status: 'USED',
        usedAt: now,
        usedById: session.uid,
        usedByName: session.name,
      },
    })

    await TransportSecurityService.logSecurityEvent(context, {
      eventType: 'AUTHORIZATION_APPROVED',
      studentId: auth.studentId,
      authorizationId: auth.id,
      action: `Handover Completed (${auth.actionType})`,
      result: 'SUCCESS',
      reason: `Handover completed for student ${auth.student.firstName} to ${auth.personName} (${auth.relationship})`,
    })

    return ok({
      success: true,
      message: `${auth.actionType} handover completed successfully for ${auth.student.firstName}`,
      authorization: updated,
    })
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const POST = withApi(_POST)
