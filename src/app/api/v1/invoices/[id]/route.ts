import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { recordAudit } from '@/lib/audit'

async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'finance:read')
  if (isResponse(session)) return session
  const { id } = await params

  try {
    const invoice = await db.invoice.findFirst({
      where: { id, tenantId: session.tenantId },
      include: {
        student: {
          select: {
            firstName: true, lastName: true, admissionNo: true,
            currentClassroom: { select: { name: true } },
          },
        },
        items: true,
        payments: { include: { receipt: true }, orderBy: { paymentDate: 'desc' } },
      },
    })
    if (!invoice) return Errors.notFound('Invoice')

    return ok({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      title: invoice.title,
      student: {
        name: `${invoice.student.firstName} ${invoice.student.lastName || ''}`.trim(),
        admissionNo: invoice.student.admissionNo,
        classroom: invoice.student.currentClassroom?.name,
      },
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      items: invoice.items.map((i) => ({
        feeHead: i.feeHead, description: i.description, amountCents: i.amountCents,
      })),
      subtotalCents: invoice.subtotalCents,
      discountCents: invoice.discountCents,
      totalCents: invoice.totalCents,
      paidCents: invoice.paidCents,
      balanceCents: invoice.balanceCents,
      status: invoice.status,
      notes: invoice.notes,
      payments: invoice.payments.map((p) => ({
        id: p.id,
        paymentNumber: p.paymentNumber,
        amountCents: p.amountCents,
        method: p.method,
        status: p.status,
        paymentDate: p.paymentDate,
        receiptId: p.receipt?.id ?? null,
        receiptNumber: p.receipt?.receiptNumber ?? null,
      })),
    })
  } catch (e) {
    return Errors.system(e)
  }
}

async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'finance:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params

  try {
    const body = await req.json()
    const { action, reason, notes } = body

    const existing = await db.invoice.findFirst({
      where: { id, tenantId: session.tenantId },
    })
    if (!existing) return Errors.notFound('Invoice')

    if (action === 'VOID' || action === 'CANCEL') {
      if (existing.paidCents > 0) {
        return Errors.conflict('Cannot void an invoice with recorded payments')
      }

      const updated = await db.invoice.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          notes: [existing.notes, `Voided by ${session.name}: ${reason || 'Administrative void'}`].filter(Boolean).join('. '),
        },
      })

      await recordAudit({
        tenantId: session.tenantId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
        action: 'VOID_INVOICE',
        entity: 'Invoice',
        entityId: id,
        module: 'Fees',
        summary: `Voided invoice ${existing.invoiceNumber}: ${reason || 'N/A'}`,
      })

      return ok(updated)
    }

    if (notes) {
      const updated = await db.invoice.update({
        where: { id },
        data: { notes },
      })
      return ok(updated)
    }

    return Errors.validation('Invalid patch action')
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const PATCH = withApi(_PATCH)
