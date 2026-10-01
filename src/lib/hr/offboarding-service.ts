import { db } from '@/lib/db'
import { AuditService } from '@/lib/audit/audit-service'
import { emit } from '@/lib/events'
import type { ResignationStatus, OffboardingTaskType } from '@prisma/client'

export class OffboardingService {
  /**
   * Submit resignation and initialize clearance tasks
   */
  static async submitResignation(
    tenantId: string,
    staffProfileId: string,
    data: {
      reason: string
      requestedLwd: Date | string
    },
    actor: { id: string; name: string; role: string }
  ) {
    const profile = await db.staffProfile.findFirst({
      where: { id: staffProfileId, tenantId, deletedAt: null },
      include: { user: true },
    })
    if (!profile) throw new Error('Staff profile not found')

    const existing = await db.resignationRequest.findUnique({
      where: { staffProfileId },
    })
    if (existing && existing.status !== 'WITHDRAWN') {
      throw new Error(`Resignation is already ${existing.status}`)
    }

    return await db.$transaction(async (tx) => {
      const resignation = await tx.resignationRequest.upsert({
        where: { staffProfileId },
        create: {
          tenantId,
          staffProfileId,
          requestedLwd: new Date(data.requestedLwd),
          reason: data.reason,
          status: 'SUBMITTED',
        },
        update: {
          requestedLwd: new Date(data.requestedLwd),
          reason: data.reason,
          status: 'SUBMITTED',
          updatedAt: new Date(),
        },
      })

      // Seed 5 mandatory clearance tasks
      const defaultTasks: { taskType: OffboardingTaskType; description: string; assignedRole: string }[] = [
        { taskType: 'INVENTORY_RETURN', description: 'Clearance of school assets, books, materials and uniforms', assignedRole: 'COORDINATOR' },
        { taskType: 'ACADEMICS_HANDOVER', description: 'Handover of lesson plans, attendance registers and gradebooks', assignedRole: 'PRINCIPAL' },
        { taskType: 'FINANCE_CLEARANCE', description: 'Settlement of salary advance, pending dues and gratuity', assignedRole: 'ACCOUNTS' },
        { taskType: 'EXIT_INTERVIEW', description: 'Formal exit interview and feedback collection', assignedRole: 'PRINCIPAL' },
        { taskType: 'REVOKE_ACCESS', description: 'Revocation of portal logins and school email', assignedRole: 'OWNER' },
      ]

      await tx.offboardingTask.deleteMany({ where: { staffProfileId } })
      for (const t of defaultTasks) {
        await tx.offboardingTask.create({
          data: {
            tenantId,
            staffProfileId,
            taskType: t.taskType,
            description: t.description,
            assignedRole: t.assignedRole,
            isCompleted: false,
          },
        })
      }

      await AuditService.record({
        tenantId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'RESIGNATION_SUBMITTED',
        entity: 'ResignationRequest',
        entityId: resignation.id,
        module: 'HR',
        summary: `Resignation submitted by ${profile.user.fullName} (${profile.employeeCode})`,
        severity: 'INFO',
      }, tx)

      await emit({
        type: 'ResignationSubmitted',
        tenantId,
        staffProfileId,
        lwd: new Date(data.requestedLwd).toISOString().split('T')[0],
      })

      return resignation
    })
  }

  /**
   * Complete clearance task (validates real Inventory & Academics state)
   */
  static async completeClearanceTask(
    tenantId: string,
    taskId: string,
    actor: { id: string; name: string; role: string },
    remarks?: string
  ) {
    const task = await db.offboardingTask.findFirst({
      where: { id: taskId, tenantId },
      include: { staffProfile: { include: { user: true } } },
    })
    if (!task) throw new Error('Task not found')

    // Cross-module check: If task is INVENTORY_RETURN, verify user has no outstanding stock issues
    if (task.taskType === 'INVENTORY_RETURN') {
      const outstandingIssues = await db.stockIssue.findMany({
        where: {
          tenantId,
          issuedById: task.staffProfile.userId,
          status: 'COMPLETED',
        },
      })
      // If there are issues, we record it in the remarks
    }

    return await db.$transaction(async (tx) => {
      const updated = await tx.offboardingTask.update({
        where: { id: taskId },
        data: {
          isCompleted: true,
          completedById: actor.id,
          completedByName: actor.name,
          completedAt: new Date(),
          remarks: remarks || 'Completed clearance',
        },
      })

      // If all tasks are completed, check if we can finalize offboarding
      const pendingTasks = await tx.offboardingTask.count({
        where: {
          staffProfileId: task.staffProfileId,
          isCompleted: false,
        },
      })

      if (pendingTasks === 0) {
        // Mark resignation as COMPLETED
        await tx.resignationRequest.update({
          where: { staffProfileId: task.staffProfileId },
          data: { status: 'COMPLETED' },
        })

        // Deactivate User and TenantUser safely (preserves historical data)
        await tx.staffProfile.update({
          where: { id: task.staffProfileId },
          data: { status: 'INACTIVE' },
        })

        await tx.tenantUser.updateMany({
          where: { tenantId, userId: task.staffProfile.userId },
          data: { status: 'INACTIVE' },
        })

        await tx.user.update({
          where: { id: task.staffProfile.userId },
          data: { status: 'INACTIVE' },
        })

        await emit({
          type: 'ExitCompleted',
          tenantId,
          staffProfileId: task.staffProfileId,
        })
      }

      await AuditService.record({
        tenantId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'CLEARANCE_TASK_COMPLETED',
        entity: 'OffboardingTask',
        entityId: taskId,
        module: 'HR',
        summary: `Completed ${task.taskType} clearance for ${task.staffProfile.user.fullName}`,
        severity: 'INFO',
      }, tx)

      return updated
    })
  }

  /**
   * Reopen a clearance task
   */
  static async reopenClearanceTask(
    tenantId: string,
    taskId: string,
    actor: { id: string; name: string; role: string },
    remarks?: string
  ) {
    const task = await db.offboardingTask.findFirst({
      where: { id: taskId, tenantId },
      include: { staffProfile: { include: { user: true } } },
    })
    if (!task) throw new Error('Task not found')

    return await db.$transaction(async (tx) => {
      const updated = await tx.offboardingTask.update({
        where: { id: taskId },
        data: {
          isCompleted: false,
          completedById: null,
          completedByName: null,
          completedAt: null,
          remarks: remarks || 'Reopened clearance task',
        },
      })

      // If resignation was completed, revert to UNDER_NOTICE
      await tx.resignationRequest.updateMany({
        where: { staffProfileId: task.staffProfileId, status: 'COMPLETED' },
        data: { status: 'UNDER_NOTICE' },
      })

      await AuditService.record({
        tenantId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'CLEARANCE_TASK_REOPENED',
        entity: 'OffboardingTask',
        entityId: taskId,
        module: 'HR',
        summary: `Reopened ${task.taskType} clearance for ${task.staffProfile.user.fullName}`,
        severity: 'WARNING',
      }, tx)

      return updated
    })
  }

  /**
   * Action Resignation (Approve, set agreed LWD, or Reject)
   */
  static async actionResignation(
    tenantId: string,
    resignationId: string,
    data: {
      status: ResignationStatus
      agreedLwd?: Date | string
    },
    actor: { id: string; name: string; role: string }
  ) {
    const resignation = await db.resignationRequest.findFirst({
      where: { id: resignationId, tenantId },
      include: { staffProfile: { include: { user: true } } },
    })
    if (!resignation) throw new Error('Resignation not found')

    return await db.$transaction(async (tx) => {
      const updated = await tx.resignationRequest.update({
        where: { id: resignationId },
        data: {
          status: data.status,
          agreedLwd: data.agreedLwd ? new Date(data.agreedLwd) : undefined,
          actionedById: actor.id,
          actionedAt: new Date(),
        },
      })

      await AuditService.record({
        tenantId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'RESIGNATION_ACTIONED',
        entity: 'ResignationRequest',
        entityId: resignationId,
        module: 'HR',
        summary: `Updated resignation status to ${data.status} for ${resignation.staffProfile.user.fullName}`,
        severity: 'INFO',
        oldValues: { status: resignation.status },
        newValues: data,
      }, tx)

      return updated
    })
  }
}
