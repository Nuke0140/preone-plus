import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportSecurityService } from '@/lib/transport/transport-security'
import { TransportService } from '@/lib/transport/transport-service'
import { db } from '@/lib/db'

/**
 * POST /api/v1/transport/scan — Universal Transport QR Scanner API
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'transport:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json().catch(() => ({}))
    const { qrPayload, pin, studentId: explicitStudentId, tripId, action } = body

    if (!qrPayload || typeof qrPayload !== 'string') {
      return Errors.validation('qrPayload string is required')
    }

    const tenantId = session.tenantId

    const context = {
      tenantId,
      branchId: session.branchId || undefined,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    }

    // 0. Handle TRPQR_ Secure Driver Transport QR Token
    if (qrPayload.trim().startsWith('TRPQR_')) {
      try {
        const encoded = qrPayload.trim().substring(6)
        const decoded = Buffer.from(encoded, 'base64').toString('utf8')
        const [tokenTenantId, routeId, vehicleId, driverId, timestampStr] = decoded.split(':')

        if (tokenTenantId !== tenantId) {
          await TransportSecurityService.logSecurityEvent(context, {
            eventType: 'UNAUTHORIZED_PICKUP_ATTEMPT',
            action: 'QR_SCAN',
            result: 'BLOCKED',
            reason: `Cross-tenant QR scan attempt (Token Tenant: ${tokenTenantId}, User Tenant: ${tenantId})`,
          })
          return ok({
            valid: false,
            scanType: 'TRANSPORT_QR',
            status: 'TENANT_MISMATCH',
            message: 'Cross-tenant QR scan blocked',
          })
        }

        const route = await db.transportRoute.findFirst({
          where: { id: routeId, tenantId, deletedAt: null },
          include: {
            vehicle: true,
            driverProfile: { include: { user: { select: { fullName: true, phone: true } } } },
            stops: { orderBy: { sequence: 'asc' } },
          },
        })

        if (!route) {
          return ok({
            valid: false,
            scanType: 'TRANSPORT_QR',
            status: 'INVALID_ROUTE',
            message: 'Route not found or inactive',
          })
        }

        await TransportSecurityService.logSecurityEvent(context, {
          eventType: 'QR_SCAN',
          routeId: route.id,
          vehicleId: route.vehicleId ?? undefined,
          action: 'Driver Transport QR Scanned',
          result: 'SUCCESS',
          reason: `Driver QR scanned successfully for route ${route.name}`,
        })

        return ok({
          valid: true,
          scanType: 'TRANSPORT_QR',
          status: 'VERIFIED',
          route: {
            id: route.id,
            name: route.name,
            code: route.code,
            stops: route.stops,
          },
          vehicle: route.vehicle,
          driver: route.driverProfile?.user,
          availableActions: [
            { key: 'REGISTERED_GUARDIAN', label: '1. Parent / Registered Guardian' },
            { key: 'UNKNOWN_PERSON', label: '2. Unknown / Unregistered Person' },
          ],
          message: 'Transport QR scanned successfully. Please select your identity workflow.',
        })
      } catch (err: any) {
        return ok({
          valid: false,
          scanType: 'TRANSPORT_QR',
          status: 'MALFORMED',
          message: 'Malformed transport QR token',
        })
      }
    }

    // Parse payload: could be string like "STUDENT:cm123", "GUARDIAN:cm456", "DRIVER:cm789", "AUTH:cm111" or JSON string
    let parsedType = ''
    let parsedId = ''

    try {
      if (qrPayload.trim().startsWith('{')) {
        const json = JSON.parse(qrPayload)
        parsedType = json.type?.toUpperCase() || ''
        parsedId = json.id || json.studentId || json.guardianId || json.driverId || ''
      } else if (qrPayload.includes(':')) {
        const parts = qrPayload.trim().split(':')
        parsedType = parts[0].toUpperCase()
        parsedId = parts[1]
      } else {
        // Default assuming raw ID or Student ID
        parsedType = 'STUDENT'
        parsedId = qrPayload.trim()
      }
    } catch {
      parsedType = 'UNKNOWN'
      parsedId = qrPayload.trim()
    }

    // 1. Handle Driver QR Scan & PIN Verification
    if (parsedType === 'DRIVER') {
      const driverObj = await db.user.findFirst({
        where: { id: parsedId, memberships: { some: { tenantId } } },
        select: { id: true, fullName: true },
      })

      if (!driverObj) {
        await TransportSecurityService.logSecurityEvent(context, {
          eventType: 'DRIVER_MISMATCH',
          action: 'DRIVER_SCAN',
          driverProfileId: parsedId,
          result: 'FAILED',
          reason: 'Driver not found in tenant',
        })
        return ok({
          valid: false,
          scanType: 'DRIVER',
          status: 'INVALID_DRIVER',
          message: 'Driver not found in system or tenant mismatch',
        })
      }

      if (pin) {
        const pinCheck = await TransportSecurityService.verifyDriverPin(context, driverObj.id, pin)
        if (!pinCheck.valid) {
          return ok({
            valid: false,
            scanType: 'DRIVER',
            status: 'INVALID_PIN',
            message: pinCheck.message,
          })
        }
      }

      // Fetch driver vehicle and route assignment
      const driverVehicle = await db.vehicle.findFirst({
        where: {
          tenantId,
          status: 'ACTIVE',
          deletedAt: null,
          routes: {
            some: {
              status: 'ACTIVE',
              deletedAt: null,
              driverProfile: { userId: driverObj.id },
            },
          },
        },
        include: { routes: { where: { status: 'ACTIVE', deletedAt: null } } },
      })

      return ok({
        valid: true,
        scanType: 'DRIVER',
        status: 'VERIFIED',
        driver: driverObj,
        assignedVehicle: driverVehicle || null,
        message: 'Driver verified successfully',
      })
    }

    // 2. Handle Temporary Authorization QR Scan
    if (parsedType === 'AUTH' || parsedType === 'AUTHORIZATION') {
      const auth = await db.transportPickupAuthorization.findFirst({
        where: { id: parsedId, tenantId },
        include: {
          student: { select: { id: true, firstName: true, lastName: true, admissionNo: true, photoUrl: true } },
          guardian: { select: { id: true, fullName: true, phone: true } },
        },
      })

      if (!auth) {
        await TransportSecurityService.logSecurityEvent(context, {
          eventType: 'UNAUTHORIZED_PICKUP_ATTEMPT',
          action: 'AUTH_SCAN',
          result: 'FAILED',
          reason: 'Authorization record not found',
        })
        return ok({
          valid: false,
          scanType: 'AUTHORIZATION',
          status: 'NOT_FOUND',
          message: 'Temporary Pickup Authorization not found',
        })
      }

      const now = new Date()
      if (auth.status !== 'APPROVED') {
        await TransportSecurityService.logSecurityEvent(context, {
          eventType: 'UNAUTHORIZED_PICKUP_ATTEMPT',
          action: 'AUTH_SCAN',
          studentId: auth.studentId,
          result: 'BLOCKED',
          reason: `Authorization status is ${auth.status}`,
        })
        return ok({
          valid: false,
          scanType: 'AUTHORIZATION',
          status: auth.status,
          authorization: auth,
          message: `Authorization is not approved (Current Status: ${auth.status})`,
        })
      }

      if (now < auth.validFrom || now > auth.validUntil) {
        await TransportSecurityService.logSecurityEvent(context, {
          eventType: 'UNAUTHORIZED_PICKUP_ATTEMPT',
          action: 'AUTH_SCAN',
          studentId: auth.studentId,
          result: 'REJECTED',
          reason: 'Authorization window expired or not started',
        })
        return ok({
          valid: false,
          scanType: 'AUTHORIZATION',
          status: 'EXPIRED',
          authorization: auth,
          message: 'Pickup authorization has expired or is outside valid time window',
        })
      }

      return ok({
        valid: true,
        scanType: 'AUTHORIZATION',
        status: 'APPROVED',
        authorization: {
          ...auth,
          authorizedPersonName: auth.personName,
          authorizedPersonPhone: auth.phone,
        },
        message: `Authorized Pickup Person: ${auth.personName} (${auth.relationship})`,
      })
    }

    // 3. Handle Parent/Guardian QR Scan
    if (parsedType === 'GUARDIAN' || parsedType === 'PARENT') {
      const guardian = await db.guardian.findFirst({
        where: { id: parsedId, tenantId, deletedAt: null },
        include: {
          user: { select: { fullName: true, phone: true, email: true } },
          studentLinks: {
            include: {
              student: {
                select: { id: true, firstName: true, lastName: true, admissionNo: true, photoUrl: true },
              },
            },
          },
        },
      })

      if (!guardian) {
        await TransportSecurityService.logSecurityEvent(context, {
          eventType: 'UNAUTHORIZED_PICKUP_ATTEMPT',
          action: 'GUARDIAN_QR_SCAN',
          result: 'FAILED',
          reason: 'Guardian not found in tenant',
        })
        return ok({
          valid: false,
          scanType: 'GUARDIAN',
          status: 'INVALID_GUARDIAN',
          message: 'Guardian identity not found or tenant mismatch',
        })
      }

      const linkedStudents = guardian.studentLinks.map((s) => s.student)

      return ok({
        valid: true,
        scanType: 'GUARDIAN',
        status: 'VERIFIED',
        guardian: {
          id: guardian.id,
          name: guardian.fullName,
          phone: guardian.phone,
          relationship: guardian.relationship,
        },
        linkedStudents,
        message: `Guardian ${guardian.fullName} verified. Linked to ${linkedStudents.length} student(s).`,
      })
    }

    // 4. Handle Student QR Scan
    const studentIdToVerify = parsedType === 'STUDENT' ? parsedId : explicitStudentId || parsedId
    const student = await db.student.findFirst({
      where: { id: studentIdToVerify, tenantId, deletedAt: null },
      include: {
        guardians: {
          include: {
            guardian: { select: { id: true, fullName: true, phone: true, relationship: true } },
          },
        },
        transportAssignments: {
          where: { status: 'ACTIVE', deletedAt: null },
          include: { route: true, pickupStop: true, dropStop: true },
        },
      },
    })

    if (!student) {
      await TransportSecurityService.logSecurityEvent(context, {
        eventType: 'QR_SCAN',
        action: 'STUDENT_QR_SCAN',
        studentId: studentIdToVerify,
        result: 'FAILED',
        reason: 'Student not found in tenant',
      })
      return ok({
        valid: false,
        scanType: 'STUDENT',
        status: 'INVALID_STUDENT',
        message: 'Student record not found or tenant mismatch',
      })
    }

    const transportAssigned = student.transportAssignments.length > 0
    const activeAssignment = student.transportAssignments[0] || null

    // Check for today's active pickup authorization for this student
    const activeAuth = await db.transportPickupAuthorization.findFirst({
      where: {
        tenantId,
        studentId: student.id,
        status: 'APPROVED',
        validFrom: { lte: new Date() },
        validUntil: { gte: new Date() },
      },
    })

    return ok({
      valid: true,
      scanType: 'STUDENT',
      status: 'VERIFIED',
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        admissionNo: student.admissionNo,
        photoUrl: student.photoUrl,
      },
      transportAssigned,
      assignment: activeAssignment,
      guardians: student.guardians.map((g) => ({
        id: g.guardian.id,
        name: g.guardian.fullName,
        phone: g.guardian.phone,
        relationship: g.guardian.relationship,
      })),
      activeTemporaryAuthorization: activeAuth
        ? {
            ...activeAuth,
            authorizedPersonName: activeAuth.personName,
            authorizedPersonPhone: activeAuth.phone,
          }
        : null,
      message: transportAssigned
        ? `Student ${student.firstName} ${student.lastName || ''} is assigned to Route: ${activeAssignment.route.name}`
        : `Student ${student.firstName} ${student.lastName || ''} has no active transport assignment`,
    })
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const POST = withApi(_POST)
