import { db } from '@/lib/db'
import { recordAudit, getRequestMeta } from '@/lib/audit'
import { UserStatus, Prisma } from '@prisma/client'
import { SessionService } from '@/lib/users/session-service'
import { PermissionCache } from '@/lib/cache/permission-cache'
import { NextRequest } from 'next/server'

export type LifecycleActionType =
  | 'activate'
  | 'suspend'
  | 'unlock'
  | 'reactivate'
  | 'deactivate'
  | 'archive'

export const LIFECYCLE_ACTION_MAP: Record<LifecycleActionType, UserStatus> = {
  activate: 'ACTIVE',
  suspend: 'SUSPENDED',
  unlock: 'ACTIVE',
  reactivate: 'ACTIVE',
  deactivate: 'DEACTIVATED',
  archive: 'ARCHIVED',
}

export const VALID_LIFECYCLE_TRANSITIONS: Record<string, UserStatus[]> = {
  ACTIVE: ['SUSPENDED', 'LOCKED', 'DEACTIVATED'],
  SUSPENDED: ['ACTIVE', 'DEACTIVATED'],
  LOCKED: ['ACTIVE', 'DEACTIVATED'],
  DEACTIVATED: ['ACTIVE', 'ARCHIVED'],
  ARCHIVED: [], // Terminal state
  // Legacy states backward compatibility
  INACTIVE: ['ACTIVE', 'DEACTIVATED'],
  PENDING: ['ACTIVE', 'DEACTIVATED'],
}

export interface TransitionValidationResult {
  valid: boolean
  error?: string
  code?: string
  statusHttp?: number
}

export interface TransitionStatusParams {
  member: {
    id: string
    userId: string
    role: string
    status: string
    branchId?: string | null
    user: {
      fullName: string
    }
  }
  actorSession: {
    uid: string
    name: string
    role: string
    tenantId?: string | null
  }
  targetStatus?: UserStatus
  action?: LifecycleActionType | string
  reason?: string
  req?: Request | NextRequest | null
  tx?: Prisma.TransactionClient
}

export type TransitionExecutionResult =
  | {
      success: true
      userId: string
      status: UserStatus
      updatedAt?: Date
      unchanged?: boolean
    }
  | {
      success: false
      error: string
      code: string
      statusHttp: number
    }

export class UserLifecycleService {
  /**
   * Resolves target UserStatus from action keyword or explicit status string.
   */
  static resolveTargetStatus(
    action?: string | null,
    explicitStatus?: UserStatus | null
  ): { targetStatus?: UserStatus; error?: string } {
    if (action) {
      const mapped = LIFECYCLE_ACTION_MAP[action.toLowerCase() as LifecycleActionType]
      if (!mapped) {
        return {
          error: `Invalid lifecycle action: ${action}. Allowed: ${Object.keys(LIFECYCLE_ACTION_MAP).join(', ')}`,
        }
      }
      return { targetStatus: mapped }
    }

    if (explicitStatus) {
      return { targetStatus: explicitStatus }
    }

    return { error: 'Either action or status must be provided' }
  }

  /**
   * Validates if a state transition is permitted by policy and the canonical state machine.
   */
  static validateTransition(
    previousStatus: string,
    targetStatus: UserStatus,
    targetRole: string,
    actorRole: string
  ): TransitionValidationResult {
    if (targetRole === 'OWNER' && actorRole !== 'OWNER' && actorRole !== 'PLATFORM_ADMIN') {
      return {
        valid: false,
        error: 'Only owners can modify school owner account status',
        code: 'FORBIDDEN',
        statusHttp: 403,
      }
    }

    if (previousStatus === 'ARCHIVED') {
      return {
        valid: false,
        error: 'Archived user accounts cannot be modified',
        code: 'ACCOUNT_ARCHIVED_IMMUTABLE',
        statusHttp: 400,
      }
    }

    if (previousStatus === targetStatus) {
      return { valid: true }
    }

    const allowed = VALID_LIFECYCLE_TRANSITIONS[previousStatus] || []
    if (!allowed.includes(targetStatus)) {
      return {
        valid: false,
        error: `Cannot transition user status from ${previousStatus} to ${targetStatus}. Allowed transitions: ${allowed.join(', ') || 'None'}`,
        code: 'INVALID_STATE_TRANSITION',
        statusHttp: 400,
      }
    }

    return { valid: true }
  }

  /**
   * Immediately invalidates active sessions and permission cache for restricted lifecycle states.
   */
  static async revokeSessionsIfRestricted(userId: string, targetStatus: UserStatus): Promise<void> {
    if (['SUSPENDED', 'LOCKED', 'DEACTIVATED', 'ARCHIVED'].includes(targetStatus)) {
      await SessionService.revokeAllUserSessions(userId)
      PermissionCache.bumpUserVersion(userId)
    }
  }

  /**
   * Records canonical audit log for user lifecycle status transition.
   */
  static async recordLifecycleAudit(params: {
    tenantId?: string | null
    branchId?: string | null
    actorId: string
    actorName: string
    actorRole: string
    member: {
      userId: string
      role: string
      user: { fullName: string }
    }
    previousStatus: string
    targetStatus: UserStatus
    action?: string
    reason?: string
    req?: Request | NextRequest | null
  }): Promise<void> {
    let auditAction = 'UPDATE_USER_STATUS'
    if (params.action) {
      auditAction = `USER_${params.action.toUpperCase()}`
    } else {
      const statusActionMap: Record<string, string> = {
        ACTIVE: params.previousStatus === 'LOCKED' ? 'USER_UNLOCKED' : 'USER_ACTIVATED',
        SUSPENDED: 'USER_SUSPENDED',
        LOCKED: 'USER_LOCKED',
        DEACTIVATED: 'USER_DEACTIVATED',
        ARCHIVED: 'USER_ARCHIVED',
      }
      auditAction = statusActionMap[params.targetStatus] || 'UPDATE_USER_STATUS'
    }

    const meta = getRequestMeta(params.req)
    await recordAudit({
      tenantId: params.tenantId || null,
      branchId: params.branchId || undefined,
      actorId: params.actorId,
      actorName: params.actorName,
      actorRole: params.actorRole,
      action: auditAction,
      entity: 'User',
      entityId: params.member.userId,
      module: 'USERS',
      severity: ['SUSPENDED', 'LOCKED', 'DEACTIVATED', 'ARCHIVED'].includes(params.targetStatus)
        ? 'WARNING'
        : 'INFO',
      summary: `Transitioned user ${params.member.user.fullName} (${params.member.role}) from ${params.previousStatus} to ${params.targetStatus}${params.reason ? `: ${params.reason}` : ''}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      oldValues: { status: params.previousStatus },
      newValues: { status: params.targetStatus, action: params.action, reason: params.reason },
    })
  }

  /**
   * Canonical execution entry point for user lifecycle status transitions.
   * Atomically validates, persists status to both TenantUser and User, revokes sessions, and records audit.
   */
  static async transitionUserStatus(params: TransitionStatusParams): Promise<TransitionExecutionResult> {
    const { member, actorSession, action, reason, req, tx: externalTx } = params

    const { targetStatus, error: resolveErr } = this.resolveTargetStatus(action, params.targetStatus)
    if (resolveErr || !targetStatus) {
      return {
        success: false,
        error: resolveErr || 'Status resolution failed',
        code: action ? 'INVALID_ACTION' : 'STATUS_OR_ACTION_REQUIRED',
        statusHttp: 400,
      }
    }

    const previousStatus = member.status as string

    if (previousStatus === targetStatus) {
      return {
        success: true,
        userId: member.userId,
        status: member.status as UserStatus,
        unchanged: true,
      }
    }

    const validation = this.validateTransition(
      previousStatus,
      targetStatus,
      member.role,
      actorSession.role
    )
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error!,
        code: validation.code!,
        statusHttp: validation.statusHttp!,
      }
    }

    // Persist in transaction
    const executeInTx = async (tx: Prisma.TransactionClient) => {
      const tu = await tx.tenantUser.update({
        where: { id: member.id },
        data: { status: targetStatus },
      })

      await tx.user.update({
        where: { id: member.userId },
        data: { status: targetStatus, updatedAt: new Date() },
      })

      return tu
    }

    const updatedMember = externalTx ? await executeInTx(externalTx) : await db.$transaction(executeInTx)

    // Revoke sessions for restricted lifecycle states
    await this.revokeSessionsIfRestricted(member.userId, targetStatus)

    // Record canonical audit event
    await this.recordLifecycleAudit({
      tenantId: actorSession.tenantId,
      branchId: member.branchId,
      actorId: actorSession.uid,
      actorName: actorSession.name,
      actorRole: actorSession.role,
      member,
      previousStatus,
      targetStatus,
      action: typeof action === 'string' ? action : undefined,
      reason,
      req,
    })

    return {
      success: true,
      userId: member.userId,
      status: updatedMember.status as UserStatus,
      updatedAt: updatedMember.updatedAt,
    }
  }
}
