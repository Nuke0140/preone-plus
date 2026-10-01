import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AcademicService } from '@/lib/academics/academic-service'

/**
 * POST /api/v1/academics/learning-areas — Add a learning area to a curriculum
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'academics:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { curriculumId, name, description, displayOrder } = body

    if (!curriculumId || !name || !name.trim()) {
      return Errors.validation('curriculumId and name are required')
    }

    const area = await AcademicService.createLearningArea(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      { curriculumId, name, description, displayOrder }
    )

    return ok(area, undefined, 201)
  } catch (e: any) {
    return Errors.business('LEARNING_AREA_CREATE_FAILED', e.message || 'Failed to create learning area', 422)
  }
}

export const POST = withApi(_POST)
