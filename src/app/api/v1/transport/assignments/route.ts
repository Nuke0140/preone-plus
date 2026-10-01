import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportService } from '@/lib/transport/transport-service'

import { TransportSecurityService } from '@/lib/transport/transport-security'

/**
 * GET /api/v1/transport/assignments — List student transport assignments with role scoping
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'transport:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const { searchParams } = new URL(req.url)
    let routeId = searchParams.get('routeId') || undefined
    let studentId = searchParams.get('studentId') || undefined
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
          return Errors.forbidden('Unauthorized access to unlinked student transport data')
        }
      } else if (scope.allowedStudentIds && scope.allowedStudentIds.length === 0) {
        return ok([])
      }
    }

    if (scope.isDriver) {
      if (routeId) {
        if (!scope.allowedRouteIds?.includes(routeId)) {
          return Errors.forbidden('Unauthorized access to unassigned transport route')
        }
      } else if (scope.allowedRouteIds && scope.allowedRouteIds.length === 0) {
        return ok([])
      }
    }

    const assignments = await TransportService.listAssignments(context, {
      routeId,
      studentId,
      status: status as any,
    })

    // Extra filtering for parent role if multiple linked students exist
    const filtered = scope.isParent && scope.allowedStudentIds !== null
      ? assignments.filter((a: any) => scope.allowedStudentIds?.includes(a.studentId))
      : scope.isDriver && scope.allowedRouteIds !== null
      ? assignments.filter((a: any) => scope.allowedRouteIds?.includes(a.routeId))
      : assignments

    return ok(filtered)
  } catch (e: any) {
    return Errors.system(e)
  }
}

/**
 * POST /api/v1/transport/assignments — Assign student to transport route
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'transport:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json().catch(() => ({}))
    const { studentId, routeId, pickupStopId, dropStopId, transportType, tripType, startDate, endDate, notes } = body

    if (!studentId || !routeId) {
      return Errors.validation('studentId and routeId are required')
    }

    const assignment = await TransportService.assignStudentToRoute(
      {
        tenantId: session.tenantId,
        branchId: session.branchId || undefined,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      {
        studentId,
        routeId,
        pickupStopId,
        dropStopId,
        tripType: (tripType || transportType) as any,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      }
    )

    return ok({ assignment }, undefined, 201)
  } catch (e: any) {
    if (e.message?.includes('already has an active')) {
      return Errors.conflict('ASSIGNMENT_EXISTS', e.message)
    }
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
