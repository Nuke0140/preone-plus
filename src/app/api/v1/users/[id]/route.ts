import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, notFound, bad, serverError, forbidden } from '@/lib/api'
import {
  requireApi,
  isResponse,
  requireCanManageUser,
  requireBranchAccess,
  requireCanAssignRole,
} from '@/lib/auth-api'
import { recordAudit, getRequestMeta } from '@/lib/audit'
import bcrypt from 'bcryptjs'
import { UserRole, UserStatus } from '@prisma/client'
import { normalizeRole } from '@/lib/roles'
import { UserLifecycleService } from '@/lib/users/user-lifecycle-service'
import { SessionService } from '@/lib/users/session-service'
import { PermissionCache } from '@/lib/cache/permission-cache'

/** GET /api/v1/users/[id] — get user details including linked profile, roles, and taught classes */
async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireApi(req, 'users:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return bad('Tenant required', 'TENANT_REQUIRED')

  const manageCheck = await requireCanManageUser(session, id)
  if (isResponse(manageCheck)) return manageCheck

  try {
    const member = await db.tenantUser.findFirst({
      where: {
        tenantId: session.tenantId,
        deletedAt: null,
        OR: [{ userId: id }, { id }],
      },
      include: {
        user: {
          include: {
            staffProfile: true,
            taughtClasses: {
              select: { id: true, name: true, programType: true, capacity: true },
            },
            guardianProfile: {
              include: {
                studentLinks: {
                  include: {
                    student: {
                      select: { id: true, firstName: true, lastName: true, admissionNo: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!member) return notFound('User not found in this school')

    const assignedRoles: UserRole[] =
      member.roles && member.roles.length > 0 ? member.roles : [member.role]

    return ok({
      id: member.id,
      userId: member.user.id,
      fullName: member.user.fullName,
      email: member.user.email,
      phone: member.user.phone,
      role: member.role,
      roles: assignedRoles,
      status: member.status,
      branchId: member.branchId,
      lastLoginAt: member.user.lastLoginAt,
      createdAt: member.createdAt,
      staffProfile: member.user.staffProfile,
      taughtClasses: member.user.taughtClasses,
      guardianProfile: member.user.guardianProfile
        ? {
            id: member.user.guardianProfile.id,
            relationship: member.user.guardianProfile.relationship,
            students: member.user.guardianProfile.studentLinks.map((sl) => ({
              id: sl.student.id,
              name: `${sl.student.firstName} ${sl.student.lastName || ''}`.trim(),
              admissionNo: sl.student.admissionNo,
              canPickup: sl.canPickup,
              receivesComm: sl.receivesComm,
              pickupPin: sl.pickupPin,
              relationship: sl.relationship || member.user.guardianProfile!.relationship,
            })),
          }
        : null,
    })
  } catch (err: any) {
    return serverError(err.message)
  }
}

/** PATCH /api/v1/users/[id] — update user profile, roles, scope, designation, or password */
async function _PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireApi(req, 'users:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return bad('Tenant required', 'TENANT_REQUIRED')

  const manageCheck = await requireCanManageUser(session, id)
  if (isResponse(manageCheck)) return manageCheck
  const { targetMember: member } = manageCheck

  try {
    const body = await req.json()
    const {
      fullName,
      phone,
      role,
      roles: inputRoles,
      primaryRole,
      status,
      branchId,
      classroomId,
      password,
      designation,
      employeeCode,
    } = body as {
      fullName?: string
      phone?: string
      role?: UserRole
      roles?: UserRole[]
      primaryRole?: UserRole
      status?: any
      branchId?: string | null
      classroomId?: string
      password?: string
      designation?: string
      employeeCode?: string
    }

    // Lifecycle status mutation validation and canonical routing
    let lifecycleStatusToApply: UserStatus | undefined
    if (status !== undefined) {
      const upperStatus = String(status).toUpperCase() as UserStatus
      if (!['ACTIVE', 'SUSPENDED', 'LOCKED', 'DEACTIVATED', 'ARCHIVED'].includes(upperStatus)) {
        return bad(
          `Invalid status: ${status}. Allowed: ACTIVE, SUSPENDED, LOCKED, DEACTIVATED, ARCHIVED`,
          'INVALID_STATUS'
        )
      }

      if (upperStatus !== member.status) {
        const validation = UserLifecycleService.validateTransition(
          member.status as string,
          upperStatus,
          member.role,
          session.role
        )
        if (!validation.valid) {
          if (validation.statusHttp === 403) return forbidden(validation.error!)
          return bad(validation.error!, validation.code!)
        }
        lifecycleStatusToApply = upperStatus
      }
    }

    // Determine target roles
    let targetRoles: UserRole[] | undefined
    if (inputRoles && Array.isArray(inputRoles) && inputRoles.length > 0) {
      targetRoles = [...new Set(inputRoles.map((r) => normalizeRole(r) as UserRole))]
    } else if (role) {
      targetRoles = [normalizeRole(role) as UserRole]
    }

    if (targetRoles) {
      const roleErr = requireCanAssignRole(session, targetRoles)
      if (roleErr) return roleErr
    }

    if (branchId) {
      const branchErr = requireBranchAccess(session, branchId)
      if (branchErr) return branchErr
    }

    const finalPrimaryRole: UserRole | undefined =
      targetRoles
        ? (primaryRole && targetRoles.includes(normalizeRole(primaryRole) as UserRole)
            ? (normalizeRole(primaryRole) as UserRole)
            : (role && targetRoles.includes(normalizeRole(role) as UserRole)
                ? (normalizeRole(role) as UserRole)
                : targetRoles[0]))
        : (role ? (normalizeRole(role) as UserRole) : primaryRole ? (normalizeRole(primaryRole) as UserRole) : undefined)

    const oldValues = {
      fullName: member.user.fullName,
      phone: member.user.phone,
      role: member.role,
      roles: member.roles,
      status: member.status,
      branchId: member.branchId,
      designation: member.user.staffProfile?.designation,
    }

    // Run updates in transaction
    const updatedMember = await db.$transaction(async (tx) => {
      if (fullName || phone !== undefined || password || lifecycleStatusToApply) {
        await tx.user.update({
          where: { id: member.userId },
          data: {
            ...(fullName ? { fullName: fullName.trim() } : {}),
            ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
            ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
            ...(lifecycleStatusToApply ? { status: lifecycleStatusToApply, updatedAt: new Date() } : {}),
          },
        })
      }

      const updated = await tx.tenantUser.update({
        where: { id: member.id },
        data: {
          ...(finalPrimaryRole ? { role: finalPrimaryRole } : {}),
          ...(targetRoles ? { roles: targetRoles } : {}),
          ...(lifecycleStatusToApply ? { status: lifecycleStatusToApply } : {}),
          ...(branchId !== undefined ? { branchId: branchId || null } : {}),
        },
        include: {
          user: {
            include: { staffProfile: true },
          },
        },
      })

      // If workforce designation or employeeCode provided, update or create StaffProfile
      const effectiveRoles = updated.roles && updated.roles.length > 0 ? updated.roles : [updated.role]
      const isStaff = effectiveRoles.some((r) =>
        ['OWNER', 'PRINCIPAL', 'COORDINATOR', 'TEACHER', 'STAFF', 'ACCOUNTS', 'RECEPTIONIST', 'ATTENDANT', 'DRIVER'].includes(normalizeRole(r))
      )

      if (isStaff || designation !== undefined || employeeCode !== undefined) {
        const existingProfile = await tx.staffProfile.findUnique({
          where: { userId: member.userId },
        })

        const empCode =
          employeeCode?.trim() ||
          existingProfile?.employeeCode ||
          member.user.staffProfile?.employeeCode ||
          `EMP-${Date.now().toString().slice(-4)}`

        if (existingProfile) {
          await tx.staffProfile.update({
            where: { id: existingProfile.id },
            data: {
              ...(employeeCode ? { employeeCode: empCode } : {}),
              ...(designation !== undefined ? { designation: designation?.trim() || null } : {}),
              ...(branchId !== undefined ? { branchId: branchId || null } : {}),
            },
          })
        } else {
          await tx.staffProfile.create({
            data: {
              tenantId: session.tenantId!,
              userId: member.userId,
              employeeCode: empCode,
              designation: designation?.trim() || null,
              branchId: branchId || null,
            },
          })
        }
      }

      // If classroomId provided and user has TEACHER role, assign as primaryTeacherId
      if (classroomId && effectiveRoles.includes('TEACHER')) {
        await tx.classroom.update({
          where: { id: classroomId, tenantId: session.tenantId! },
          data: { primaryTeacherId: member.userId },
        })
      }

      return updated
    })

    // If lifecycle status changed, invalidate sessions and record canonical lifecycle audit
    if (lifecycleStatusToApply) {
      await UserLifecycleService.revokeSessionsIfRestricted(member.userId, lifecycleStatusToApply)
      await UserLifecycleService.recordLifecycleAudit({
        tenantId: session.tenantId,
        branchId: updatedMember.branchId || undefined,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
        member: {
          userId: member.userId,
          role: member.role,
          user: { fullName: member.user.fullName },
        },
        previousStatus: member.status as string,
        targetStatus: lifecycleStatusToApply,
        reason: (body as any)?.reason,
        req,
      })
    }

    const newRoles: UserRole[] =
      updatedMember.roles && updatedMember.roles.length > 0
        ? updatedMember.roles
        : [updatedMember.role]

    const newValues = {
      fullName: updatedMember.user.fullName,
      phone: updatedMember.user.phone,
      role: updatedMember.role,
      roles: newRoles,
      status: updatedMember.status,
      branchId: updatedMember.branchId,
      designation: designation !== undefined ? designation : member.user.staffProfile?.designation,
    }

    const hasProfileOrRoleChanges =
      Boolean(fullName) ||
      phone !== undefined ||
      Boolean(password) ||
      Boolean(targetRoles) ||
      branchId !== undefined ||
      designation !== undefined ||
      employeeCode !== undefined ||
      Boolean(classroomId)

    // Only record UPDATE_USER if non-lifecycle profile fields changed or status was unchanged
    if (hasProfileOrRoleChanges || !lifecycleStatusToApply) {
      const meta = getRequestMeta(req)
      await recordAudit({
        tenantId: session.tenantId,
        branchId: updatedMember.branchId || undefined,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
        action: 'UPDATE_USER',
        entity: 'User',
        entityId: member.userId,
        module: 'Users',
        summary: `Updated user ${updatedMember.user.fullName} (roles: [${newRoles.join(', ')}], primary: ${updatedMember.role}, status: ${updatedMember.status})`,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        oldValues,
        newValues,
      })
    }

    return ok({
      id: updatedMember.id,
      userId: updatedMember.user.id,
      fullName: updatedMember.user.fullName,
      email: updatedMember.user.email,
      phone: updatedMember.user.phone,
      role: updatedMember.role,
      roles: newRoles,
      status: updatedMember.status,
      branchId: updatedMember.branchId,
    })
  } catch (err: any) {
    return serverError(err.message)
  }
}

/** DELETE /api/v1/users/[id] — deactivate user from school */
async function _DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireApi(req, 'users:write')
  if (isResponse(session)) return session
  const manageCheck = await requireCanManageUser(session, id)
  if (isResponse(manageCheck)) return manageCheck
  const { targetMember: member } = manageCheck

  try {
    if (member.role === 'OWNER') {
      return forbidden('Cannot delete school owner account')
    }

    // Soft delete membership and sync user deactivation
    await db.tenantUser.update({
      where: { id: member.id },
      data: {
        deletedAt: new Date(),
        status: 'INACTIVE',
      },
    })
    await db.user.update({
      where: { id: member.userId },
      data: {
        status: 'INACTIVE',
        updatedAt: new Date(),
      },
    })
    await SessionService.revokeAllUserSessions(member.userId)
    PermissionCache.bumpUserVersion(member.userId)

    const meta = getRequestMeta(req)
    await recordAudit({
      tenantId: session.tenantId,
      branchId: member.branchId || undefined,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
      action: 'DEACTIVATE_USER',
      entity: 'User',
      entityId: member.userId,
      module: 'Users',
      severity: 'WARNING',
      summary: `Deactivated user ${member.user.fullName} from school`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    })

    return ok({ deactivated: true })
  } catch (err: any) {
    return serverError(err.message)
  }
}

export const GET = withApi(_GET)
export const PATCH = withApi(_PATCH)
export const DELETE = withApi(_DELETE)
