import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { audit } from '@/lib/sequence'
import { raiseFollowUp } from '@/lib/followups'
import { broadcast } from '@/lib/notify'
import { registerIntegrations } from '@/lib/integrations'

/**
 * POST /api/v1/invoices/{id}/remind — fee reminder (Spec §20/§23, Scenario 7).
 * Reminder sent ≠ problem solved: a FINANCE follow-up stays OPEN until the
 * invoice is fully paid (auto-resolved by PaymentReceived handler).
 */
async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'finance:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  registerIntegrations()

  const { id } = await params
  try {
    const invoice = await db.invoice.findFirst({
      where: { id, tenantId: session.tenantId, deletedAt: null },
      include: {
        student: {
          select: {
            firstName: true, lastName: true, admissionNo: true,
            guardians: { include: { guardian: { select: { fullName: true } } }, where: { receivesComm: true } },
          },
        },
      },
    })
    if (!invoice) return Errors.notFound('Invoice')
    if (invoice.status === 'PAID') return Errors.conflict('Invoice already fully paid — no reminder needed')
    if (['CANCELLED', 'WRITTEN_OFF'].includes(invoice.status)) {
      return Errors.conflict(`Cannot remind on a ${invoice.status.toLowerCase()} invoice`)
    }

    const payer = invoice.student.guardians[0]?.guardian.fullName

    await broadcast({
      tenantId: session.tenantId,
      type: 'FEE_REMINDER',
      title: `Fee reminder — ${invoice.invoiceNumber}`,
      body: `Outstanding ₹${(invoice.balanceCents / 100).toFixed(2)} for ${invoice.title}. Due ${invoice.dueDate.toISOString().slice(0, 10)}. Kindly arrange payment.`,
      audience: 'ALL_PARENTS',
      authorId: session.uid,
    })

    const fu = await raiseFollowUp({
      tenantId: session.tenantId,
      domain: 'FINANCE',
      severity: invoice.status === 'OVERDUE' ? 'URGENT' : 'WARNING',
      title: `Fee collection pending — ${invoice.invoiceNumber}`,
      detail: `Reminder sent${payer ? ` to ${payer}` : ''}. Outstanding ₹${(invoice.balanceCents / 100).toFixed(2)}.`,
      sourceType: 'Invoice',
      sourceId: invoice.id,
      dedupeKey: `invoice:${invoice.id}:overdue`,
      studentId: invoice.studentId,
      responsibleRole: 'ACCOUNTS',
      actorId: session.uid,
      actorName: session.name,
    })

    await audit({
      tenantId: session.tenantId,
      actorId: session.uid,
      actorName: session.name,
      action: 'REMIND',
      entity: 'Invoice',
      entityId: invoice.id,
      summary: `Fee reminder sent for ${invoice.invoiceNumber} (outstanding ₹${(invoice.balanceCents / 100).toFixed(2)})`,
    })

    return ok({
      reminded: true,
      followUpStatus: fu.followUp.status,
      followUpCreated: fu.created,
    })
  } catch (e) {
    return Errors.system(e)
  }
}

export const POST = withApi(_POST)
