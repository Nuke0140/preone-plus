import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { FeeService } from '@/lib/fees/fee-service'
import { db } from '@/lib/db'

async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'finance:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params

  try {
    const template = await FeeService.getTemplateById(session.tenantId, id)
    if (!template) return Errors.notFound('Template')

    const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } })

    // Build realistic preview data
    const previewData = {
      isSampleData: true,
      template: {
        id: template.id,
        name: template.name,
        type: template.type,
        content: template.content,
      },
      school: {
        name: tenant?.name || 'PreOne International Preschool',
        code: tenant?.code || 'PRE-ONE',
        address: tenant?.address || '123 Education Boulevard',
        city: tenant?.city || 'Pune',
        phone: tenant?.phone || '+91 98220 12345',
        email: tenant?.email || 'accounts@preone.edu',
        gstNumber: tenant?.gstNumber || '27AABCU9603R1ZM',
      },
      student: {
        name: 'Aarav Deshmukh',
        admissionNo: 'STU-2026-0089',
        classroom: 'Butterflies (Playgroup-A)',
        program: 'Playgroup',
        seatNumber: 'CLS-A-01',
      },
      guardian: {
        name: 'Vikram Deshmukh',
        relationship: 'FATHER',
        phone: '+91 98220 99999',
      },
      invoice: {
        invoiceNumber: 'INV-2026-0042',
        title: 'Term 1 Tuition & Activity Fee',
        date: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
        items: [
          { description: 'Term Tuition Fee', feeHead: 'TUITION', amountRupees: '15000.00' },
          { description: 'Learning Materials Kit', feeHead: 'MATERIALS', amountRupees: '3000.00' },
          { description: 'Music & Movement Activities', feeHead: 'ACTIVITY', amountRupees: '2000.00' },
        ],
        subtotalRupees: '20000.00',
        discountRupees: '1500.00',
        discountReason: 'Sibling concession (10%)',
        totalRupees: '18500.00',
        paidRupees: '8500.00',
        balanceRupees: '10000.00',
        status: 'PARTIALLY_PAID',
      },
      payment: {
        paymentNumber: 'PAY-2026-0038',
        method: 'UPI',
        transactionRef: 'UPI-REF-20260913-098',
        date: new Date().toISOString().slice(0, 10),
        amountRupees: '8500.00',
      },
      receipt: {
        receiptNumber: 'RCT-2026-0038',
        issuedAt: new Date().toISOString(),
        amountRupees: '8500.00',
      },
    }

    return ok(previewData)
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const POST = withApi(_POST)
