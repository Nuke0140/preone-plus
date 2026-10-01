import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { FeeService } from '@/lib/fees/fee-service'

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'finance:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { paymentId, paymentNumber, invoiceId, transactionRef, gatewayStatus, failureReason } = body

    if (!paymentId && !paymentNumber && !transactionRef) {
      return Errors.validation('paymentId, paymentNumber, or transactionRef is required')
    }

    const result = await FeeService.verifyPayment(
      {
        tenantId: session.tenantId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      {
        paymentId,
        paymentNumber,
        invoiceId,
        transactionRef,
        gatewayStatus,
        failureReason,
      }
    )

    return ok(result, undefined, result.alreadyVerified ? 200 : 201)
  } catch (e: any) {
    if (e.message?.includes('IT §269ST') || e.message?.includes('exceeds')) {
      return Errors.business('BUSINESS_FEE_ERROR', e.message)
    }
    return Errors.system(e)
  }
}

export const POST = withApi(_POST)
