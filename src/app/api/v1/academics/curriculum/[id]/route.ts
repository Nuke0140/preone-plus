import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AcademicService } from '@/lib/academics/academic-service'

/**
 * GET /api/v1/academics/curriculum/[id] — Retrieve single curriculum with areas & goals
 */
async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'academics:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params

  try {
    const curriculum = await AcademicService.getCurriculum(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id
    )

    return ok(curriculum)
  } catch (e: any) {
    return Errors.notFound('Curriculum')
  }
}

/**
 * PATCH /api/v1/academics/curriculum/[id] — Update curriculum metadata or status
 */
async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'academics:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params

  try {
    const body = await req.json()
    const updated = await AcademicService.updateCurriculum(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      body
    )

    return ok(updated)
  } catch (e: any) {
    return Errors.business('CURRICULUM_UPDATE_FAILED', e.message || 'Failed to update curriculum', 422)
  }
}

export const GET = withApi(_GET)
export const PATCH = withApi(_PATCH)
