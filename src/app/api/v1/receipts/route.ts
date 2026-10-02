import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'

async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'finance:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const sp = req.nextUrl.searchParams
    const studentId = sp.get('studentId') || undefined
    const page = Math.max(1, parseInt(sp.get('page') || '1'))
    const pageSize = Math.min(100, parseInt(sp.get('pageSize') || '50'))

    const where: any = {
      tenantId: session.tenantId,
      ...(studentId ? { payment: { studentId } } : {}),
    }

    const [total, receipts] = await Promise.all([
      db.receipt.count({ where }),
      db.receipt.findMany({
        where,
        include: {
          payment: {
            include: {
              student: { select: { firstName: true, lastName: true, admissionNo: true } },
              invoice: { select: { invoiceNumber: true, title: true } },
            },
          },
        },
        orderBy: { issuedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return ok(
      receipts.map((r) => ({
        id: r.id,
        receiptNumber: r.receiptNumber,
        amountCents: r.amountCents,
        issuedAt: r.issuedAt,
        paymentNumber: r.payment.paymentNumber,
        method: r.payment.method,
        transactionRef: r.payment.transactionRef,
        studentName: `${r.payment.student.firstName} ${r.payment.student.lastName || ''}`.trim(),
        admissionNo: r.payment.student.admissionNo,
        invoiceNumber: r.payment.invoice?.invoiceNumber ?? null,
      })),
      { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    )
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
