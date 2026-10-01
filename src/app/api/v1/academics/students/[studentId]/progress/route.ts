import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AcademicService } from '@/lib/academics/academic-service'
import type { ProgressStage } from '@prisma/client'

/**
 * GET /api/v1/academics/students/[studentId]/progress — Student progress matrix across goals
 */
async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const session = await requireApi(req, 'academics:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { studentId } = await params
  const { searchParams } = new URL(req.url)
  const academicSessionId = searchParams.get('academicSessionId') || undefined

  try {
    const progress = await AcademicService.getStudentProgress(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        academicSessionId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      studentId,
      academicSessionId
    )

    return ok(progress)
  } catch (e: any) {
    return Errors.notFound('Student')
  }
}

/**
 * POST /api/v1/academics/students/[studentId]/progress — Update milestone stage on a goal
 */
async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const session = await requireApi(req, 'academics:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { studentId } = await params

  try {
    const body = await req.json()
    const { learningGoalId, stage, notes, evidence, academicSessionId, createObservation } = body as {
      learningGoalId: string
      stage: ProgressStage
      notes?: string
      evidence?: string
      academicSessionId?: string
      createObservation?: boolean
    }

    if (!learningGoalId || !stage) {
      return Errors.validation('learningGoalId and stage are required')
    }

    const updated = await AcademicService.updateStudentProgress(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        academicSessionId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      studentId,
      {
        learningGoalId,
        stage,
        notes,
        evidence,
        academicSessionId,
        createObservation,
      }
    )

    return ok(updated)
  } catch (e: any) {
    return Errors.business('PROGRESS_UPDATE_FAILED', e.message || 'Failed to update student progress', 422)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
