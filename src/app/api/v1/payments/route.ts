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
    const method = sp.get('method') || undefined
    const page = Math.max(1, parseInt(sp.get('page') || '1'))
    const pageSize = Math.min(100, parseInt(sp.get('pageSize') || '50'))

    const where: any = {
      tenantId: session.tenantId,
      ...(studentId ? { studentId } : {}),
      ...(method ? { method: method as any } : {}),
    }

    const [total, payments] = await Promise.all([
      db.payment.count({ where }),
      db.payment.findMany({
        where,
        include: {
          student: { select: { firstName: true, lastName: true, admissionNo: true } },
          invoice: { select: { invoiceNumber: true, title: true } },
          receipt: { select: { id: true, receiptNumber: true, issuedAt: true } },
        },
        orderBy: { paymentDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return ok(
      payments.map((p) => ({
        id: p.id,
        paymentNumber: p.paymentNumber,
        amountCents: p.amountCents,
        method: p.method,
        status: p.status,
        transactionRef: p.transactionRef,
        notes: p.notes,
        paymentDate: p.paymentDate,
        studentName: `${p.student.firstName} ${p.student.lastName || ''}`.trim(),
        admissionNo: p.student.admissionNo,
        invoiceNumber: p.invoice?.invoiceNumber ?? null,
        invoiceTitle: p.invoice?.title ?? null,
        receiptId: p.receipt?.id ?? null,
        receiptNumber: p.receipt?.receiptNumber ?? null,
      })),
      { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    )
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
