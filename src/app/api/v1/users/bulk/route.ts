import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { ok, bad, forbidden, errValidation, errAuth } from '@/lib/api'
import { withApi } from '@/lib/with-api'
import { requireApi, isResponse, requireBranchAccess, requireCanAssignRole } from '@/lib/auth-api'
import { recordAudit, getRequestMeta } from '@/lib/audit'
import { UserRole } from '@prisma/client'
import { SessionService } from '@/lib/users/session-service'
import { PermissionCache } from '@/lib/cache/permission-cache'

export type BulkAction =
  | 'ACTIVATE'
  | 'SUSPEND'
  | 'DEACTIVATE'
  | 'ASSIGN_ROLE'
  | 'REMOVE_ROLE'
  | 'CHANGE_BRANCH'
  | 'CHANGE_DESIGNATION'
  | 'ASSIGN_CLASSROOM'
  | 'REVOKE_SESSIONS'
  | 'UPDATE_PROFILE'

interface BulkRequest {
  action: BulkAction
  userIds: string[]
  mode?: 'PREVIEW' | 'EXECUTE'
  role?: UserRole
  roles?: UserRole[]
  isPrimary?: boolean
  branchId?: string | null
  designation?: string
  department?: string
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  classroomId?: string
  reason?: string
  changes?: {
    role?: UserRole
    roles?: UserRole[]
    branchId?: string | null
    designation?: string
    department?: string
    status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  }
}

export interface BlockedUserRecord {
  userId: string
  reason: string
}

/**
 * POST /api/v1/users/bulk — enterprise batch management with preview, validation, and execution
 */
export const POST = withApi(async (req: NextRequest) => {
  const session = await requireApi(req, 'users:write')
  if (isResponse(session)) return session
  if (!session.tenantId) throw errAuth('Tenant required')

  const body = (await req.json()) as BulkRequest
  const {
    action,
      userIds,
      mode = 'EXECUTE',
      role,
      roles,
      isPrimary,
      branchId,
      designation,
      department,
      status,
      classroomId,
      reason,
      changes,
    } = body

    if (!action || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return bad('Valid action and non-empty userIds array are required', 'INVALID_BULK_REQUEST')
    }

    const bulkOperationId = randomUUID()

    // Normalize changes for UPDATE_PROFILE
    const effectiveRole = changes?.role ?? role
    const effectiveRoles = changes?.roles ?? roles ?? (effectiveRole ? [effectiveRole] : undefined)
    const effectiveBranchId = changes?.branchId !== undefined ? changes.branchId : branchId
    const effectiveDesignation = changes?.designation !== undefined ? changes.designation : designation
    const effectiveDepartment = changes?.department !== undefined ? changes.department : department
    const effectiveStatus = changes?.status ?? status

    // Validate global role restrictions for ASSIGN_ROLE / REMOVE_ROLE / UPDATE_PROFILE
    if (action === 'ASSIGN_ROLE') {
      if (!role) return bad('Role is required for ASSIGN_ROLE', 'ROLE_REQUIRED')
      const roleErr = requireCanAssignRole(session, [role])
      if (roleErr) return roleErr
    }

    if (action === 'UPDATE_PROFILE') {
      if (effectiveRoles && effectiveRoles.length > 0) {
        const roleErr = requireCanAssignRole(session, effectiveRoles)
        if (roleErr) return roleErr
      } else if (effectiveRole) {
        const roleErr = requireCanAssignRole(session, [effectiveRole])
        if (roleErr) return roleErr
      }
    }

    if (action === 'REMOVE_ROLE') {
      if (!role) return bad('Role is required for REMOVE_ROLE', 'ROLE_REQUIRED')
      const isActorOwnerOrPlatform = session.role === 'OWNER' || session.role === 'PLATFORM_ADMIN'
      if (role === 'OWNER' && !isActorOwnerOrPlatform) {
        return forbidden('Only owners can remove OWNER role')
      }
    }

    // Validate target branch if provided
    const targetBranchId = action === 'UPDATE_PROFILE' ? effectiveBranchId : (action === 'CHANGE_BRANCH' ? branchId : undefined)
    if (targetBranchId) {
      const branchErr = requireBranchAccess(session, targetBranchId)
      if (branchErr) return branchErr

      const branch = await db.branch.findFirst({
        where: { id: targetBranchId, tenantId: session.tenantId, deletedAt: null },
      })
      if (!branch) return bad('Selected branch does not exist', 'BRANCH_NOT_FOUND')
    }

    // Validate classroom if provided
    if (action === 'ASSIGN_CLASSROOM') {
      if (!classroomId) return bad('ClassroomId is required for ASSIGN_CLASSROOM', 'CLASSROOM_REQUIRED')
      const classroom = await db.classroom.findFirst({
        where: { id: classroomId, tenantId: session.tenantId },
      })
      if (!classroom) return bad('Selected classroom does not exist', 'CLASSROOM_NOT_FOUND')
    }

    // 1. Fetch matching TenantUsers in current tenant
    const members = await db.tenantUser.findMany({
      where: {
        userId: { in: userIds },
        tenantId: session.tenantId,
        deletedAt: null,
      },
      include: {
        user: {
          include: { staffProfile: true },
        },
      },
    })

    const memberMap = new Map<string, (typeof members)[number]>(members.map((m) => [m.userId, m]))
    const isActorOwnerOrPlatform = session.role === 'OWNER' || session.role === 'PLATFORM_ADMIN'

    const blocked: BlockedUserRecord[] = []
    const eligibleMembers: typeof members = []

    for (const uid of userIds) {
      const m = memberMap.get(uid)
      if (!m) {
        blocked.push({ userId: uid, reason: 'USER_NOT_FOUND' })
        continue
      }

      // Owner accounts protected from non-owners
      if (m.role === 'OWNER' && !isActorOwnerOrPlatform) {
        blocked.push({ userId: uid, reason: 'CANNOT_MODIFY_OWNER' })
        continue
      }

      // Principal accounts protected from staff other than Owner/Principal
      if (m.role === 'PRINCIPAL' && !isActorOwnerOrPlatform && session.role !== 'PRINCIPAL') {
        blocked.push({ userId: uid, reason: 'CANNOT_MODIFY_PRINCIPAL' })
        continue
      }

      // Branch boundary check for branch-scoped operators
      if (
        session.branchId &&
        m.branchId &&
        session.branchId !== m.branchId &&
        !isActorOwnerOrPlatform &&
        session.role !== 'PRINCIPAL'
      ) {
        blocked.push({ userId: uid, reason: 'CROSS_BRANCH_FORBIDDEN' })
        continue
      }

      // Action-specific validations
      if (action === 'REMOVE_ROLE' && role) {
        const currentRoles = m.roles && m.roles.length > 0 ? m.roles : [m.role]
        const remainingRoles = currentRoles.filter((r) => r !== role)
        if (remainingRoles.length === 0) {
          blocked.push({ userId: uid, reason: 'CANNOT_LEAVE_ZERO_ROLES' })
          continue
        }
      }

      if (action === 'ASSIGN_CLASSROOM') {
        const currentRoles = m.roles && m.roles.length > 0 ? m.roles : [m.role]
        if (!currentRoles.includes('TEACHER')) {
          blocked.push({ userId: uid, reason: 'NOT_A_TEACHER' })
          continue
        }
      }

      eligibleMembers.push(m)
    }

    const reasons: Record<string, number> = {}
    for (const b of blocked) {
      reasons[b.reason] = (reasons[b.reason] || 0) + 1
    }

    const skippedUserIds = blocked.map((b) => b.userId)
    const affectedUserIds = eligibleMembers.map((m) => m.userId)

    // PREVIEW MODE — Return analysis without making any database changes
    if (mode === 'PREVIEW') {
      return ok({
        success: true,
        action,
        mode: 'PREVIEW',
        bulkOperationId,
        selected: userIds.length,
        affected: affectedUserIds,
        blocked,
        reasons,
        updatedCount: affectedUserIds.length,
        affectedUserIds,
        skippedUserIds,
      })
    }

    // EXECUTE MODE
    if (eligibleMembers.length === 0) {
      return forbidden('No eligible users could be modified for this bulk operation')
    }

    const meta = getRequestMeta(req)

    // 2. Perform requested bulk action in atomic transaction
    await db.$transaction(async (tx) => {
      switch (action) {
        case 'ACTIVATE': {
          for (const m of eligibleMembers) {
            await tx.tenantUser.update({
              where: { id: m.id },
              data: { status: 'ACTIVE' },
            })
            await tx.user.update({
              where: { id: m.userId },
              data: { status: 'ACTIVE' },
            })
          }
          break
        }

        case 'SUSPEND': {
          for (const m of eligibleMembers) {
            await tx.tenantUser.update({
              where: { id: m.id },
              data: { status: 'SUSPENDED' },
            })
            await tx.user.update({
              where: { id: m.userId },
              data: { status: 'SUSPENDED', updatedAt: new Date() },
            })
          }
          break
        }

        case 'DEACTIVATE': {
          for (const m of eligibleMembers) {
            await tx.tenantUser.update({
              where: { id: m.id },
              data: { status: 'INACTIVE' },
            })
            await tx.user.update({
              where: { id: m.userId },
              data: { status: 'INACTIVE', updatedAt: new Date() },
            })
          }
          break
        }

        case 'ASSIGN_ROLE': {
          for (const m of eligibleMembers) {
            const currentRoles = m.roles && m.roles.length > 0 ? m.roles : [m.role]
            const newRoles = Array.from(new Set([...currentRoles, role!]))
            const newPrimaryRole = isPrimary ? role! : m.role

            await tx.tenantUser.update({
              where: { id: m.id },
              data: {
                role: newPrimaryRole,
                roles: newRoles,
              },
            })
          }
          break
        }

        case 'REMOVE_ROLE': {
          for (const m of eligibleMembers) {
            const currentRoles = m.roles && m.roles.length > 0 ? m.roles : [m.role]
            const remainingRoles = currentRoles.filter((r) => r !== role!)
            if (remainingRoles.length === 0) continue

            const newPrimaryRole = m.role === role ? remainingRoles[0] : m.role

            await tx.tenantUser.update({
              where: { id: m.id },
              data: {
                role: newPrimaryRole,
                roles: remainingRoles,
              },
            })
          }
          break
        }

        case 'CHANGE_BRANCH': {
          for (const m of eligibleMembers) {
            await tx.tenantUser.update({
              where: { id: m.id },
              data: { branchId: branchId || null },
            })
            if (m.user.staffProfile) {
              await tx.staffProfile.update({
                where: { id: m.user.staffProfile.id },
                data: { branchId: branchId || null },
              })
            }
          }
          break
        }

        case 'CHANGE_DESIGNATION': {
          const desig = designation !== undefined ? designation.trim() || null : undefined
          const dept = department !== undefined ? department.trim() || null : undefined

          for (const m of eligibleMembers) {
            if (m.user.staffProfile) {
              await tx.staffProfile.update({
                where: { id: m.user.staffProfile.id },
                data: {
                  ...(desig !== undefined ? { designation: desig } : {}),
                  ...(dept !== undefined ? { department: dept } : {}),
                },
              })
            } else {
              await tx.staffProfile.create({
                data: {
                  tenantId: session.tenantId!,
                  userId: m.userId,
                  employeeCode: `EMP-${Date.now().toString().slice(-4)}-${m.userId.slice(0, 3)}`,
                  designation: desig || null,
                  department: dept || null,
                  branchId: m.branchId,
                },
              })
            }
          }
          break
        }

        case 'ASSIGN_CLASSROOM': {
          for (const tm of eligibleMembers) {
            await tx.classroom.update({
              where: { id: classroomId! },
              data: { primaryTeacherId: tm.userId },
            })
          }
          break
        }

        case 'REVOKE_SESSIONS': {
          for (const m of eligibleMembers) {
            await tx.user.update({
              where: { id: m.userId },
              data: { updatedAt: new Date() },
            })
          }
          break
        }

        case 'UPDATE_PROFILE': {
          for (const m of eligibleMembers) {
            // Update TenantUser fields
            const tenantUserData: any = {}
            if (effectiveRole) tenantUserData.role = effectiveRole
            if (effectiveRoles && effectiveRoles.length > 0) {
              tenantUserData.roles = effectiveRoles
              if (!effectiveRole) tenantUserData.role = effectiveRoles[0]
            }
            if (effectiveBranchId !== undefined) {
              tenantUserData.branchId = effectiveBranchId || null
            }
            if (effectiveStatus) {
              tenantUserData.status = effectiveStatus
              if (effectiveStatus === 'INACTIVE') {
                tenantUserData.deletedAt = new Date()
              } else {
                tenantUserData.deletedAt = null
              }
            }

            if (Object.keys(tenantUserData).length > 0) {
              await tx.tenantUser.update({
                where: { id: m.id },
                data: tenantUserData,
              })
            }

            // Sync User status if status changed
            if (effectiveStatus) {
              await tx.user.update({
                where: { id: m.userId },
                data: {
                  status: effectiveStatus,
                  ...(effectiveStatus === 'INACTIVE' ? { deletedAt: new Date() } : { deletedAt: null }),
                  updatedAt: new Date(),
                },
              })
            }

            // Update or create StaffProfile for designation/department/branch
            if (
              effectiveDesignation !== undefined ||
              effectiveDepartment !== undefined ||
              effectiveBranchId !== undefined
            ) {
              const desig = effectiveDesignation !== undefined ? effectiveDesignation.trim() || null : undefined
              const dept = effectiveDepartment !== undefined ? effectiveDepartment.trim() || null : undefined
              const brId = effectiveBranchId !== undefined ? effectiveBranchId || null : undefined

              if (m.user.staffProfile) {
                await tx.staffProfile.update({
                  where: { id: m.user.staffProfile.id },
                  data: {
                    ...(desig !== undefined ? { designation: desig } : {}),
                    ...(dept !== undefined ? { department: dept } : {}),
                    ...(brId !== undefined ? { branchId: brId } : {}),
                  },
                })
              } else if (desig || dept || brId) {
                await tx.staffProfile.create({
                  data: {
                    tenantId: session.tenantId!,
                    userId: m.userId,
                    employeeCode: `EMP-${Date.now().toString().slice(-4)}-${m.userId.slice(0, 3)}`,
                    designation: desig || null,
                    department: dept || null,
                    branchId: brId || m.branchId,
                  },
                })
              }
            }
          }
          break
        }

        default:
          throw errValidation(`Unsupported bulk action: ${action}`, 'action')
      }
    })

    // Invalidate sessions for users transitioned to restricted states
    if (
      action === 'SUSPEND' ||
      action === 'DEACTIVATE' ||
      effectiveStatus === 'INACTIVE' ||
      effectiveStatus === 'SUSPENDED'
    ) {
      for (const m of eligibleMembers) {
        await SessionService.revokeAllUserSessions(m.userId)
        PermissionCache.bumpUserVersion(m.userId)
      }
    }

    // 3. Record AuditLog with bulkOperationId and before/after details
    await recordAudit({
      tenantId: session.tenantId,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
      action: `BULK_${action}`,
      entity: 'User',
      module: 'Users',
      severity: action === 'SUSPEND' || action === 'DEACTIVATE' || effectiveStatus === 'INACTIVE' ? 'WARNING' : 'INFO',
      summary: `Bulk executed ${action} on ${affectedUserIds.length} users (Operation ${bulkOperationId})${reason ? ` (${reason})` : ''}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      newValues: {
        bulkOperationId,
        action,
        affectedUserIds,
        skippedUserIds,
        blocked,
        reasons,
        role: effectiveRole,
        roles: effectiveRoles,
        branchId: effectiveBranchId,
        designation: effectiveDesignation,
        department: effectiveDepartment,
        status: effectiveStatus,
        classroomId,
      },
    })

    return ok({
      success: true,
      action,
      mode: 'EXECUTE',
      bulkOperationId,
      selected: userIds.length,
      affected: affectedUserIds,
      blocked,
      reasons,
      updatedCount: affectedUserIds.length,
      affectedUserIds,
      skippedUserIds,
    })
}, { module: 'users', permission: 'users:write' })
