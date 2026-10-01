import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'

/** GET /api/v1/fee-plans — fee structures per program */
async function _GET(req: NextRequest) {
  let session = await requireApi(req, 'finance:read')
  if (isResponse(session)) {
    session = await requireApi(req, 'admissions:read')
    if (isResponse(session)) return session
  }
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const plans = await db.feePlan.findMany({
      where: { tenantId: session.tenantId, isActive: true },
      include: { items: true },
      orderBy: { programType: 'asc' },
    })
    return ok(plans)
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
