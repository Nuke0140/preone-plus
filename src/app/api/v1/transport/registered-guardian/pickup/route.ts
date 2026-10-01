import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportSecurityService } from '@/lib/transport/transport-security'
import { db } from '@/lib/db'

/**
 * POST /api/v1/transport/registered-guardian/pickup — Registered Guardian Student Pickup Action
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'transport:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json().catch(() => ({}))
    const { studentId, tripId, stopId, notes } = body

    if (!studentId) {
      return Errors.validation('studentId is required')
    }

    const context = {
      tenantId: session.tenantId,
      branchId: session.branchId || undefined,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    }

    // Security check: ensure actor can access target student
    const hasAccess = await TransportSecurityService.validateStudentAccess(context, studentId)
    if (!hasAccess) {
      return Errors.forbidden('You are not authorized to perform pickup for this student')
    }

    const student = await db.student.findFirst({
      where: { id: studentId, tenantId: session.tenantId },
    })
    if (!student) return Errors.notFound('Student not found')

    const now = new Date()

    // Log security event & update manifest if tripId exists
    if (tripId) {
      await db.tripManifestItem.upsert({
        where: { tripId_studentId: { tripId, studentId } },
        create: {
          tripId,
          studentId,
          stopId: stopId || 'default-stop',
          status: 'BOARDED',
          boardedAt: now,
          actionById: session.uid,
          actionByName: session.name,
          notes: notes || 'Registered Parent Pickup',
        },
        update: {
          status: 'BOARDED',
          boardedAt: now,
          actionById: session.uid,
          actionByName: session.name,
          notes: notes || 'Registered Parent Pickup',
        },
      })
    }

    await TransportSecurityService.logSecurityEvent(context, {
      eventType: 'PIN_VERIFICATION_SUCCESS',
      studentId,
      tripId,
      action: 'Registered Guardian Pickup',
      result: 'SUCCESS',
      reason: `Registered guardian ${session.name} completed pickup for student ${student.firstName} ${student.lastName}`,
    })

    return ok({
      success: true,
      studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      status: 'BOARDED',
      action: 'PICKUP',
      time: now,
      message: `Pickup completed successfully for ${student.firstName}`,
    })
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const POST = withApi(_POST)
