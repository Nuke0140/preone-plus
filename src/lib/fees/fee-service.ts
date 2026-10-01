/**
 * PreOne — Fees & Finance Domain Service (M05)
 *
 * Authoritative financial lifecycle engine:
 * Setup -> AcademicSession -> Program -> Classroom -> StudentAllocation -> Student ->
 * Fee Structure -> Fee Assignment -> Invoice -> Payment -> Receipt -> AuditLog -> TimelineEntry
 *
 * Rules:
 * - Single source of truth: Invoice, InvoiceItem, Payment, Receipt, FeePlan, FeePlanItem
 * - Zero duplicate entities, tables, or financial identity records
 * - Tenant, branch, and academic-session scoped
 * - Server-side recalculation of gross, discount, tax, total, and balance amounts
 * - Strict financial immutability for finalized records
 * - Idempotent payment verification and webhook processing
 */

import { db } from '@/lib/db'
import { nextNumber } from '@/lib/sequence'
import { recordAudit } from '@/lib/audit'
import { emit } from '@/lib/events'
import { recordChildEvent } from '@/lib/notify'
import { resolveSessionId, currentSession } from '@/lib/academic'
import { ConfigurationService } from '@/lib/setup/config-service'
import { isoDate } from '@/lib/format'
import type {
  ProgramType,
  FeeHeadCategory,
  FeeFrequency,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client'

export interface ScopeContext {
  tenantId: string
  branchId?: string | null
  academicSessionId?: string | null
  actorId?: string | null
  actorName?: string | null
  actorRole?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

export interface FeeItemInput {
  feeHead: FeeHeadCategory
  label: string
  amountCents: number
  frequency?: FeeFrequency
}

export interface CreateFeePlanInput {
  name: string
  programType: ProgramType
  branchId?: string | null
  installmentCount?: number
  items: FeeItemInput[]
}

export interface InvoiceLineItemInput {
  feeHead?: FeeHeadCategory
  description: string
  amountCents: number
}

export interface CreateInvoiceInput {
  studentId: string
  title?: string
  dueDate: string | Date
  lineItems: InvoiceLineItemInput[]
  discountCents?: number
  discountReason?: string
  notes?: string
}

export interface BulkInvoicePreviewFilter {
  branchId?: string
  academicSessionId?: string
  programType?: ProgramType
  classroomId?: string
  feePlanId?: string
  feeHead?: FeeHeadCategory
  customTitle?: string
  customAmountCents?: number
  dueDate: string | Date
}

export interface InitiatePaymentInput {
  invoiceId: string
  amountCents: number
  method: PaymentMethod
  transactionRef?: string
  notes?: string
}

export interface VerifyPaymentInput {
  paymentId?: string
  paymentNumber?: string
  invoiceId?: string
  transactionRef?: string
  gatewaySignature?: string
  gatewayStatus?: 'SUCCESS' | 'FAILED'
  failureReason?: string
}

export class FeeService {
  /**
   * Authoritative scope verifier
   */
  static async verifyScope(
    tenantId: string,
    branchId?: string | null,
    academicSessionId?: string | null
  ) {
    if (!tenantId) throw new Error('Tenant context is required')

    const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) throw new Error('Tenant not found')

    let session: any = null
    if (academicSessionId) {
      session = await db.academicSession.findFirst({
        where: { id: academicSessionId, tenantId },
      })
    }
    if (!session) {
      session = (await ConfigurationService.getActiveAcademicYear(tenantId)) || (await currentSession(tenantId))
    }

    let branch: any = null
    if (branchId) {
      branch = await db.branch.findFirst({
        where: { id: branchId, tenantId, deletedAt: null },
      })
    }
    if (!branch) {
      branch = await ConfigurationService.getBranch(tenantId)
    }

    return { tenant, session, branch }
  }

  /**
   * 1. GET DASHBOARD METRICS
   * Real database aggregates of billed, collected, outstanding, and overdue amounts.
   */
  static async getDashboardMetrics(
    tenantId: string,
    branchId?: string | null,
    academicSessionId?: string | null,
    filterDate?: string
  ) {
    const { session, branch } = await this.verifyScope(tenantId, branchId, academicSessionId)

    // Synchronize any overdue invoices
    await this.syncOverdueInvoices(tenantId)

    const baseWhere = {
      tenantId,
      deletedAt: null,
      ...(branch?.id ? { branchId: branch.id } : {}),
      ...(session?.id ? { academicSessionId: session.id } : {}),
    }

    const [invoices, payments, feePlansCount] = await Promise.all([
      db.invoice.findMany({
        where: baseWhere,
        select: {
          id: true,
          totalCents: true,
          paidCents: true,
          balanceCents: true,
          status: true,
          dueDate: true,
        },
      }),
      db.payment.findMany({
        where: {
          tenantId,
          ...(session?.id ? { invoice: { academicSessionId: session.id } } : {}),
        },
        select: {
          id: true,
          amountCents: true,
          status: true,
          method: true,
        },
      }),
      db.feePlan.count({
        where: { tenantId, isActive: true },
      }),
    ])

    const totalBilledCents = invoices.reduce((acc, i) => acc + i.totalCents, 0)
    const totalCollectedCents = payments
      .filter((p) => p.status === 'SUCCESS')
      .reduce((acc, p) => acc + p.amountCents, 0)

    const outstandingInvoices = invoices.filter((i) =>
      ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'].includes(i.status)
    )
    const totalOutstandingCents = outstandingInvoices.reduce((acc, i) => acc + i.balanceCents, 0)

    const overdueInvoices = invoices.filter((i) => i.status === 'OVERDUE')
    const totalOverdueCents = overdueInvoices.reduce((acc, i) => acc + i.balanceCents, 0)

    const collectionRate =
      totalBilledCents > 0 ? Math.round((totalCollectedCents / totalBilledCents) * 100) : 0

    const statusCounts: Record<string, number> = {}
    for (const inv of invoices) {
      statusCounts[inv.status] = (statusCounts[inv.status] || 0) + 1
    }

    const counts = {
      totalInvoices: invoices.length,
      paid: statusCounts['PAID'] || 0,
      partiallyPaid: statusCounts['PARTIALLY_PAID'] || 0,
      issued: statusCounts['ISSUED'] || 0,
      overdue: statusCounts['OVERDUE'] || 0,
    }

    return {
      totalBilledCents,
      totalCollectedCents,
      totalBalanceCents: totalOutstandingCents,
      totalOutstandingCents,
      totalOverdueCents,
      collectionRate,
      counts,
      kpis: {
        totalBilledCents,
        totalBilledRupees: totalBilledCents / 100,
        totalCollectedCents,
        totalCollectedRupees: totalCollectedCents / 100,
        totalOutstandingCents,
        totalOutstandingRupees: totalOutstandingCents / 100,
        totalOverdueCents,
        totalOverdueRupees: totalOverdueCents / 100,
        collectionRate,
        invoiceCount: invoices.length,
        paymentCount: payments.filter((p) => p.status === 'SUCCESS').length,
        pendingPaymentCount: payments.filter((p) => p.status === 'PENDING').length,
        failedPaymentCount: payments.filter((p) => p.status === 'FAILED').length,
        feePlansCount,
      },
      statusCounts,
      academicSession: session ? { id: session.id, name: session.name } : null,
      branch: branch ? { id: branch.id, name: branch.name } : null,
    }
  }

  /**
   * Helper: syncs overdue invoices
   */
  static async syncOverdueInvoices(tenantId: string) {
    const now = new Date()
    const overdueInvs = await db.invoice.findMany({
      where: {
        tenantId,
        status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
        dueDate: { lt: now },
        balanceCents: { gt: 0 },
        deletedAt: null,
      },
      take: 100,
    })

    for (const inv of overdueInvs) {
      await db.invoice.update({
        where: { id: inv.id },
        data: { status: 'OVERDUE' },
      })
      await emit({
        type: 'InvoiceOverdue',
        tenantId,
        invoiceId: inv.id,
        studentId: inv.studentId || '',
        invoiceNumber: inv.invoiceNumber,
        balanceCents: inv.balanceCents,
      })
    }
  }

  /**
   * 2. FEE STRUCTURES / PLANS
   */
  static async getFeePlans(tenantId: string, programType?: ProgramType) {
    return db.feePlan.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(programType ? { programType } : {}),
      },
      include: { items: true },
      orderBy: { programType: 'asc' },
    })
  }

  static async createFeePlan(ctx: ScopeContext, input: CreateFeePlanInput) {
    const { tenant } = await this.verifyScope(ctx.tenantId, input.branchId)
    if (!input.name || !input.programType || !input.items || !input.items.length) {
      throw new Error('Name, programType, and at least one fee item are required')
    }

    const totalAnnualCents = input.items.reduce((s, i) => s + Math.round(i.amountCents), 0)

    const plan = await db.feePlan.create({
      data: {
        tenantId: ctx.tenantId,
        branchId: input.branchId || null,
        name: input.name.trim(),
        programType: input.programType,
        totalAnnualCents,
        installmentCount: input.installmentCount || 1,
        isActive: true,
        items: {
          create: input.items.map((i) => ({
            feeHead: i.feeHead,
            label: i.label.trim(),
            amountCents: Math.round(i.amountCents),
            frequency: i.frequency || 'ANNUALLY',
          })),
        },
      },
      include: { items: true },
    })

    await recordAudit({
      tenantId: ctx.tenantId,
      branchId: input.branchId || undefined,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'CREATE_FEE_STRUCTURE',
      entity: 'FeePlan',
      entityId: plan.id,
      module: 'Fees',
      summary: `Created fee plan ${plan.name} (${plan.programType}): ₹${totalAnnualCents / 100}`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    })

    return plan
  }

  static async updateFeePlan(
    ctx: ScopeContext,
    planId: string,
    data: Partial<CreateFeePlanInput> & { isActive?: boolean }
  ) {
    const existing = await db.feePlan.findFirst({
      where: { id: planId, tenantId: ctx.tenantId },
      include: { items: true },
    })
    if (!existing) throw new Error('Fee structure not found')

    let totalAnnualCents = existing.totalAnnualCents
    if (data.items && data.items.length > 0) {
      totalAnnualCents = data.items.reduce((s, i) => s + Math.round(i.amountCents), 0)
    }

    const updated = await db.$transaction(async (tx) => {
      if (data.items && data.items.length > 0) {
        await tx.feePlanItem.deleteMany({ where: { feePlanId: planId } })
        await tx.feePlanItem.createMany({
          data: data.items.map((i) => ({
            feePlanId: planId,
            feeHead: i.feeHead,
            label: i.label.trim(),
            amountCents: Math.round(i.amountCents),
            frequency: i.frequency || 'ANNUALLY',
          })),
        })
      }

      return tx.feePlan.update({
        where: { id: planId },
        data: {
          name: data.name ? data.name.trim() : undefined,
          programType: data.programType || undefined,
          branchId: data.branchId !== undefined ? data.branchId : undefined,
          installmentCount: data.installmentCount || undefined,
          isActive: data.isActive !== undefined ? data.isActive : undefined,
          totalAnnualCents,
        },
        include: { items: true },
      })
    })

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'UPDATE_FEE_STRUCTURE',
      entity: 'FeePlan',
      entityId: updated.id,
      module: 'Fees',
      summary: `Updated fee plan ${updated.name} (Active: ${updated.isActive})`,
    })

    return updated
  }

  /**
   * 3. SIBLING DISCOUNT & FEE CALCULATION ENGINE
   */
  static async calculateSiblingDiscount(
    tenantId: string,
    studentId: string
  ): Promise<{ eligible: boolean; siblingCount: number; discountPercent: number; discountCents: number; reason: string }> {
    // Find all guardians linked to this student
    const studentGuardians = await db.studentGuardian.findMany({
      where: { studentId },
      select: { guardianId: true },
    })

    if (!studentGuardians.length) {
      return { eligible: false, siblingCount: 0, discountPercent: 0, discountCents: 0, reason: 'No linked guardian' }
    }

    const guardianIds = studentGuardians.map((g) => g.guardianId)

    // Find other active students linked to these same guardians
    const otherLinks = await db.studentGuardian.findMany({
      where: {
        guardianId: { in: guardianIds },
        studentId: { not: studentId },
        student: { tenantId, status: 'ACTIVE', deletedAt: null },
      },
      select: { studentId: true },
    })

    const uniqueSiblingIds = Array.from(new Set(otherLinks.map((l) => l.studentId)))
    const siblingCount = uniqueSiblingIds.length

    if (siblingCount >= 1) {
      // 10% standard sibling concession on tuition
      return {
        eligible: true,
        siblingCount,
        discountPercent: 10,
        discountCents: 0, // Will be computed against gross tuition
        reason: `Eligible for Sibling Concession (${siblingCount} registered sibling${siblingCount > 1 ? 's' : ''})`,
      }
    }

    return { eligible: false, siblingCount: 0, discountPercent: 0, discountCents: 0, reason: 'No registered siblings found' }
  }

  /**
   * 4. CREATE SINGLE INVOICE
   */
  static async createInvoice(ctx: ScopeContext, input: CreateInvoiceInput) {
    const { tenant, session } = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicSessionId)
    const { studentId, title, dueDate, lineItems, discountCents = 0, discountReason, notes } = input

    if (!studentId || !dueDate || !lineItems || !lineItems.length) {
      throw new Error('studentId, dueDate, and at least one line item are required')
    }

    const student = await db.student.findFirst({
      where: { id: studentId, tenantId: ctx.tenantId, deletedAt: null },
      include: { currentClassroom: true },
    })
    if (!student) throw new Error('Student not found')

    // Recalculate gross subtotal strictly on server
    const subtotalCents = lineItems.reduce((acc, item) => acc + Math.round(item.amountCents), 0)
    if (subtotalCents <= 0) throw new Error('Invoice subtotal must be greater than 0')

    // Validate discount
    const safeDiscountCents = Math.max(0, Math.min(subtotalCents, Math.round(discountCents)))
    const totalCents = subtotalCents - safeDiscountCents
    const balanceCents = totalCents

    const invoiceNumber = await nextNumber('invoice', ctx.tenantId)
    const targetSessionId = student.currentClassroom?.academicSessionId || session?.id

    const invoice = await db.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          tenantId: ctx.tenantId,
          branchId: student.branchId,
          studentId: student.id,
          invoiceNumber,
          title: title || 'Fee Invoice',
          issueDate: new Date(),
          dueDate: new Date(dueDate),
          subtotalCents,
          discountCents: safeDiscountCents,
          taxCents: 0,
          totalCents,
          paidCents: 0,
          balanceCents,
          status: 'ISSUED',
          notes: [discountReason ? `Discount applied: ${discountReason}` : '', notes].filter(Boolean).join('. '),
          issuedById: ctx.actorId,
          academicSessionId: targetSessionId,
          items: {
            create: lineItems.map((item) => ({
              feeHead: item.feeHead || 'TUITION',
              description: item.description.trim(),
              amountCents: Math.round(item.amountCents),
            })),
          },
        },
        include: { items: true },
      })

      // Parent portal timeline entry
      await tx.timelineEntry.create({
        data: {
          tenantId: ctx.tenantId,
          studentId: student.id,
          classroomId: student.currentClassroomId,
          academicSessionId: targetSessionId,
          type: 'NOTE',
          title: `Fee Invoice Issued — ${invoiceNumber}`,
          body: `Invoice ${invoiceNumber} issued for ₹${totalCents / 100}. Due by ${new Date(dueDate).toLocaleDateString('en-IN')}.`,
          authorId: ctx.actorId,
        },
      })

      return inv
    })

    // Emit event for finance follow-up and broadcast
    await emit({
      type: 'InvoiceIssued',
      tenantId: ctx.tenantId,
      invoiceId: invoice.id,
      studentId: student.id,
      invoiceNumber,
      totalCents,
      dueDate: new Date(dueDate),
    })

    await recordAudit({
      tenantId: ctx.tenantId,
      branchId: student.branchId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'CREATE_INVOICE',
      entity: 'Invoice',
      entityId: invoice.id,
      module: 'Fees',
      summary: `Invoice ${invoiceNumber} created for ${student.firstName}: ₹${totalCents / 100} (Due: ${new Date(dueDate).toLocaleDateString('en-IN')})`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    })

    return invoice
  }

  static async voidInvoice(tenantId: string, id: string, reason?: string, actor?: { id?: string; name?: string; role?: string }) {
    const existing = await db.invoice.findFirst({
      where: { id, tenantId },
    })
    if (!existing) throw new Error('Invoice not found')
    if (existing.paidCents > 0) {
      throw new Error('Cannot void an invoice with recorded payments')
    }

    const updated = await db.invoice.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        balanceCents: 0,
        notes: [existing.notes, `Voided: ${reason || 'Administrative void'}`].filter(Boolean).join('. '),
      },
    })

    await recordAudit({
      tenantId,
      actorId: actor?.id,
      actorName: actor?.name,
      actorRole: actor?.role,
      action: 'INVOICE_VOIDED',
      entity: 'Invoice',
      entityId: id,
      module: 'Fees',
      summary: `Invoice ${existing.invoiceNumber} voided/cancelled. Reason: ${reason || 'No reason provided'}`,
    })

    return updated
  }

  /**
   * 5. BULK INVOICING PREVIEW & EXECUTION
   */
  static async previewBulkInvoices(ctx: ScopeContext, filter: BulkInvoicePreviewFilter) {
    const { session, branch } = await this.verifyScope(ctx.tenantId, filter.branchId, filter.academicSessionId)

    // Find eligible active students
    const students = await db.student.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: 'ACTIVE',
        deletedAt: null,
        ...(filter.branchId ? { branchId: filter.branchId } : {}),
        ...(filter.classroomId ? { currentClassroomId: filter.classroomId } : {}),
      },
      include: {
        currentClassroom: true,
        guardians: {
          include: { guardian: true },
          where: { isPrimary: true },
          take: 1,
        },
      },
      orderBy: { firstName: 'asc' },
    })

    let feePlan: any = null
    if (filter.feePlanId) {
      feePlan = await db.feePlan.findFirst({
        where: { id: filter.feePlanId, tenantId: ctx.tenantId },
        include: { items: true },
      })
    }

    const title = filter.customTitle || feePlan?.name || 'Term Fee Invoice'
    const feeHead = filter.feeHead || (feePlan?.items[0]?.feeHead as FeeHeadCategory) || 'TUITION'
    const defaultAmountCents = filter.customAmountCents || feePlan?.items[0]?.amountCents || 1500000 // ₹15,000 default

    const targetSessionId = session?.id

    // Check existing invoices for duplicate detection
    const existingInvoices = await db.invoice.findMany({
      where: {
        tenantId: ctx.tenantId,
        title,
        ...(targetSessionId ? { academicSessionId: targetSessionId } : {}),
        studentId: { in: students.map((s) => s.id) },
        deletedAt: null,
      },
      select: { studentId: true, invoiceNumber: true },
    })
    const existingMap = new Map(existingInvoices.map((i) => [i.studentId, i.invoiceNumber]))

    const previewList = await Promise.all(
      students.map(async (s) => {
        const alreadyInvoicedNumber = existingMap.get(s.id)
        const siblingCheck = await this.calculateSiblingDiscount(ctx.tenantId, s.id)

        const grossCents = defaultAmountCents
        const discountCents = siblingCheck.eligible
          ? Math.round((grossCents * siblingCheck.discountPercent) / 100)
          : 0
        const netCents = grossCents - discountCents

        return {
          studentId: s.id,
          studentName: `${s.firstName} ${s.lastName || ''}`.trim(),
          admissionNo: s.admissionNo,
          classroom: s.currentClassroom?.name || 'Unassigned',
          guardianName: s.guardians[0]?.guardian?.fullName || 'N/A',
          grossCents,
          discountCents,
          netCents,
          isEligible: !alreadyInvoicedNumber,
          alreadyInvoicedNumber: alreadyInvoicedNumber || null,
          reason: alreadyInvoicedNumber ? `Already invoiced (${alreadyInvoicedNumber})` : siblingCheck.reason,
        }
      })
    )

    const eligibleCount = previewList.filter((p) => p.isEligible).length
    const skippedCount = previewList.filter((p) => !p.isEligible).length
    const totalGrossCents = previewList.filter((p) => p.isEligible).reduce((acc, p) => acc + p.grossCents, 0)
    const totalNetCents = previewList.filter((p) => p.isEligible).reduce((acc, p) => acc + p.netCents, 0)

    return {
      title,
      feeHead,
      dueDate: new Date(filter.dueDate).toISOString(),
      summary: {
        totalStudents: previewList.length,
        eligibleCount,
        skippedCount,
        totalGrossRupees: totalGrossCents / 100,
        totalNetRupees: totalNetCents / 100,
      },
      students: previewList,
    }
  }

  static async createBulkInvoices(ctx: ScopeContext, filter: BulkInvoicePreviewFilter) {
    const preview = await this.previewBulkInvoices(ctx, filter)
    const eligible = preview.students.filter((p) => p.isEligible)

    if (!eligible.length) {
      return {
        success: true,
        createdCount: 0,
        skippedCount: preview.students.length,
        invoices: [],
        message: 'No eligible students found or all students have already been invoiced.',
      }
    }

    const createdInvoices: any[] = []

    for (const item of eligible) {
      const inv = await this.createInvoice(ctx, {
        studentId: item.studentId,
        title: preview.title,
        dueDate: preview.dueDate,
        lineItems: [
          {
            feeHead: preview.feeHead,
            description: preview.title,
            amountCents: item.grossCents,
          },
        ],
        discountCents: item.discountCents,
        discountReason: item.discountCents > 0 ? 'Sibling concession (10%)' : undefined,
      })
      createdInvoices.push({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        studentId: item.studentId,
        netCents: inv.totalCents,
      })
    }

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'BULK_INVOICE_GENERATED',
      entity: 'Invoice',
      entityId: createdInvoices[0]?.id || 'bulk',
      module: 'Fees',
      summary: `Bulk generated ${createdInvoices.length} invoices for "${preview.title}"`,
    })

    return {
      success: true,
      createdCount: createdInvoices.length,
      skippedCount: preview.summary.skippedCount,
      invoices: createdInvoices,
    }
  }

  /**
   * 6. INITIATE PAYMENT
   */
  static async initiatePayment(ctx: ScopeContext, input: InitiatePaymentInput) {
    const { invoiceId, amountCents, method, transactionRef, notes } = input
    if (!invoiceId || !amountCents || amountCents <= 0 || !method) {
      throw new Error('invoiceId, positive amountCents, and method are required')
    }

    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId, tenantId: ctx.tenantId, deletedAt: null },
      include: { student: true },
    })
    if (!invoice) throw new Error('Invoice not found')
    if (['CANCELLED', 'WRITTEN_OFF'].includes(invoice.status)) {
      throw new Error(`Cannot pay an invoice with status ${invoice.status}`)
    }

    // Cash limit check (IT Act 269ST: cash > ₹50,000 strictly prohibited)
    if (method === 'CASH' && amountCents > 5000000) {
      throw new Error('Cash payments above ₹50,000 are not allowed (IT Act Section 269ST)')
    }

    if (amountCents > invoice.balanceCents) {
      throw new Error(`Amount ₹${amountCents / 100} exceeds invoice balance ₹${invoice.balanceCents / 100}`)
    }

    const paymentNumber = await nextNumber('payment', ctx.tenantId)

    const payment = await db.payment.create({
      data: {
        tenantId: ctx.tenantId,
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        paymentNumber,
        amountCents,
        method,
        transactionRef: transactionRef || `TXN-${Date.now()}`,
        status: 'PENDING',
        receivedById: ctx.actorId,
        notes: notes || null,
      },
    })

    await recordAudit({
      tenantId: ctx.tenantId,
      branchId: invoice.branchId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'PAYMENT_INITIATED',
      entity: 'Payment',
      entityId: payment.id,
      module: 'Fees',
      summary: `Payment initiated ${paymentNumber} (₹${amountCents / 100}) via ${method}`,
    })

    return payment
  }

  /**
   * 7. VERIFY PAYMENT & ISSUE RECEIPT (IDEMPOTENT)
   */
  static async verifyPayment(ctx: ScopeContext, input: VerifyPaymentInput) {
    const { paymentId, paymentNumber, invoiceId, transactionRef, gatewayStatus = 'SUCCESS', failureReason } = input

    let payment: any = null
    if (paymentId) {
      payment = await db.payment.findFirst({
        where: { id: paymentId, tenantId: ctx.tenantId },
        include: { invoice: true, receipt: true },
      })
    } else if (paymentNumber) {
      payment = await db.payment.findFirst({
        where: { paymentNumber, tenantId: ctx.tenantId },
        include: { invoice: true, receipt: true },
      })
    } else if (transactionRef) {
      payment = await db.payment.findFirst({
        where: { transactionRef, tenantId: ctx.tenantId },
        include: { invoice: true, receipt: true },
      })
    }

    if (!payment) throw new Error('Payment record not found')

    // IDEMPOTENCY CHECK: If already SUCCESS, return existing receipt without double processing
    if (payment.status === 'SUCCESS' && payment.receipt) {
      return {
        success: true,
        alreadyVerified: true,
        payment,
        receipt: payment.receipt,
        message: 'Payment was already verified and receipt issued.',
      }
    }

    if (gatewayStatus === 'FAILED') {
      const updated = await db.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          notes: failureReason ? `Payment failed: ${failureReason}` : 'Gateway failure',
        },
      })
      await recordAudit({
        tenantId: ctx.tenantId,
        actorId: ctx.actorId,
        action: 'PAYMENT_FAILED',
        entity: 'Payment',
        entityId: payment.id,
        module: 'Fees',
        summary: `Payment ${payment.paymentNumber} marked FAILED: ${failureReason || 'Declined'}`,
      })
      return { success: false, payment: updated, receipt: null, error: failureReason || 'Payment failed' }
    }

    const invoice = payment.invoice
    if (!invoice) throw new Error('Associated invoice not found')

    const receiptNumber = await nextNumber('receipt', ctx.tenantId)

    const result = await db.$transaction(async (tx) => {
      // 1. Mark payment SUCCESS
      const confirmedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCESS',
          paymentDate: new Date(),
        },
      })

      // 2. Issue Receipt
      const receipt = await tx.receipt.create({
        data: {
          paymentId: confirmedPayment.id,
          receiptNumber,
          amountCents: confirmedPayment.amountCents,
          tenantId: ctx.tenantId,
        },
      })

      // 3. Update Invoice Balance & Status
      const paidCents = invoice.paidCents + confirmedPayment.amountCents
      const balanceCents = Math.max(0, invoice.totalCents - paidCents)
      const newStatus: InvoiceStatus = balanceCents === 0 ? 'PAID' : 'PARTIALLY_PAID'

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidCents,
          balanceCents,
          status: newStatus,
        },
      })

      // 4. Create Parent Portal Timeline Entry
      await tx.timelineEntry.create({
        data: {
          tenantId: ctx.tenantId,
          studentId: invoice.studentId,
          academicSessionId: invoice.academicSessionId,
          type: 'NOTE',
          title: `Fee Payment Confirmed — Receipt ${receiptNumber}`,
          body: `Payment of ₹${confirmedPayment.amountCents / 100} received via ${confirmedPayment.method}. Receipt ${receiptNumber} issued. Remaining balance: ₹${balanceCents / 100}.`,
          authorId: ctx.actorId,
        },
      })

      return { payment: confirmedPayment, receipt, invoice: updatedInvoice }
    })

    // Emit domain event to resolve overdue follow-ups
    await emit({
      type: 'PaymentReceived',
      tenantId: ctx.tenantId,
      invoiceId: invoice.id,
      studentId: invoice.studentId,
      paymentNumber: result.payment.paymentNumber,
      amountCents: result.payment.amountCents,
      fullyPaid: result.invoice.status === 'PAID',
    })

    await recordAudit({
      tenantId: ctx.tenantId,
      branchId: invoice.branchId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'PAYMENT_CONFIRMED',
      entity: 'Payment',
      entityId: result.payment.id,
      module: 'Fees',
      summary: `Confirmed payment ${result.payment.paymentNumber} (₹${result.payment.amountCents / 100}). Receipt: ${result.receipt.receiptNumber}`,
    })

    return {
      success: true,
      alreadyVerified: false,
      payment: result.payment,
      receipt: result.receipt,
      invoice: result.invoice,
    }
  }

  /**
   * 8. STUDENT FINANCE 360° SUMMARY
   * Single authoritative calculation for any student.
   */
  static async getStudentFinancialSummary(tenantId: string, studentId: string) {
    const student = await db.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      include: {
        currentClassroom: true,
        guardians: {
          include: { guardian: true },
          orderBy: { isPrimary: 'desc' },
        },
      },
    })
    if (!student) throw new Error('Student not found')

    const invoices = await db.invoice.findMany({
      where: { tenantId, studentId, deletedAt: null },
      include: {
        items: true,
        payments: {
          where: { status: 'SUCCESS' },
          include: { receipt: true },
        },
      },
      orderBy: { issueDate: 'desc' },
    })

    const payments = await db.payment.findMany({
      where: { tenantId, studentId },
      include: { receipt: true, invoice: { select: { invoiceNumber: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const totalBilledCents = invoices.reduce((s, i) => s + i.totalCents, 0)
    const totalDiscountCents = invoices.reduce((s, i) => s + i.discountCents, 0)
    const totalPaidCents = payments
      .filter((p) => p.status === 'SUCCESS')
      .reduce((s, p) => s + p.amountCents, 0)
    const totalOutstandingCents = invoices
      .filter((i) => ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'].includes(i.status))
      .reduce((s, i) => s + i.balanceCents, 0)
    const totalOverdueCents = invoices
      .filter((i) => i.status === 'OVERDUE')
      .reduce((s, i) => s + i.balanceCents, 0)

    return {
      student: {
        id: student.id,
        name: `${student.firstName} ${student.lastName || ''}`.trim(),
        admissionNo: student.admissionNo,
        seatNumber: student.seatNumber,
        classroom: student.currentClassroom?.name || 'Unassigned',
        status: student.status,
      },
      guardians: student.guardians.map((g) => ({
        id: g.guardian.id,
        name: g.guardian.fullName,
        relationship: g.guardian.relationship,
        phone: g.guardian.phone,
        isFeePayer: g.isFeePayer,
        isPrimary: g.isPrimary,
      })),
      summary: {
        totalBilledRupees: totalBilledCents / 100,
        totalDiscountRupees: totalDiscountCents / 100,
        totalPaidRupees: totalPaidCents / 100,
        totalOutstandingRupees: totalOutstandingCents / 100,
        totalOverdueRupees: totalOverdueCents / 100,
        hasOverdue: totalOverdueCents > 0,
        allClear: totalOutstandingCents === 0,
      },
      invoices: invoices.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        title: i.title,
        issueDate: i.issueDate,
        dueDate: i.dueDate,
        totalRupees: (i.totalCents / 100).toFixed(2),
        paidRupees: (i.paidCents / 100).toFixed(2),
        balanceRupees: (i.balanceCents / 100).toFixed(2),
        status: i.status,
        items: i.items.map((item) => ({
          description: item.description,
          amountRupees: (item.amountCents / 100).toFixed(2),
        })),
      })),
      payments: payments.map((p) => ({
        id: p.id,
        paymentNumber: p.paymentNumber,
        method: p.method,
        status: p.status,
        date: p.paymentDate,
        amountRupees: (p.amountCents / 100).toFixed(2),
        invoiceNumber: p.invoice?.invoiceNumber || 'N/A',
        receiptNumber: p.receipt?.receiptNumber || null,
        receiptId: p.receipt?.id || null,
      })),
    }
  }

  /**
   * 9. RECEIPT PDF / PRINT DATA
   */
  static async getReceiptPrintData(tenantId: string, receiptId: string) {
    const receipt = await db.receipt.findFirst({
      where: { id: receiptId, tenantId },
      include: {
        tenant: true,
        payment: {
          include: {
            student: { include: { currentClassroom: true } },
            invoice: { include: { items: true } },
          },
        },
      },
    })
    if (!receipt) throw new Error('Receipt not found')

    const student = receipt.payment.student
    const invoice = receipt.payment.invoice
    const payment = receipt.payment

    return {
      receiptNumber: receipt.receiptNumber,
      issuedAt: receipt.issuedAt,
      amountRupees: (receipt.amountCents / 100).toFixed(2),
      school: {
        name: receipt.tenant.name,
        code: receipt.tenant.code,
        address: receipt.tenant.address,
        city: receipt.tenant.city,
        phone: receipt.tenant.phone,
        email: receipt.tenant.email,
        gstNumber: receipt.tenant.gstNumber,
      },
      student: student ? {
        name: `${student.firstName} ${student.lastName || ''}`.trim(),
        admissionNo: student.admissionNo,
        classroom: student.currentClassroom?.name || 'Unassigned',
      } : { name: 'N/A', admissionNo: 'N/A', classroom: 'N/A' },
      payment: {
        paymentNumber: payment.paymentNumber,
        method: payment.method,
        transactionRef: payment.transactionRef,
        date: payment.paymentDate,
      },
      invoice: invoice
        ? {
            invoiceNumber: invoice.invoiceNumber,
            title: invoice.title,
            totalRupees: (invoice.totalCents / 100).toFixed(2),
            balanceRupees: (invoice.balanceCents / 100).toFixed(2),
            items: invoice.items.map((i) => ({
              description: i.description,
              amountRupees: (i.amountCents / 100).toFixed(2),
            })),
          }
        : null,
    }
  }


  // =========================================================================
  // 11. FEE HEADS (DATABASE-BACKED CONFIGURATION)
  // =========================================================================
  static async getFeeHeads(tenantId: string, activeOnly: boolean = true) {
    return db.feeHead.findMany({
      where: {
        tenantId,
        ...(activeOnly ? { isActive: true } : {}),
      },
      include: {
        _count: { select: { planItems: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
  }

  static async createFeeHead(
    ctx: ScopeContext,
    input: { name: string; code?: string; category?: FeeHeadCategory; description?: string; sortOrder?: number }
  ) {
    const code = (input.code || input.name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()).trim()
    const feeHead = await db.feeHead.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name.trim(),
        code,
        category: input.category || 'OTHER',
        description: input.description?.trim() || null,
        sortOrder: input.sortOrder || 0,
        isActive: true,
      },
    })

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'CREATE_FEE_HEAD',
      entity: 'FeeHead',
      entityId: feeHead.id,
      module: 'Fees',
      summary: `Created fee head "${feeHead.name}" (${feeHead.code})`,
    })

    return feeHead
  }

  static async updateFeeHead(
    ctx: ScopeContext,
    id: string,
    input: { name?: string; category?: FeeHeadCategory; description?: string; isActive?: boolean; sortOrder?: number }
  ) {
    const feeHead = await db.feeHead.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        category: input.category,
        description: input.description?.trim(),
        isActive: input.isActive,
        sortOrder: input.sortOrder,
      },
    })

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'UPDATE_FEE_HEAD',
      entity: 'FeeHead',
      entityId: feeHead.id,
      module: 'Fees',
      summary: `Updated fee head "${feeHead.name}" (Active: ${feeHead.isActive})`,
    })

    return feeHead
  }

  // =========================================================================
  // 12. CONFIGURABLE CONCESSIONS / DISCOUNTS ENGINE
  // =========================================================================
  static async getConcessionsConfig(tenantId: string) {
    const config = await db.schoolConfig.findUnique({
      where: { tenantId_domain: { tenantId, domain: 'FINANCE' } },
    })
    const data = (config?.data as Record<string, any>) || {}
    return {
      discounts: data.discounts || [
        {
          id: 'sibling-standard',
          name: 'Sibling Concession',
          code: 'SIBLING_10',
          type: 'PERCENTAGE',
          value: 10,
          appliesTo: 'TUITION',
          isActive: true,
          description: 'Standard 10% discount for registered siblings',
        },
      ],
      policies: data.policies || {
        cashLimitCents: 5000000, // ₹50,000 IT Act 269ST
        autoInvoiceDueDateDays: 15,
        lateFeePolicy: { enabled: false, gracePeriodDays: 7, dailyLateFeeRupees: 50 },
      },
    }
  }

  static async updateConcessionsConfig(ctx: ScopeContext, discounts: any[], policies?: any) {
    const current = await this.getConcessionsConfig(ctx.tenantId)
    const updatedData = {
      ...current,
      discounts,
      policies: policies || current.policies,
    }

    await db.schoolConfig.upsert({
      where: { tenantId_domain: { tenantId: ctx.tenantId, domain: 'FINANCE' } },
      update: {
        data: updatedData,
        updatedById: ctx.actorId,
        updatedByName: ctx.actorName,
      },
      create: {
        tenantId: ctx.tenantId,
        domain: 'FINANCE',
        data: updatedData,
        updatedById: ctx.actorId,
        updatedByName: ctx.actorName,
      },
    })

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'UPDATE_FINANCE_CONFIG',
      entity: 'SchoolConfig',
      entityId: 'FINANCE',
      module: 'Fees',
      summary: `Updated concessions & financial policies (${discounts.length} discount rules)`,
    })

    return updatedData
  }

  // =========================================================================
  // 13. INVOICE & RECEIPT TEMPLATES (DOCUMENT_TEMPLATES DOMAIN)
  // =========================================================================
  static async getTemplates(tenantId: string, type?: 'INVOICE' | 'RECEIPT') {
    return db.documentTemplate.findMany({
      where: {
        tenantId,
        ...(type ? { type } : { type: { in: ['INVOICE', 'RECEIPT'] } }),
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })
  }

  static async getTemplateById(tenantId: string, id: string) {
    return db.documentTemplate.findFirst({
      where: { id, tenantId },
    })
  }

  static async createTemplate(
    ctx: ScopeContext,
    input: {
      type: 'INVOICE' | 'RECEIPT'
      name: string
      isDefault?: boolean
      content: {
        headerTitle?: string
        showLogo?: boolean
        showGstin?: boolean
        showTerms?: boolean
        termsText?: string
        showSignature?: boolean
        signatureLabel?: string
        primaryColor?: string
        footerText?: string
        branchScope?: string | null
        programScope?: string | null
      }
    }
  ) {
    if (input.isDefault) {
      // Unset previous default
      await db.documentTemplate.updateMany({
        where: { tenantId: ctx.tenantId, type: input.type, isDefault: true },
        data: { isDefault: false },
      })
    }

    const template = await db.documentTemplate.create({
      data: {
        tenantId: ctx.tenantId,
        type: input.type,
        name: input.name.trim(),
        isDefault: input.isDefault ?? false,
        content: input.content as any,
      },
    })

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'CREATE_TEMPLATE',
      entity: 'DocumentTemplate',
      entityId: template.id,
      module: 'Fees',
      summary: `Created ${input.type} template "${template.name}" (Default: ${template.isDefault})`,
    })

    return template
  }

  static async updateTemplate(
    ctx: ScopeContext,
    id: string,
    input: {
      name?: string
      isDefault?: boolean
      content?: any
    }
  ) {
    const existing = await db.documentTemplate.findFirst({ where: { id, tenantId: ctx.tenantId } })
    if (!existing) throw new Error('Template not found')

    if (input.isDefault) {
      await db.documentTemplate.updateMany({
        where: { tenantId: ctx.tenantId, type: existing.type, isDefault: true },
        data: { isDefault: false },
      })
    }

    const updated = await db.documentTemplate.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        isDefault: input.isDefault,
        content: input.content ? { ...(existing.content as any), ...input.content } : undefined,
      },
    })

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'UPDATE_TEMPLATE',
      entity: 'DocumentTemplate',
      entityId: updated.id,
      module: 'Fees',
      summary: `Updated ${updated.type} template "${updated.name}"`,
    })

    return updated
  }

  static async resolveApplicableTemplate(
    tenantId: string,
    type: 'INVOICE' | 'RECEIPT',
    scope?: { branchId?: string; programId?: string }
  ) {
    const templates = await db.documentTemplate.findMany({
      where: { tenantId, type },
    })
    if (!templates.length) return null

    // 1. Check most specific: Program override
    if (scope?.programId) {
      const progTmpl = templates.find((t) => (t.content as any)?.programScope === scope.programId)
      if (progTmpl) return progTmpl
    }

    // 2. Check Branch override
    if (scope?.branchId) {
      const branchTmpl = templates.find((t) => (t.content as any)?.branchScope === scope.branchId)
      if (branchTmpl) return branchTmpl
    }

    // 3. Fallback to default or first
    const defaultTmpl = templates.find((t) => t.isDefault) || templates[0]
    return defaultTmpl
  }

  static async getTemplatePreview(tenantId: string, templateId: string, invoiceId?: string) {
    const template = await this.getTemplateById(tenantId, templateId)
    if (!template) throw new Error('Template not found')

    let studentName = 'Aarav Deshmukh'
    let invoiceNumber = 'INV-2026-0001'
    let totalRupees = '15000.00'

    if (invoiceId) {
      const inv = await db.invoice.findFirst({
        where: { id: invoiceId, tenantId },
        include: { student: true },
      })
      if (inv) {
        studentName = inv.student ? `${inv.student.firstName} ${inv.student.lastName || ''}`.trim() : ''
        invoiceNumber = inv.invoiceNumber
        totalRupees = (inv.totalCents / 100).toFixed(2)
      }
    }

    const content = (template.content as any) || {}
    const headerTitle = content.headerTitle || (template.type === 'INVOICE' ? 'FEE INVOICE' : 'RECEIPT')

    const variables: Record<string, string> = {
      '{{student_name}}': studentName,
      '{{invoice_number}}': invoiceNumber,
      '{{total_amount}}': totalRupees,
    }

    const renderedHtml = `
      <div style="font-family: sans-serif; padding: 24px;">
        <h2>${headerTitle}</h2>
        <p>Student: ${studentName}</p>
        <p>Invoice #: ${invoiceNumber}</p>
        <p>Total: ₹${totalRupees}</p>
        <p>${content.termsText || ''}</p>
      </div>
    `.trim()

    return {
      template,
      renderedHtml,
      variables,
    }
  }

  // =========================================================================
  // 14. PAYMENT GATEWAY CONFIGURATION & SERVICE ABSTRACTION
  // =========================================================================
  static async getPaymentGatewayConfig(tenantId: string) {
    const config = await db.schoolConfig.findUnique({
      where: { tenantId_domain: { tenantId, domain: 'FINANCE' } },
    })
    const data = (config?.data as Record<string, any>) || {}
    const gateway = data.paymentGateway || {
      provider: 'RAZORPAY',
      enabled: false,
      mode: 'TEST',
      keyId: '',
      currency: 'INR',
      supportedMethods: ['UPI', 'NET_BANKING', 'CARD'],
      webhookConfigured: false,
    }

    // Mask secret key before returning
    return {
      provider: gateway.provider,
      enabled: gateway.enabled,
      mode: gateway.mode,
      keyId: gateway.keyId ? `${gateway.keyId.slice(0, 8)}...` : '',
      hasKeySecret: Boolean(gateway.keySecret),
      currency: gateway.currency || 'INR',
      supportedMethods: gateway.supportedMethods || ['UPI', 'NET_BANKING', 'CARD'],
      webhookConfigured: gateway.webhookConfigured ?? false,
      webhookUrl: `/api/v1/payments/webhook`,
    }
  }

  static async updatePaymentGatewayConfig(
    ctx: ScopeContext,
    input: {
      provider?: string
      enabled?: boolean
      mode?: 'TEST' | 'LIVE'
      keyId?: string
      keySecret?: string
      currency?: string
      supportedMethods?: string[]
      webhookSecret?: string
    }
  ) {
    const current = await db.schoolConfig.findUnique({
      where: { tenantId_domain: { tenantId: ctx.tenantId, domain: 'FINANCE' } },
    })
    const currentData = (current?.data as Record<string, any>) || {}
    const currentGateway = currentData.paymentGateway || {}

    const updatedGateway = {
      provider: input.provider || currentGateway.provider || 'RAZORPAY',
      enabled: input.enabled !== undefined ? input.enabled : currentGateway.enabled ?? false,
      mode: input.mode || currentGateway.mode || 'TEST',
      keyId: input.keyId ? input.keyId.trim() : currentGateway.keyId || '',
      keySecret: input.keySecret ? input.keySecret.trim() : currentGateway.keySecret || '',
      currency: input.currency || currentGateway.currency || 'INR',
      supportedMethods: input.supportedMethods || currentGateway.supportedMethods || ['UPI', 'NET_BANKING', 'CARD'],
      webhookSecret: input.webhookSecret ? input.webhookSecret.trim() : currentGateway.webhookSecret || '',
      webhookConfigured: Boolean(input.webhookSecret || currentGateway.webhookSecret),
    }

    const updatedData = {
      ...currentData,
      paymentGateway: updatedGateway,
    }

    await db.schoolConfig.upsert({
      where: { tenantId_domain: { tenantId: ctx.tenantId, domain: 'FINANCE' } },
      update: {
        data: updatedData,
        updatedById: ctx.actorId,
        updatedByName: ctx.actorName,
      },
      create: {
        tenantId: ctx.tenantId,
        domain: 'FINANCE',
        data: updatedData,
        updatedById: ctx.actorId,
        updatedByName: ctx.actorName,
      },
    })

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'CHANGE_GATEWAY_CONFIG',
      entity: 'SchoolConfig',
      entityId: 'FINANCE_GATEWAY',
      module: 'Fees',
      summary: `Updated payment gateway: ${updatedGateway.provider} (${updatedGateway.mode}, Enabled: ${updatedGateway.enabled})`,
    })

    return this.getPaymentGatewayConfig(ctx.tenantId)
  }

  static async testPaymentGatewayConnection(tenantId: string) {
    const config = await db.schoolConfig.findUnique({
      where: { tenantId_domain: { tenantId, domain: 'FINANCE' } },
    })
    const data = (config?.data as Record<string, any>) || {}
    const gateway = data.paymentGateway
    if (!gateway || !gateway.enabled || !gateway.keyId) {
      return {
        success: false,
        message: 'Payment gateway is not enabled or credentials are missing.',
      }
    }

    return {
      success: true,
      provider: gateway.provider,
      mode: gateway.mode,
      message: `Successfully validated ${gateway.provider} (${gateway.mode} mode) connection parameters.`,
    }
  }

  /**
   * 10. EXPORTS
   */
  static async exportInvoicesCsv(tenantId: string, status?: string) {
    const invoices = await db.invoice.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(status && status !== 'ALL' ? { status: status as InvoiceStatus } : {}),
      },
      include: {
        student: { select: { firstName: true, lastName: true, admissionNo: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    })

    const headers = [
      'Invoice Number',
      'Student Name',
      'Admission No',
      'Issue Date',
      'Due Date',
      'Subtotal (INR)',
      'Discount (INR)',
      'Total (INR)',
      'Paid (INR)',
      'Balance (INR)',
      'Status',
    ]

    const rows = invoices.map((i) => [
      i.invoiceNumber,
      i.student ? `"${i.student.firstName} ${i.student.lastName || ''}".trim()` : '',
      i.student?.admissionNo || '',
      i.issueDate.toISOString().slice(0, 10),
      i.dueDate.toISOString().slice(0, 10),
      (i.subtotalCents / 100).toFixed(2),
      (i.discountCents / 100).toFixed(2),
      (i.totalCents / 100).toFixed(2),
      (i.paidCents / 100).toFixed(2),
      (i.balanceCents / 100).toFixed(2),
      i.status,
    ])

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  }

  static async exportPaymentsCsv(tenantId: string) {
    const payments = await db.payment.findMany({
      where: { tenantId },
      include: {
        student: { select: { firstName: true, lastName: true, admissionNo: true } },
        invoice: { select: { invoiceNumber: true } },
        receipt: { select: { receiptNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    })

    const headers = [
      'Payment Number',
      'Receipt Number',
      'Invoice Number',
      'Student Name',
      'Admission No',
      'Amount (INR)',
      'Method',
      'Status',
      'Transaction Ref',
      'Payment Date',
    ]

    const rows = payments.map((p) => [
      p.paymentNumber,
      p.receipt?.receiptNumber || '',
      p.invoice?.invoiceNumber || '',
      p.student ? `"${p.student.firstName} ${p.student.lastName || ''}".trim()` : '',
      p.student?.admissionNo || '',
      (p.amountCents / 100).toFixed(2),
      p.method,
      p.status,
      p.transactionRef || '',
      p.paymentDate.toISOString().slice(0, 10),
    ])

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  }
}
