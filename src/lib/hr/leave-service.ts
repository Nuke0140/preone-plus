import { db } from '@/lib/db'
import { AuditService } from '@/lib/audit/audit-service'
import { emit } from '@/lib/events'
import type { LeaveRequestStatus, CoverageStatus } from '@prisma/client'

export interface ApplyLeaveInput {
  tenantId: string
  staffProfileId: string
  leaveTypeId: string
  startDate: string | Date
  endDate: string | Date
  reason: string
}

export class LeaveService {
  /**
   * Get or initialize fiscal leave balance (April-March cycle)
   */
  static async getOrCreateBalances(tenantId: string, staffProfileId: string, year: number) {
    let leaveTypes = await db.leaveType.findMany({
      where: { tenantId, isActive: true },
    })

    // If no leave types configured yet for tenant, seed canonical preschool defaults
    if (leaveTypes.length === 0) {
      const defaults = [
        { name: 'Casual Leave', code: 'CL', annualQuota: 12, carryForwardAllowed: false, maxCarryForward: 0, isPaid: true },
        { name: 'Sick Leave', code: 'SL', annualQuota: 10, carryForwardAllowed: true, maxCarryForward: 5, isPaid: true },
        { name: 'Earned Leave', code: 'EL', annualQuota: 15, carryForwardAllowed: true, maxCarryForward: 30, isPaid: true },
        { name: 'Maternity Leave', code: 'ML', annualQuota: 180, carryForwardAllowed: false, maxCarryForward: 0, isPaid: true },
      ]
      for (const d of defaults) {
        await db.leaveType.create({ data: { tenantId, ...d } })
      }
      leaveTypes = await db.leaveType.findMany({ where: { tenantId, isActive: true } })
    }

    const balances: any[] = []
    for (const lt of leaveTypes) {
      let b = await db.leaveBalance.findUnique({
        where: {
          staffProfileId_leaveTypeId_year: {
            staffProfileId,
            leaveTypeId: lt.id,
            year,
          },
        },
        include: { leaveType: true },
      })
      if (!b) {
        b = await db.leaveBalance.create({
          data: {
            tenantId,
            staffProfileId,
            leaveTypeId: lt.id,
            year,
            totalCredited: lt.annualQuota,
            consumed: 0,
            pending: 0,
            balance: lt.annualQuota,
          },
          include: { leaveType: true },
        })
      }
      balances.push(b)
    }

    return balances
  }

  /**
   * Apply for leave with overlap and balance validation
   */
  static async applyLeave(input: ApplyLeaveInput) {
    const { tenantId, staffProfileId, leaveTypeId, startDate, endDate, reason } = input

    const start = new Date(startDate)
    const end = new Date(endDate)
    if (end < start) {
      throw new Error('End date cannot be earlier than start date')
    }

    // Calculate business/calendar days (minimum 1 day)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

    // 1. Check for overlapping approved or pending leave requests
    const overlap = await db.leaveRequest.findFirst({
      where: {
        tenantId,
        staffProfileId,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          { startDate: { lte: end }, endDate: { gte: start } },
        ],
      },
    })
    if (overlap) {
      throw new Error('Leave dates overlap with an existing pending or approved leave request')
    }

    // 2. Check balance
    const fiscalYear = start.getMonth() >= 3 ? start.getFullYear() : start.getFullYear() - 1
    const balances = await this.getOrCreateBalances(tenantId, staffProfileId, fiscalYear)
    const balance = balances.find((b) => b.leaveTypeId === leaveTypeId)

    if (!balance || balance.balance < diffDays) {
      throw new Error(`Insufficient leave balance. Available: ${balance?.balance ?? 0}, Requested: ${diffDays}`)
    }

    return await db.$transaction(async (tx) => {
      // Create request
      const req = await tx.leaveRequest.create({
        data: {
          tenantId,
          staffProfileId,
          leaveTypeId,
          startDate: start,
          endDate: end,
          totalDays: diffDays,
          reason,
          status: 'PENDING',
        },
        include: { staffProfile: { include: { user: true } }, leaveType: true },
      })

      // Increase pending on balance
      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: {
          pending: { increment: diffDays },
          balance: { decrement: diffDays },
        },
      })

      await emit({
        type: 'LeaveSubmitted',
        tenantId,
        requestId: req.id,
        staffProfileId,
        totalDays: diffDays,
      })

      return req
    })
  }

  /**
   * Approve or reject leave request.
   * If approved and staff is a primary classroom teacher, triggers Teacher Leave Coverage Workflow!
   */
  static async actionLeave(
    tenantId: string,
    requestId: string,
    action: 'APPROVE' | 'REJECT',
    actor: { id: string; name: string; role: string },
    rejectionReason?: string
  ) {
    const leave = await db.leaveRequest.findFirst({
      where: { id: requestId, tenantId },
      include: {
        staffProfile: {
          include: {
            user: true,
            branch: true,
          },
        },
        leaveType: true,
      },
    })
    if (!leave) throw new Error('Leave request not found')
    if (leave.status !== 'PENDING') throw new Error(`Leave request is already ${leave.status}`)

    const start = new Date(leave.startDate)
    const fiscalYear = start.getMonth() >= 3 ? start.getFullYear() : start.getFullYear() - 1
    const balance = await db.leaveBalance.findUnique({
      where: {
        staffProfileId_leaveTypeId_year: {
          staffProfileId: leave.staffProfileId,
          leaveTypeId: leave.leaveTypeId,
          year: fiscalYear,
        },
      },
    })

    return await db.$transaction(async (tx) => {
      if (action === 'REJECT') {
        const updated = await tx.leaveRequest.update({
          where: { id: requestId },
          data: {
            status: 'REJECTED',
            actionedById: actor.id,
            actionedByName: actor.name,
            actionedAt: new Date(),
            rejectionReason: rejectionReason || 'Rejected by management',
          },
        })

        // Restore pending balance
        if (balance) {
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: {
              pending: { decrement: leave.totalDays },
              balance: { increment: leave.totalDays },
            },
          })
        }

        await AuditService.record({
          tenantId,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          action: 'LEAVE_REJECTED',
          entity: 'LeaveRequest',
          entityId: requestId,
          module: 'HR',
          summary: `Rejected leave for ${leave.staffProfile.user.fullName}: ${rejectionReason || 'Rejected'}`,
          severity: 'INFO',
        }, tx)

        return { request: updated, coverages: [] }
      }

      // APPROVE ACTION
      const updated = await tx.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          actionedById: actor.id,
          actionedByName: actor.name,
          actionedAt: new Date(),
        },
      })

      // Update balance: pending -> consumed
      if (balance) {
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: {
            pending: { decrement: leave.totalDays },
            consumed: { increment: leave.totalDays },
          },
        })
      }

      // Mark Staff Attendance as ON_LEAVE for these dates
      const curr = new Date(leave.startDate)
      const endD = new Date(leave.endDate)
      while (curr <= endD) {
        const dateCopy = new Date(curr)
        await tx.attendanceStaff.upsert({
          where: {
            staffProfileId_date: {
              staffProfileId: leave.staffProfileId,
              date: dateCopy,
            },
          },
          create: {
            tenantId,
            branchId: leave.staffProfile.branchId || '',
            staffProfileId: leave.staffProfileId,
            date: dateCopy,
            status: 'ON_LEAVE',
            source: 'MANUAL',
            notes: `Approved leave: ${leave.leaveType.name}`,
            markedById: actor.id,
            markedByName: actor.name,
          },
          update: {
            status: 'ON_LEAVE',
            notes: `Approved leave: ${leave.leaveType.name}`,
            markedById: actor.id,
            markedByName: actor.name,
          },
        })
        curr.setDate(curr.getDate() + 1)
      }

      // ========================================================
      // TEACHER LEAVE COVERAGE WORKFLOW
      // ========================================================
      // Find classrooms where this staff member is primary teacher
      const classrooms = await tx.classroom.findMany({
        where: {
          tenantId,
          primaryTeacherId: leave.staffProfile.userId,
          isActive: true,
        },
      })

      const createdCoverages: any[] = []
      if (classrooms.length > 0) {
        // Look for available substitute teachers in the same branch
        const candidateSubstitutes = await tx.staffProfile.findMany({
          where: {
            tenantId,
            branchId: leave.staffProfile.branchId,
            id: { not: leave.staffProfileId },
            status: 'ACTIVE',
            deletedAt: null,
          },
          include: { user: true },
        })

        // Coordinator fallback search
        const coordinator = candidateSubstitutes.find((c) =>
          c.designation?.toLowerCase().includes('coordinator') || c.designation?.toLowerCase().includes('head')
        )

        for (const cls of classrooms) {
          const leaveDate = new Date(leave.startDate)
          const sub = candidateSubstitutes.find((s) => s.id !== coordinator?.id) || coordinator

          const coverage = await tx.leaveCoverage.create({
            data: {
              leaveRequestId: requestId,
              classroomId: cls.id,
              date: leaveDate,
              substituteStaffId: sub?.id || null,
              coordinatorStaffId: !sub && coordinator ? (coordinator as any).id : (sub?.id === coordinator?.id ? ((coordinator as any)?.id || null) : null),
              status: sub ? 'ASSIGNED' : 'COORDINATOR_COVERAGE',
              notificationSent: true,
              notes: `Auto-coverage triggered for classroom ${cls.name}`,
            },
          })
          createdCoverages.push(coverage)

          await emit({
            type: 'TeacherCoverageRequired',
            tenantId,
            requestId,
            classroomId: cls.id,
            date: leaveDate.toISOString().split('T')[0],
          })
        }
      }

      await AuditService.record({
        tenantId,
        branchId: leave.staffProfile.branchId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'LEAVE_APPROVED',
        entity: 'LeaveRequest',
        entityId: requestId,
        module: 'HR',
        summary: `Approved ${leave.totalDays} days leave for ${leave.staffProfile.user.fullName} (${createdCoverages.length} classroom coverages created)`,
        severity: 'INFO',
      }, tx)

      await emit({
        type: 'LeaveApproved',
        tenantId,
        requestId,
        staffProfileId: leave.staffProfileId,
        totalDays: leave.totalDays,
      })

      return { request: updated, coverages: createdCoverages }
    })
  }
}
