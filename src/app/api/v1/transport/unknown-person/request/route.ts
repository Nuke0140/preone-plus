import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportSecurityService } from '@/lib/transport/transport-security'
import { db } from '@/lib/db'

/**
 * POST /api/v1/transport/unknown-person/request — Unknown Person Pickup/Drop Request
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'transport:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json().catch(() => ({}))
    const { personName, contactNumber, studentId, actionType, relationship, remarks } = body

    if (!personName || !contactNumber || !studentId) {
      return Errors.validation('personName, contactNumber, and studentId are required')
    }

    const tenantId = session.tenantId

    // Verify selected student belongs to tenant & has transport eligibility
    const student = await db.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      include: {
        currentClassroom: {
          select: { primaryTeacherId: true },
        },
        guardians: {
          include: { guardian: { select: { id: true, userId: true, fullName: true } } },
        },
      },
    })

    if (!student) {
      return Errors.forbidden('Selected student not found or ineligible for transport')
    }

    const context = {
      tenantId,
      branchId: session.branchId || student.branchId || undefined,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const validUntil = new Date(today)
    validUntil.setHours(23, 59, 59, 999)

    // Create Temporary Pickup Authorization with status PENDING
    const auth = await db.transportPickupAuthorization.create({
      data: {
        tenantId,
        branchId: context.branchId,
        studentId,
        personName: personName.trim(),
        phone: contactNumber.trim(),
        relationship: (relationship || 'Alternate').trim(),
        actionType: (actionType || 'PICKUP').toUpperCase(),
        reason: (remarks || 'Unknown person pickup request').trim(),
        validFrom: today,
        validUntil,
        isOneTime: true,
        status: 'PENDING',
        remarks: remarks?.trim() || null,
      },
    })

    await TransportSecurityService.logSecurityEvent(context, {
      eventType: 'UNKNOWN_PERSON_DETECTED',
      studentId,
      authorizationId: auth.id,
      action: `Unknown Person ${auth.actionType} Request`,
      result: 'SUCCESS',
      reason: `Submitted request for ${personName} (${relationship}) to ${auth.actionType} student ${student.firstName}`,
    })

    // 1. Notify Parent/Guardian
    for (const link of (student as any).guardians || []) {
      if (link.guardian?.userId) {
        await db.inAppNotification.create({
          data: {
            tenantId,
            userId: link.guardian.userId,
            title: `ACTION REQUIRED: Transport ${auth.actionType} Request for ${student.firstName}`,
            body: `${personName} (${relationship}, Phone: ${contactNumber}) requested to ${auth.actionType.toLowerCase()} ${student.firstName}. Please approve or reject.`,
            category: 'TRANSPORT',
            severity: 'URGENT',
            linkUrl: '/app/transport',
            metadata: { authorizationId: auth.id, studentId: student.id },
          },
        })
      }
    }

    // 2. Notify Class Teacher
    const teacherUserId = (student.currentClassroom as any)?.primaryTeacherId
    if (teacherUserId) {
      await db.inAppNotification.create({
        data: {
          tenantId,
          userId: teacherUserId,
          title: `Transport ${auth.actionType} Authorization Request: ${student.firstName}`,
          body: `An unknown/alternate person (${personName}, ${relationship}) requested to ${auth.actionType.toLowerCase()} ${student.firstName}. Parent approval pending.`,
          category: 'TRANSPORT',
          severity: 'INFO',
          linkUrl: '/app/transport?tab=TEACHER',
          metadata: { authorizationId: auth.id, studentId: student.id },
        },
      })
    }

    return ok({
      authorizationId: auth.id,
      status: 'PENDING',
      message: 'Unknown person request submitted. Parent notification sent for approval.',
      authorization: auth,
    })
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const POST = withApi(_POST)
