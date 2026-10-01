import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, withApi, errPermission, errValidation, errNotFound } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { audit, nextNumber } from '@/lib/sequence'
import { resolveSessionId } from '@/lib/academic'
import { emit } from '@/lib/events'
import { registerIntegrations } from '@/lib/integrations'

/**
 * Overdue sync — ISSUED + dueDate < today → OVERDUE (Spec §23, Scenario 7).
 * Called on read so the ledger is always truthful; transitions audited via
 * InvoiceOverdue follow-up events (deduped per invoice).
 */
async function syncOverdue(tenantId: string) {
  const now = new Date()
  const stale = await db.invoice.findMany({
    where: { tenantId, status: 'ISSUED', dueDate: { lt: now }, deletedAt: null },
    select: { id: true, studentId: true, invoiceNumber: true, balanceCents: true },
    take: 200,
  })
  for (const inv of stale) {
    await db.invoice.update({ where: { id: inv.id }, data: { status: 'OVERDUE' } })
    await emit({
      type: 'InvoiceOverdue',
      tenantId,
      invoiceId: inv.id,
      studentId: inv.studentId,
      invoiceNumber: inv.invoiceNumber,
      balanceCents: inv.balanceCents,
    })
  }
  return stale.length
}

/** GET /api/v1/invoices — list w/ filters (studentId, status) */
export const GET = withApi(async (req: NextRequest) => {
  const session = await requireApi(req, 'finance:read')
  if (isResponse(session)) return session
  if (!session.tenantId) {
    throw errPermission('No tenant context found in active session')
  }

  const sp = req.nextUrl.searchParams
  const studentId = sp.get('studentId')
  const status = sp.get('status')
  const page = Math.max(1, parseInt(sp.get('page') || '1'))
  const pageSize = Math.min(100, parseInt(sp.get('pageSize') || '50'))

  await syncOverdue(session.tenantId)

  const where = {
    tenantId: session.tenantId,
    deletedAt: null,
    ...(studentId ? { studentId } : {}),
    ...(status ? { status: status as 'ISSUED' } : {}),
  }

  const [total, invoices] = await Promise.all([
    db.invoice.count({ where }),
    db.invoice.findMany({
      where,
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            admissionNo: true,
            guardians: {
              include: { guardian: { select: { fullName: true } } },
              where: { isFeePayer: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return ok(
    invoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      title: i.title,
      studentName: `${i.student.firstName} ${i.student.lastName || ''}`.trim(),
      admissionNo: i.student.admissionNo,
      feePayer: i.student.guardians[0]?.guardian.fullName ?? null,
      issueDate: i.issueDate,
      dueDate: i.dueDate,
      subtotalCents: i.subtotalCents,
      totalCents: i.totalCents,
      paidCents: i.paidCents,
      balanceCents: i.balanceCents,
      status: i.status,
    })),
    { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
  )
}, { module: 'fees' })

/** POST /api/v1/invoices — create manual invoice (finance:write) */
export const POST = withApi(async (req: NextRequest) => {
  const session = await requireApi(req, 'finance:write')
  if (isResponse(session)) return session
  if (!session.tenantId) {
    throw errPermission('No tenant context found in active session')
  }
  registerIntegrations()

  const body = await req.json()
  const { studentId, title, dueDate, lineItems } = body as {
    studentId: string
    title?: string
    dueDate: string
    lineItems: { description: string; amountCents: number; feeHead?: string }[]
  }
  if (!studentId || !dueDate || !Array.isArray(lineItems) || lineItems.length === 0) {
    throw errValidation('studentId, dueDate and lineItems[] are required', 'lineItems')
  }

  const student = await db.student.findFirst({
    where: { id: studentId, tenantId: session.tenantId },
  })
  if (!student) {
    throw errNotFound('Student')
  }

  const subtotal = lineItems.reduce((s, i) => s + Math.round(i.amountCents), 0)
  const invoiceNumber = await nextNumber('invoice', session.tenantId)
  const sessionRow = await resolveSessionId(session.tenantId, {
    classroomId: student.currentClassroomId,
  })

  const invoice = await db.invoice.create({
    data: {
      tenantId: session.tenantId,
      branchId: student.branchId,
      studentId,
      invoiceNumber,
      title: title || 'Fee Invoice',
      dueDate: new Date(dueDate),
      subtotalCents: subtotal,
      totalCents: subtotal,
      balanceCents: subtotal,
      status: 'ISSUED',
      issuedById: session.uid,
      academicSessionId: sessionRow?.id,
      items: {
        create: lineItems.map((i) => ({
          feeHead: (i.feeHead as 'TUITION') || 'OTHER',
          description: i.description,
          amountCents: Math.round(i.amountCents),
        })),
      },
    },
  })

  await emit({
    type: 'InvoiceIssued',
    tenantId: session.tenantId,
    invoiceId: invoice.id,
    studentId,
    invoiceNumber,
    totalCents: subtotal,
    dueDate: new Date(dueDate),
  })

  await audit({
    tenantId: session.tenantId,
    actorId: session.uid,
    actorName: session.name,
    action: 'CREATE',
    entity: 'Invoice',
    entityId: invoice.id,
    summary: `Invoice ${invoiceNumber} raised for ${student.firstName}`,
  })

  return ok({ invoiceId: invoice.id, invoiceNumber }, undefined, 201)
}, { module: 'fees' })
