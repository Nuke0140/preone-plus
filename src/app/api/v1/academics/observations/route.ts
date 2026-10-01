import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AcademicService } from '@/lib/academics/academic-service'
import { db } from '@/lib/db'

/**
 * GET /api/v1/academics/observations — Query observations with academic filters
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'academics:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { searchParams } = new URL(req.url)
  const studentId = searchParams.get('studentId') || undefined
  const classroomId = searchParams.get('classroomId') || undefined
  const concern = searchParams.get('concern') || undefined
  const status = searchParams.get('status') || undefined
  const academicSessionId = searchParams.get('academicSessionId') || undefined

  try {
    const observations = await db.observation.findMany({
      where: {
        tenantId: session.tenantId,
        ...(academicSessionId ? { academicSessionId } : {}),
        ...(studentId ? { studentId } : {}),
        ...(classroomId ? { classroomId } : {}),
        ...(concern ? { concern: concern as any } : {}),
        ...(status ? { status: status as any } : {}),
        ...(session.role === 'TEACHER' ? { teacherId: session.uid } : {}),
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNo: true, photoUrl: true } },
        classroom: { select: { id: true, name: true, code: true } },
        learningGoal: { select: { id: true, name: true, learningArea: { select: { name: true } } } },
      },
      orderBy: { observedAt: 'desc' },
      take: 100,
    })

    return ok(observations)
  } catch (e: any) {
    return Errors.system(e)
  }
}

/**
 * POST /api/v1/academics/observations — Record observation using AcademicService
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'academics:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const {
      studentId,
      narrative,
      category,
      concern,
      learningGoalId,
      activityId,
      milestoneTags,
      progressStage,
      publishToTimeline,
      academicSessionId,
    } = body

    if (!studentId || !narrative) {
      return Errors.validation('studentId and narrative are required')
    }

    const res = await AcademicService.recordObservation(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        academicSessionId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      {
        studentId,
        narrative,
        category,
        concern,
        learningGoalId,
        activityId,
        milestoneTags,
        progressStage,
        publishToTimeline,
      }
    )

    return ok(res, undefined, 201)
  } catch (e: any) {
    return Errors.business('OBSERVATION_FAILED', e.message || 'Failed to record observation', 422)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
