import { NextRequest } from 'next/server'
import { SessionPayload, can } from './auth'
import { ROLE_META, normalizeRole } from './roles'
import { getSession } from './auth-server'
import { Errors, forbidden, notFound, bad } from './api'
import { AuditService } from './audit/audit-service'
import { db } from './db'
import { UserRole } from '@prisma/client'

/**
 * Guard for API route handlers — returns session or returns an HTTP Error Response.
 * Automatically audits AUTHORIZATION_FAILED on unauthorized access attempts.
 */
export async function requireApi(
  req: NextRequest,
  permission?: string
): Promise<SessionPayload | Response> {
  const session = await getSession(req)
  if (!session) return Errors.unauthorized()

  if (session.tenantId) {
    const tenantExists = await db.tenant.findUnique({ where: { id: session.tenantId }, select: { id: true } })
    if (!tenantExists) {
      return Errors.unauthorized('Invalid or expired session. Please log in again.')
    }
  }

  const effectiveRoles = session.roles && session.roles.length > 0 ? session.roles : [session.role]
  if (permission && !can(effectiveRoles, permission)) {
    // Record security event for unauthorized attempt
    await AuditService.recordSecurityEvent({
      action: 'AUTHORIZATION_FAILED',
      entity: 'Permission',
      entityId: permission,
      module: 'AUTH',
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
      tenantId: session.tenantId,
      summary: `Authorization denied for roles [${effectiveRoles.join(', ')}]: requires ${permission}`,
      severity: 'WARNING',
      req,
      details: {
        path: req.nextUrl.pathname,
        method: req.method,
        requiredPermission: permission,
        roles: effectiveRoles,
      },
    })

    return Errors.forbidden(`Missing permission: ${permission}`)
  }

  return session
}

export function isResponse(x: unknown): x is Response {
  return x instanceof Response
}

/**
 * Validates that the session belongs to an active tenant membership.
 */
export async function requireTenantMembership(
  session: SessionPayload,
  targetTenantId?: string
) {
  if (!session.tenantId) {
    return bad('Tenant identifier required', 'TENANT_REQUIRED')
  }
  if (targetTenantId && session.tenantId !== targetTenantId) {
    return forbidden('Cross-tenant access forbidden')
  }

  const membership = await db.tenantUser.findFirst({
    where: {
      userId: session.uid,
      tenantId: session.tenantId,
      deletedAt: null,
      status: 'ACTIVE',
    },
  })

  if (!membership && session.role !== 'PLATFORM_ADMIN') {
    return forbidden('Active tenant membership required')
  }

  return membership
}

/**
 * Verifies that the actor has access to the target branch.
 * Owners, Principals, and Platform Admins have institution-wide multi-campus access.
 */
export function requireBranchAccess(
  session: SessionPayload,
  targetBranchId?: string | null
): Response | null {
  if (!targetBranchId) return null

  const effectiveRoles = session.roles && session.roles.length > 0 ? session.roles : [session.role]
  const isInstitutionWide = effectiveRoles.some((r) =>
    ['OWNER', 'PRINCIPAL', 'PLATFORM_ADMIN'].includes(r)
  )
  if (isInstitutionWide) return null

  // If user is branch-scoped, they cannot access a different branch
  if (session.branchId && session.branchId !== targetBranchId) {
    return forbidden('Access denied: branch scope restricted')
  }

  return null
}

/**
 * Verifies that the actor has the authority to manage the target user.
 * - Non-owners cannot edit or delete OWNER accounts.
 * - Non-owners/principals cannot edit PRINCIPAL accounts.
 * - Branch-scoped staff cannot manage users assigned to other branches.
 */
export async function requireCanManageUser(
  session: SessionPayload,
  targetUserId: string
) {
  if (!session.tenantId) return bad('Tenant required', 'TENANT_REQUIRED')

  const targetMember = await db.tenantUser.findFirst({
    where: {
      tenantId: session.tenantId,
      deletedAt: null,
      OR: [{ userId: targetUserId }, { id: targetUserId }],
    },
    include: {
      user: {
        include: { staffProfile: true },
      },
    },
  })

  if (!targetMember) {
    return notFound('User not found in this school')
  }

  const isActorOwnerOrPlatform =
    session.role === 'OWNER' || session.role === 'PLATFORM_ADMIN'

  // Non-owners cannot modify OWNER users
  if (targetMember.role === 'OWNER' && !isActorOwnerOrPlatform) {
    return forbidden('Only owners can modify owner accounts')
  }

  // Non-owners/principals cannot modify PRINCIPAL accounts
  if (
    targetMember.role === 'PRINCIPAL' &&
    !isActorOwnerOrPlatform &&
    session.role !== 'PRINCIPAL'
  ) {
    return forbidden('You do not have permission to modify principal accounts')
  }

  // Branch boundary check
  if (
    session.branchId &&
    targetMember.branchId &&
    session.branchId !== targetMember.branchId &&
    !isActorOwnerOrPlatform &&
    session.role !== 'PRINCIPAL'
  ) {
    return forbidden('Cannot manage users belonging to another campus branch')
  }

  return { targetMember }
}

/**
 * Validates role assignment to prevent privilege escalation.
 */
export function requireCanAssignRole(
  session: SessionPayload,
  targetRoles: UserRole[]
): Response | null {
  const isOwnerOrPlatform =
    session.role === 'OWNER' || session.role === 'PLATFORM_ADMIN'

  const actorRole = normalizeRole(session.role)
  const actorLevel = ROLE_META[actorRole]?.hierarchyLevel ?? 0

  for (const r of targetRoles) {
    if (r === 'PLATFORM_ADMIN') {
      return forbidden('Cannot assign PLATFORM_ADMIN role')
    }
    if (r === 'OWNER' && !isOwnerOrPlatform) {
      return forbidden('Only owners can assign OWNER role')
    }
    if (
      r === 'PRINCIPAL' &&
      !isOwnerOrPlatform &&
      session.role !== 'PRINCIPAL'
    ) {
      return forbidden('Only owners and principals can assign PRINCIPAL role')
    }

    // General hierarchy: cannot assign a role with higher hierarchy than actor
    const targetNormalized = normalizeRole(r)
    const targetLevel = ROLE_META[targetNormalized]?.hierarchyLevel ?? 0
    if (!isOwnerOrPlatform && targetLevel >= actorLevel) {
      return forbidden(`Insufficient privileges to assign role: ${r}`)
    }
  }

  return null
}

/**
 * Verifies that a teacher has access to a specific classroom.
 */
export async function requireTeacherClassroomAccess(
  session: SessionPayload,
  classroomId: string
): Promise<boolean | Response> {
  const effectiveRoles = session.roles && session.roles.length > 0 ? session.roles : [session.role]
  const isSupervisory = effectiveRoles.some((r) =>
    ['OWNER', 'PRINCIPAL', 'PLATFORM_ADMIN'].includes(r)
  )
  if (isSupervisory) return true

  if (!session.tenantId) return forbidden('Tenant context required')

  const classroom = await db.classroom.findFirst({
    where: {
      id: classroomId,
      tenantId: session.tenantId,
      primaryTeacherId: session.uid,
    },
  })

  if (!classroom) {
    return forbidden('Access denied: you are not assigned as educator to this classroom')
  }

  return true
}

/**
 * Verifies that a parent has access to a specific student.
 */
export async function requireGuardianChildAccess(
  session: SessionPayload,
  studentId: string
): Promise<boolean | Response> {
  const effectiveRoles = session.roles && session.roles.length > 0 ? session.roles : [session.role]
  const isStaff = effectiveRoles.some((r) =>
    [
      'OWNER',
      'PRINCIPAL',
      'COORDINATOR',
      'TEACHER',
      'STAFF',
      'ACCOUNTS',
      'RECEPTIONIST',
      'ATTENDANT',
      'DRIVER',
      'PLATFORM_ADMIN',
    ].includes(normalizeRole(r))
  )
  if (isStaff) return true

  if (!session.tenantId) return forbidden('Tenant context required')

  const guardian = await db.guardian.findFirst({
    where: {
      userId: session.uid,
      tenantId: session.tenantId,
    },
    include: {
      studentLinks: {
        where: { studentId },
      },
    },
  })

  if (!guardian || guardian.studentLinks.length === 0) {
    return forbidden('Access denied: student is not linked to your guardian profile')
  }

  return true
}

/**
 * Validates authority and required justification for administrative overrides.
 */
export function requireCanOverride(
  session: SessionPayload,
  action: string,
  targetUserId: string,
  reason?: string
): Response | null {
  const canPerformOverride =
    session.role === 'OWNER' ||
    session.role === 'PRINCIPAL' ||
    session.role === 'PLATFORM_ADMIN'

  if (!canPerformOverride) {
    return forbidden('Administrative overrides require OWNER or PRINCIPAL authority')
  }

  if (!reason || reason.trim().length < 5) {
    return bad(
      'Override justification reason is mandatory and must be at least 5 characters',
      'OVERRIDE_REASON_REQUIRED'
    )
  }

  return null
}

