import { db } from './db'

/**
 * Business number generator — INV-{FY}-{SEQ} pattern per docs.
 * e.g. INV-2026-0001, PAY-2026-0003, RCT-2026-0002
 */
export async function nextNumber(
  model:
    | 'invoice'
    | 'payment'
    | 'receipt'
    | 'lead'
    | 'application'
    | 'student'
    | 'material_request'
    | 'purchase_request'
    | 'purchase_order'
    | 'goods_receipt'
    | 'stock_issue'
    | 'stock_return'
    | 'stock_adjustment'
    | 'employee',
  tenantId: string
): Promise<string> {
  const fy = new Date().getFullYear()
  const prefixMap = {
    invoice: 'INV',
    payment: 'PAY',
    receipt: 'RCT',
    lead: 'LEAD',
    application: 'ADM',
    student: 'STU',
    material_request: 'MR',
    purchase_request: 'PR',
    purchase_order: 'PO',
    goods_receipt: 'GRN',
    stock_issue: 'ISS',
    stock_return: 'RET',
    stock_adjustment: 'ADJ',
    employee: 'EMP',
  } as const
  const prefix = `${prefixMap[model]}-${fy}`

  let seq = 0
  switch (model) {
    case 'employee': {
      const c = await db.staffProfile.count({ where: { tenantId, employeeCode: { startsWith: prefix } } })
      seq = c + 1
      return `${prefix}-${String(seq).padStart(3, '0')}`
    }
    case 'invoice': {
      const c = await db.invoice.count({ where: { tenantId, invoiceNumber: { startsWith: prefix } } })
      seq = c + 1
      break
    }
    case 'payment': {
      const c = await db.payment.count({ where: { tenantId, paymentNumber: { startsWith: prefix } } })
      seq = c + 1
      break
    }
    case 'receipt': {
      // tenant-scoped sequence — receiptNumber is unique per tenant (M01 §53 fix)
      const c = await db.receipt.count({ where: { tenantId, receiptNumber: { startsWith: prefix } } })
      seq = c + 1
      break
    }
    case 'lead': {
      const c = await db.lead.count({ where: { tenantId, leadNumber: { startsWith: prefix } } })
      seq = c + 1
      break
    }
    case 'application': {
      const c = await db.admissionApplication.count({
        where: { tenantId, applicationNumber: { startsWith: prefix } },
      })
      seq = c + 1
      break
    }
    case 'student': {
      const c = await db.student.count({
        where: { tenantId, admissionNo: { startsWith: prefix } },
      })
      seq = c + 1
      break
    }
    case 'material_request': {
      const c = await db.materialRequest.count({ where: { tenantId, requestNumber: { startsWith: prefix } } })
      seq = c + 1
      break
    }
    case 'purchase_request': {
      const c = await db.purchaseRequest.count({ where: { tenantId, requestNumber: { startsWith: prefix } } })
      seq = c + 1
      break
    }
    case 'purchase_order': {
      const c = await db.purchaseOrder.count({ where: { tenantId, poNumber: { startsWith: prefix } } })
      seq = c + 1
      break
    }
    case 'goods_receipt': {
      const c = await db.goodsReceipt.count({ where: { tenantId, grnNumber: { startsWith: prefix } } })
      seq = c + 1
      break
    }
    case 'stock_issue': {
      const c = await db.stockIssue.count({ where: { tenantId, issueNumber: { startsWith: prefix } } })
      seq = c + 1
      break
    }
    case 'stock_return': {
      const c = await db.stockReturn.count({ where: { tenantId, returnNumber: { startsWith: prefix } } })
      seq = c + 1
      break
    }
    case 'stock_adjustment': {
      const c = await db.stockAdjustment.count({ where: { tenantId, adjustmentNumber: { startsWith: prefix } } })
      seq = c + 1
      break
    }
  }
  return `${prefix}-${String(seq).padStart(4, '0')}`
}

export { audit, recordAudit } from './audit'
export type { AuditEntry } from './audit'

