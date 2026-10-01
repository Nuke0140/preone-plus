import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, notFound, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { getRequestMeta } from '@/lib/audit'
import { OperationsService } from '@/lib/operations/operations-service'

/**
 * GET /api/v1/operations/scan?code=
 * Resolves student identity from scan code (admissionNo, seatNumber, or ID)
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'attendance:mark')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const code = req.nextUrl.searchParams.get('code')?.trim()
  if (!code) return bad('Scan code is required', 'MISSING_CODE')

  try {
    const data = await OperationsService.lookupScanEntity(session.tenantId, code)
    return ok(data)
  } catch (err: any) {
    return notFound(err.message)
  }
}

/**
 * POST /api/v1/operations/scan
 * Processes ARRIVAL or PICKUP scan action
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'attendance:mark')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { code, eventType, studentId, guardianId, pin, notes } = body
    const meta = getRequestMeta(req)

    const ctx = {
      tenantId: session.tenantId,
      branchId: session.branchId,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    }

    if (eventType === 'ARRIVAL') {
      const res = await OperationsService.recordArrival(ctx, {
        code,
        studentId,
        notes,
      })
      return ok(res)
    } else if (eventType === 'PICKUP') {
      const res = await OperationsService.recordPickup(ctx, {
        studentId: studentId || code,
        guardianId,
        pin,
        notes,
      })
      return ok(res)
    }

    return bad('Invalid eventType. Must be ARRIVAL or PICKUP', 'INVALID_EVENT')
  } catch (err: any) {
    return bad(err.message, 'OPERATION_FAILED')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
