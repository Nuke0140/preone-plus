import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportSecurityService } from '@/lib/transport/transport-security'

/**
 * GET /api/v1/transport/authorizations — List temporary pickup authorizations (role scoped)
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'transport:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get('studentId') || undefined
    const status = searchParams.get('status') || undefined

    const context = {
      tenantId: session.tenantId,
      branchId: session.branchId || undefined,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    }

    const scope = await TransportSecurityService.getRoleScopingFilter(context)

    if (scope.isParent) {
      if (studentId) {
        if (!scope.allowedStudentIds?.includes(studentId)) {
          return Errors.forbidden('Unauthorized access to unlinked student pickup authorizations')
        }
      } else if (scope.allowedStudentIds && scope.allowedStudentIds.length === 0) {
        return ok([])
      }
    }

    const authorizations = await TransportSecurityService.getPickupAuthorizations(context, { studentId, status: status as any })

    const filtered = scope.isParent && scope.allowedStudentIds !== null
      ? authorizations.filter((a: any) => scope.allowedStudentIds?.includes(a.studentId))
      : scope.isDriver && scope.allowedStudentIds !== null
      ? authorizations.filter((a: any) => scope.allowedStudentIds?.includes(a.studentId))
      : authorizations

    return ok(filtered)
  } catch (e: any) {
    return Errors.system(e)
  }
}

/**
 * POST /api/v1/transport/authorizations — Create a temporary pickup authorization (with student relationship validation)
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'transport:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json().catch(() => ({}))
    const {
      studentId,
      guardianId,
      authorizedPersonName,
      authorizedPersonPhone,
      relationship,
      reason,
      validFrom,
      validUntil,
      isOneTime,
      remarks,
    } = body

    if (!studentId || !authorizedPersonName || !authorizedPersonPhone || !validFrom || !validUntil) {
      return Errors.validation('studentId, authorizedPersonName, authorizedPersonPhone, validFrom, and validUntil are required')
    }

    const context = {
      tenantId: session.tenantId,
      branchId: session.branchId || undefined,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    }

    // Validate that parent/guardian is linked to student
    const hasAccess = await TransportSecurityService.validateStudentAccess(context, studentId)
    if (!hasAccess) {
      return Errors.forbidden('You are not authorized to create pickup authorizations for this student')
    }

    const authorization = await TransportSecurityService.createPickupAuthorization(context, {
      studentId,
      guardianId,
      personName: authorizedPersonName,
      phone: authorizedPersonPhone,
      relationship,
      reason,
      validFrom: new Date(validFrom),
      validUntil: new Date(validUntil),
      isOneTime: isOneTime !== undefined ? Boolean(isOneTime) : true,
      remarks,
    })

    return ok({ authorization }, undefined, 201)
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
