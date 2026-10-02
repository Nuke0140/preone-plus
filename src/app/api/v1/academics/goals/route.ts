import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AcademicService } from '@/lib/academics/academic-service'

/**
 * POST /api/v1/academics/goals — Add a learning goal under a learning area
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'academics:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { curriculumLearningAreaId, name, description, ageMinMonths, ageMaxMonths, displayOrder } = body

    if (!curriculumLearningAreaId || !name || !name.trim()) {
      return Errors.validation('curriculumLearningAreaId and name are required')
    }

    const goal = await AcademicService.createLearningGoal(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      {
        curriculumLearningAreaId,
        name,
        description,
        ageMinMonths,
        ageMaxMonths,
        displayOrder,
      }
    )

    return ok(goal, undefined, 201)
  } catch (e: any) {
    return Errors.business('LEARNING_GOAL_CREATE_FAILED', e.message || 'Failed to create learning goal', 422)
  }
}

export const POST = withApi(_POST)
