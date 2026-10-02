import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { LeadService } from '@/lib/admissions/lead-service'

/**
 * POST /api/v1/leads/:id/start-application — Zero data re-entry application handoff
 */
async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'admissions:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params

  try {
    let body: any = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const { branchId, academicYearId, ...extraData } = body

    const result = await LeadService.startApplication(
      {
        tenantId: session.tenantId,
        branchId: branchId || session.branchId || '',
        academicYearId: academicYearId || '',
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      extraData
    )

    return ok(result, undefined, 201)
  } catch (e: any) {
    return Errors.business('START_APPLICATION_FAILED', e.message || 'Failed to start application from lead', 422)
  }
}

export const POST = withApi(_POST)
