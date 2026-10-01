import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { OperationsService } from '@/lib/operations/operations-service'

/**
 * GET /api/v1/operations/today
 * Real-time daily operations command center dashboard metrics
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'operations:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const sp = req.nextUrl.searchParams
    const branchId = sp.get('branchId') || session.branchId || undefined
    const academicSessionId = sp.get('academicSessionId') || undefined
    const date = sp.get('date') || undefined

    const data = await OperationsService.getTodayOperations(
      session.tenantId,
      branchId,
      academicSessionId,
      date
    )

    return ok(data)
  } catch (err: any) {
    return Errors.system(err)
  }
}

export const GET = withApi(_GET)
