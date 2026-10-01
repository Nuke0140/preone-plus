import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, notFound, bad, forbidden, serverError } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { recordAudit, getRequestMeta } from '@/lib/audit'

async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireApi(req, 'finance:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return bad('Tenant required', 'TENANT_REQUIRED')

  try {
    const receipt = await db.receipt.findFirst({
      where: {
        id,
        tenantId: session.tenantId,
      },
      include: {
        tenant: {
          select: { name: true, code: true, address: true, city: true, phone: true, email: true, gstNumber: true },
        },
        payment: {
          include: {
            invoice: {
              include: { items: true },
            },
            student: {
              include: { currentClassroom: true },
            },
          },
        },
      },
    })

    if (!receipt) return notFound('Receipt not found')

    // If PARENT, ensure guardian links to child
    if (session.role === 'PARENT') {
      const isLinked = await db.studentGuardian.findFirst({
        where: {
          studentId: receipt.payment.studentId,
          guardian: { userId: session.uid },
        },
      })
      if (!isLinked) return forbidden('You are not authorized to view receipts for this child')
    }

    const meta = getRequestMeta(req)
    await recordAudit({
      tenantId: session.tenantId,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
      action: 'VIEW_RECEIPT',
      entity: 'Receipt',
      entityId: receipt.id,
      module: 'Fees',
      summary: `Viewed/Exported receipt ${receipt.receiptNumber} (${(receipt.amountCents / 100).toFixed(2)})`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    })

    return ok({
      receiptNumber: receipt.receiptNumber,
      issuedAt: receipt.issuedAt,
      amountRupees: (receipt.amountCents / 100).toFixed(2),
      school: receipt.tenant,
      student: {
        name: `${receipt.payment.student.firstName} ${receipt.payment.student.lastName || ''}`.trim(),
        admissionNo: receipt.payment.student.admissionNo,
        seatNumber: receipt.payment.student.seatNumber,
        classroom: receipt.payment.student.currentClassroom?.name || 'N/A',
      },
      payment: {
        paymentNumber: receipt.payment.paymentNumber,
        method: receipt.payment.method,
        transactionRef: receipt.payment.transactionRef,
        date: receipt.payment.paymentDate,
      },
      invoice: receipt.payment.invoice
        ? {
            invoiceNumber: receipt.payment.invoice.invoiceNumber,
            title: receipt.payment.invoice.title,
            items: receipt.payment.invoice.items.map((i) => ({
              description: i.description,
              amountRupees: (i.amountCents / 100).toFixed(2),
            })),
          }
        : null,
    })
  } catch (err: any) {
    return serverError(err.message)
  }
}

export const GET = withApi(_GET)
