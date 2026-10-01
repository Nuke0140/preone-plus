import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { WaitingListService } from '@/lib/admissions/waiting-list-service'
import { AdmissionService } from '@/lib/admissions/admission-service'

/**
 * GET /api/v1/admissions/waitlist
 * List waiting list entries with filters, dynamic queue ranking, and program capacity summaries.
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'admissions:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const sp = req.nextUrl.searchParams
    const branchId = sp.get('branchId') || session.branchId || ''
    const academicSessionId = sp.get('academicSessionId') || sp.get('academicYearId') || ''
    const programType = sp.get('programType') || sp.get('program') || undefined
    const status = sp.get('status') || undefined
    const priority = sp.get('priority') || undefined
    const search = sp.get('q')?.trim() || undefined
    const limit = parseInt(sp.get('limit') || '50', 10)
    const offset = parseInt(sp.get('offset') || '0', 10)

    const result = await WaitingListService.listWaitingList(
      {
        tenantId: session.tenantId,
        branchId,
        academicYearId: academicSessionId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      {
        branchId: branchId || undefined,
        academicSessionId: academicSessionId || undefined,
        programType,
        status,
        priority,
        search,
        limit,
        offset,
      }
    )

    return ok(result.entries, {
      total: result.total,
      capacitySummaries: result.capacitySummaries,
    })
  } catch (e: any) {
    return Errors.system(e)
  }
}

/**
 * POST /api/v1/admissions/waitlist
 * Create a new waiting list entry from an application with duplicate idempotency.
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'admissions:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { applicationId, reason, reasonNotes, priority, notes } = body

    if (!applicationId) {
      return Errors.business('MISSING_APPLICATION_ID', 'Application ID is required', 400)
    }

    if (!reason) {
      return Errors.business('MISSING_REASON', 'A valid waiting list reason is mandatory', 400)
    }

    if (reason === 'OTHER' && (!reasonNotes || !reasonNotes.trim())) {
      return Errors.business('MISSING_REASON_NOTES', 'Reason notes are required when reason is OTHER', 400)
    }

    const result = await WaitingListService.addToWaitingList(
      {
        tenantId: session.tenantId,
        branchId: body.branchId || session.branchId || '',
        academicYearId: body.academicSessionId || body.academicYearId || '',
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      {
        applicationId,
        reason,
        reasonNotes,
        priority,
        notes,
      }
    )

    return ok(result.entry, {
      queuePosition: result.position,
      isExisting: result.isExisting,
    }, result.isExisting ? 200 : 201)
  } catch (e: any) {
    return Errors.business('WAITLIST_CREATE_FAILED', e.message || 'Failed to place on waiting list', 422)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
