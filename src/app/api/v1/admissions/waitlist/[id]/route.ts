import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { WaitingListService } from '@/lib/admissions/waiting-list-service'

/**
 * GET /api/v1/admissions/waitlist/[id]
 * Fetch single waiting list entry with complete inspector details.
 */
async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'admissions:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params

  try {
    const result = await WaitingListService.getWaitingListEntry(
      {
        tenantId: session.tenantId,
        branchId: session.branchId || '',
        academicYearId: '',
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id
    )

    return ok(result)
  } catch (e: any) {
    return Errors.notFound(e.message || 'Waiting list entry not found')
  }
}

export const GET = withApi(_GET)
