/**
 * PreOne — Canonical KPI Engine
 *
 * Computes authoritative key performance indicators by directly querying
 * domain models without replicating or modifying core business math.
 */

import { db } from '@/lib/db'
import { KPIResult, ScopeContext } from './report-types'
import { inr } from '@/lib/format'

export class KpiEngine {
  /**
   * Generates authoritative KPIs for the Executive & Domain Dashboards.
   * Role and scope filtering is strictly applied server-side.
   */
  static async getExecutiveKPIs(ctx: ScopeContext): Promise<KPIResult[]> {
    const { tenantId, branchId, academicSessionId, roles } = ctx

    const isParent = roles.includes('PARENT')
    const isTeacher = roles.includes('TEACHER') && !roles.includes('OWNER') && !roles.includes('PRINCIPAL')
    const isAccounts = roles.includes('ACCOUNTS') && !roles.includes('OWNER') && !roles.includes('PRINCIPAL')

    const kpis: KPIResult[] = []

    // 1. STUDENTS / ENROLLMENT KPI
    if (!isAccounts) {
      const studentWhere: any = { tenantId, deletedAt: null }
      if (branchId) studentWhere.branchId = branchId
      if (isParent) {
        // Parent ward filter
        studentWhere.guardians = {
          some: { guardian: { userId: ctx.actorId } },
        }
      }

      const totalStudents = await db.student.count({ where: studentWhere })
      const activeStudents = await db.student.count({
        where: { ...studentWhere, status: 'ACTIVE' },
      })

      kpis.push({
        key: 'total_students',
        label: isParent ? 'My Enrolled Wards' : 'Total Enrolled Students',
        value: activeStudents,
        unit: 'Students',
        domain: 'STUDENTS',
        drilldownReportId: 'students-strength',
        freshness: 'REAL_TIME',
      })
    }

    // 2. ATTENDANCE KPI (Today's attendance rate)
    if (!isAccounts) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const attWhere: any = {
        tenantId,
        date: today,
      }
      if (branchId) attWhere.branchId = branchId
      if (isParent) {
        attWhere.student = {
          guardians: {
            some: { guardian: { userId: ctx.actorId } },
          },
        }
      }

      const totalMarked = await db.attendance.count({ where: attWhere })
      const presentCount = await db.attendance.count({
        where: { ...attWhere, status: { in: ['PRESENT', 'LATE'] } },
      })

      const attRate = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 100

      kpis.push({
        key: 'today_attendance_rate',
        label: "Today's Attendance Rate",
        value: `${attRate}%`,
        unit: 'Present',
        domain: 'ATTENDANCE',
        drilldownReportId: 'attendance-daily',
        freshness: 'REAL_TIME',
      })
    }

    // 3. FINANCE KPIS (Billed, Collected, Outstanding)
    if (!isTeacher) {
      const invoiceWhere: any = { tenantId, deletedAt: null }
      if (branchId) invoiceWhere.branchId = branchId
      if (academicSessionId) invoiceWhere.academicSessionId = academicSessionId
      if (isParent) {
        invoiceWhere.student = {
          guardians: { some: { guardian: { userId: ctx.actorId } } },
        }
      }

      const invoices = await db.invoice.findMany({
        where: invoiceWhere,
        select: { totalCents: true, paidCents: true, balanceCents: true, status: true },
      })

      const totalBilledCents = invoices.reduce((acc, inv) => acc + (inv.totalCents || 0), 0)
      const totalCollectedCents = invoices.reduce((acc, inv) => acc + (inv.paidCents || 0), 0)
      const totalOutstandingCents = invoices.reduce((acc, inv) => acc + (inv.balanceCents || 0), 0)

      kpis.push({
        key: 'total_collected',
        label: isParent ? 'Fees Paid' : 'Fee Collections',
        value: inr(totalCollectedCents),
        domain: 'FINANCE',
        drilldownReportId: 'finance-collections',
        freshness: 'REAL_TIME',
      })

      kpis.push({
        key: 'total_outstanding',
        label: isParent ? 'Pending Fee Dues' : 'Outstanding Balance',
        value: inr(totalOutstandingCents),
        domain: 'FINANCE',
        drilldownReportId: 'finance-outstanding',
        freshness: 'REAL_TIME',
      })
    }

    // 4. WORKFORCE / HR KPI
    if (!isParent && !isTeacher && !isAccounts) {
      const staffWhere: any = { tenantId, deletedAt: null }
      if (branchId) staffWhere.branchId = branchId

      const totalStaff = await db.staffProfile.count({ where: staffWhere })

      kpis.push({
        key: 'total_staff',
        label: 'Active Staff Headcount',
        value: totalStaff,
        unit: 'Staff',
        domain: 'HR',
        drilldownReportId: 'hr-headcount',
        freshness: 'REAL_TIME',
      })
    }

    // 5. TRANSPORT RIDERSHIP KPI
    if (!isTeacher && !isAccounts) {
      const transWhere: any = {
        tenantId,
        status: 'ACTIVE',
      }
      if (branchId) transWhere.branchId = branchId
      if (isParent) {
        transWhere.student = {
          guardians: { some: { guardian: { userId: ctx.actorId } } },
        }
      }

      const activeRiders = await db.studentTransportAssignment.count({ where: transWhere })

      kpis.push({
        key: 'active_riders',
        label: isParent ? 'Assigned Bus Riders' : 'Transport Riders',
        value: activeRiders,
        unit: 'Riders',
        domain: 'TRANSPORT',
        drilldownReportId: 'transport-utilization',
        freshness: 'REAL_TIME',
      })
    }

    // 6. INVENTORY LOW STOCK KPI
    if (!isParent && !isTeacher) {
      const stockItemIds = (
        await db.inventoryItem.findMany({
          where: { tenantId, isActive: true },
          select: { id: true },
        })
      ).map((i) => i.id)

      const lowStockCount = await db.inventoryStock.count({
        where: {
          tenantId,
          ...(branchId ? { branchId } : {}),
          quantity: { lte: 5 }, // Low stock threshold
          itemId: stockItemIds.length > 0 ? { in: stockItemIds } : '00000000-0000-0000-0000-000000000000',
        },
      })

      kpis.push({
        key: 'low_stock_items',
        label: 'Low Stock Alerts',
        value: lowStockCount,
        unit: 'Items',
        domain: 'INVENTORY',
        drilldownReportId: 'inventory-valuation',
        freshness: 'REAL_TIME',
      })
    }

    return kpis
  }
}
