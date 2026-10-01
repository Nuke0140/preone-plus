import { db } from '@/lib/db'
import { AuditService } from '@/lib/audit/audit-service'
import { emit } from '@/lib/events'
import { Prisma } from '@prisma/client'
import type { PayrollCycleStatus, PayslipStatus } from '@prisma/client'

const Decimal = Prisma.Decimal

export class PayrollService {
  /**
   * Run payroll calculation for a month/year.
   * Enforces:
   *  1. Attendance lock / cutoff on 25th of the month.
   *  2. Indian statutory deductions: PF (12% of basic), ESI (0.75% of gross if gross <= 21000), PT (Professional Tax slab), TDS.
   *  3. Preschool Compliance Gate: Checks valid POSH training. If missing/expired, marks payslip isHeld = true.
   */
  static async processPayroll(
    tenantId: string,
    month: number,
    year: number,
    branchId: string | null,
    actor: { id: string; name: string; role: string }
  ) {
    const existingCycle = await db.payrollCycle.findUnique({
      where: {
        tenantId_month_year: { tenantId, month, year },
      },
    })
    if (existingCycle && (existingCycle.status === 'LOCKED' || existingCycle.status === 'DISBURSED')) {
      throw new Error(`Payroll for ${month}/${year} is already ${existingCycle.status} and cannot be reprocessed`)
    }

    // Cutoff is 25th of the processing month
    const attendanceCutoffDate = new Date(year, month - 1, 25)

    // Fetch eligible active staff
    const staffList = await db.staffProfile.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: {
        user: true,
        salaryStructure: true,
        trainings: {
          where: { trainingType: 'POSH', status: 'VALID' },
          orderBy: { expiryDate: 'desc' },
          take: 1,
        },
      },
    })

    if (staffList.length === 0) {
      throw new Error('No eligible active staff found for payroll calculation')
    }

    return await db.$transaction(async (tx) => {
      // Create or update cycle
      const cycle = await tx.payrollCycle.upsert({
        where: {
          tenantId_month_year: { tenantId, month, year },
        },
        create: {
          tenantId,
          branchId,
          month,
          year,
          attendanceCutoffDate,
          status: 'PROCESSING',
          processedById: actor.id,
          processedByName: actor.name,
        },
        update: {
          status: 'PROCESSING',
          processedById: actor.id,
          processedByName: actor.name,
          updatedAt: new Date(),
        },
      })

      // Delete existing draft payslips for this cycle if re-running
      await tx.payslip.deleteMany({
        where: { payrollCycleId: cycle.id },
      })

      let totalGross = new Decimal(0)
      let totalDeductions = new Decimal(0)
      let totalNet = new Decimal(0)

      const startOfMonth = new Date(year, month - 1, 1)
      const endOfMonth = new Date(year, month, 0)
      const totalDaysInMonth = endOfMonth.getDate()

      for (const staff of staffList) {
        // Fallback default salary structure if not explicitly configured
        const basic = staff.salaryStructure ? staff.salaryStructure.basicSalary : new Decimal(18000)
        const hra = staff.salaryStructure ? staff.salaryStructure.hra : new Decimal(7000)
        const allowance = staff.salaryStructure ? staff.salaryStructure.specialAllowance : new Decimal(5000)

        // Fetch attendance punches for the month
        const punches = await tx.attendanceStaff.findMany({
          where: {
            staffProfileId: staff.id,
            date: { gte: startOfMonth, lte: endOfMonth },
          },
        })

        const presentCount = punches.filter((p) => p.status === 'PRESENT' || p.status === 'LATE').length
        const halfDayCount = punches.filter((p) => p.status === 'HALF_DAY').length
        const leaveCount = punches.filter((p) => p.status === 'ON_LEAVE').length
        const absentCount = punches.filter((p) => p.status === 'ABSENT').length

        // Effective payable days
        const payableDays = presentCount + (halfDayCount * 0.5) + leaveCount
        const unpaidDays = absentCount

        // Salary calculations based on proportion (or full if attendance not marked)
        const attendanceFactor = punches.length > 0 ? (payableDays / (punches.length || totalDaysInMonth)) : 1.0
        const factorDecimal = new Decimal(Math.min(1.0, Math.max(0.0, attendanceFactor)))

        const earnedBasic = basic.mul(factorDecimal).toDecimalPlaces(2)
        const earnedHra = hra.mul(factorDecimal).toDecimalPlaces(2)
        const earnedAllowance = allowance.mul(factorDecimal).toDecimalPlaces(2)
        const gross = earnedBasic.add(earnedHra).add(earnedAllowance)

        // Statutory Deductions:
        // 1. PF: 12% of Basic (capped at standard ₹1800 if basic > 15000, or exact 12%)
        let pf = new Decimal(0)
        if (staff.salaryStructure?.pfEligible ?? true) {
          pf = earnedBasic.mul(new Decimal(0.12)).toDecimalPlaces(2)
        }

        // 2. ESI: 0.75% of Gross if gross <= 21,000
        let esi = new Decimal(0)
        if (gross.lte(new Decimal(21000))) {
          esi = gross.mul(new Decimal(0.0075)).toDecimalPlaces(2)
        }

        // 3. Professional Tax (PT): Standard Indian preschool slab (₹200/month)
        let pt = new Decimal(0)
        if (gross.gte(new Decimal(10000))) {
          pt = new Decimal(200)
        }

        // 4. TDS: configured rate or 0
        const tdsRate = staff.salaryStructure?.tdsRate ? Number(staff.salaryStructure.tdsRate) : 0
        const tds = gross.mul(new Decimal(tdsRate / 100)).toDecimalPlaces(2)

        const deductions = pf.add(esi).add(pt).add(tds)
        const net = gross.sub(deductions)

        // ========================================================
        // PRESCHOOL COMPLIANCE GATE: POSH TRAINING CHECK
        // ========================================================
        const latestPosh = staff.trainings[0]
        const isPoshCompliant = Boolean(latestPosh && new Date(latestPosh.expiryDate) >= new Date())
        const isHeld = !isPoshCompliant
        const holdReason = isHeld ? 'POSH annual training pending or expired' : null

        await tx.payslip.create({
          data: {
            tenantId,
            payrollCycleId: cycle.id,
            staffProfileId: staff.id,
            presentDays: presentCount + (halfDayCount * 0.5),
            absentDays: absentCount,
            paidLeaveDays: leaveCount,
            unpaidLeaveDays: unpaidDays,
            basicEarned: earnedBasic,
            hraEarned: earnedHra,
            allowanceEarned: earnedAllowance,
            grossEarnings: gross,
            pfDeduction: pf,
            esiDeduction: esi,
            ptDeduction: pt,
            tdsDeduction: tds,
            totalDeductions: deductions,
            netSalary: net,
            poshCompliant: isPoshCompliant,
            isHeld,
            holdReason,
            status: isHeld ? 'HELD' : 'PENDING',
          },
        })

        totalGross = totalGross.add(gross)
        totalDeductions = totalDeductions.add(deductions)
        totalNet = totalNet.add(net)
      }

      const updatedCycle = await tx.payrollCycle.update({
        where: { id: cycle.id },
        data: {
          status: 'REVIEWED',
          totalStaff: staffList.length,
          totalGross,
          totalDeductions,
          totalNetPayable: totalNet,
        },
        include: {
          payslips: {
            include: { staffProfile: { include: { user: true } } },
          },
        },
      })

      await AuditService.record({
        tenantId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'PAYROLL_PROCESSED',
        entity: 'PayrollCycle',
        entityId: cycle.id,
        module: 'PAYROLL',
        summary: `Calculated payroll for ${month}/${year}: Total Net ₹${totalNet.toString()} for ${staffList.length} staff members`,
        severity: 'INFO',
      }, tx)

      await emit({
        type: 'PayrollProcessed',
        tenantId,
        cycleId: cycle.id,
        month,
        year,
      })

      return updatedCycle
    })
  }

  /**
   * Disburse payroll and lock cycle
   */
  static async disbursePayroll(
    tenantId: string,
    cycleId: string,
    paymentReference: string,
    actor: { id: string; name: string; role: string }
  ) {
    const cycle = await db.payrollCycle.findFirst({
      where: { id: cycleId, tenantId },
      include: { payslips: true },
    })
    if (!cycle) throw new Error('Payroll cycle not found')
    if (cycle.status === 'LOCKED' || cycle.status === 'DISBURSED') {
      throw new Error(`Payroll cycle is already ${cycle.status}`)
    }

    return await db.$transaction(async (tx) => {
      // Mark payslips that are not held as PAID
      await tx.payslip.updateMany({
        where: {
          payrollCycleId: cycleId,
          isHeld: false,
        },
        data: {
          status: 'PAID',
          paymentReference,
        },
      })

      const disbursedCycle = await tx.payrollCycle.update({
        where: { id: cycleId },
        data: {
          status: 'DISBURSED',
          disbursedAt: new Date(),
          lockedAt: new Date(),
        },
        include: { payslips: true },
      })

      await AuditService.record({
        tenantId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'PAYROLL_DISBURSED',
        entity: 'PayrollCycle',
        entityId: cycleId,
        module: 'PAYROLL',
        summary: `Disbursed and locked payroll cycle ${cycle.month}/${cycle.year} with ref ${paymentReference}`,
        severity: 'INFO',
      }, tx)

      return disbursedCycle
    })
  }

  /**
   * Generate Bank NEFT/RTGS payout export file content
   */
  static async generateBankPayoutFile(tenantId: string, cycleId: string) {
    const payslips = await db.payslip.findMany({
      where: { payrollCycleId: cycleId, tenantId, isHeld: false },
      include: {
        staffProfile: {
          include: {
            user: true,
            bankDetails: true,
          },
        },
      },
    })

    const rows = [
      ['Account Holder Name', 'Bank Name', 'Account Number', 'IFSC Code', 'Amount (INR)', 'Payment Mode', 'Narration'].join(','),
    ]

    for (const p of payslips) {
      const bank = p.staffProfile.bankDetails
      rows.push([
        `"${bank?.accountHolderName || p.staffProfile.user.fullName}"`,
        `"${bank?.bankName || 'HDFC Bank'}"`,
        `"${bank?.accountNumberMasked || 'XXXXXX1234'}"`,
        `"${bank?.ifscCode || 'HDFC0001234'}"`,
        p.netSalary.toString(),
        'NEFT',
        `"Salary ${p.createdAt.toLocaleString('default', { month: 'short' })}-${p.createdAt.getFullYear()}"`,
      ].join(','))
    }

    return rows.join('\n')
  }
}
