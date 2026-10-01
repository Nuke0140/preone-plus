import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { LeadDuplicateService } from '@/lib/admissions/lead-service'

/**
 * POST /api/v1/leads/duplicate-check — Pre-flight duplicate check across Phone, Email, Child
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'admissions:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { phone, email, childName, childDob, branchId } = body

    if (!phone && !email && (!childName || !childDob)) {
      return Errors.badRequest('At least phone, email, or child name + DOB must be provided')
    }

    const result = await LeadDuplicateService.findDuplicate(
      session.tenantId,
      phone || '',
      email,
      childName,
      childDob,
      branchId || session.branchId
    )

    return ok(result)
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const POST = withApi(_POST)
