import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { FeeService } from '@/lib/fees/fee-service'
import { db } from '@/lib/db'

async function _POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { tenantId, paymentNumber, transactionRef, gatewayStatus, signature } = body

    if (!tenantId || (!paymentNumber && !transactionRef)) {
      return Errors.validation('tenantId and paymentNumber or transactionRef are required')
    }

    const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) return Errors.notFound('Tenant')

    // Verify idempotently
    const result = await FeeService.verifyPayment(
      {
        tenantId,
        actorId: 'system-webhook',
        actorName: 'Payment Gateway Webhook',
        actorRole: 'SYSTEM',
      },
      {
        paymentNumber,
        transactionRef,
        gatewayStatus: gatewayStatus || 'SUCCESS',
        gatewaySignature: signature,
      }
    )

    return ok(result)
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const POST = withApi(_POST)
