import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { RecruitmentService } from '@/lib/hr/recruitment-service'

async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'hr:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const openings = await db.jobOpening.findMany({
      where: { tenantId: session.tenantId },
      include: {
        branch: { select: { id: true, name: true } },
        applications: {
          include: { interviews: true },
          orderBy: { appliedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return ok(openings)
  } catch (e) {
    return Errors.system(e)
  }
}

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'hr:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { action = 'CREATE_OPENING' } = body

    if (action === 'APPLY') {
      const app = await RecruitmentService.applyForJob(session.tenantId, body.jobOpeningId, body)
      return ok(app)
    }

    if (action === 'SCHEDULE_INTERVIEW') {
      const interview = await RecruitmentService.scheduleInterview(
        session.tenantId,
        body.jobApplicationId,
        body
      )
      return ok(interview)
    }

    if (action === 'UPDATE_STAGE') {
      if (!body.jobApplicationId || !body.status) {
        return Errors.validation('jobApplicationId and status are required')
      }
      const updated = await RecruitmentService.updateApplicationStatus(
        session.tenantId,
        body.jobApplicationId,
        body.status,
        {
          id: session.uid,
          name: session.name,
          role: session.role,
        },
        body.notes
      )
      return ok(updated)
    }

    if (action === 'RECORD_INTERVIEW') {
      if (!body.interviewId || !body.status) {
        return Errors.validation('interviewId and status are required')
      }
      const updated = await RecruitmentService.recordInterviewResult(
        session.tenantId,
        body.interviewId,
        {
          status: body.status,
          feedback: body.feedback,
          rating: body.rating,
        },
        {
          id: session.uid,
          name: session.name,
          role: session.role,
        }
      )
      return ok(updated)
    }

    if (action === 'CONVERT_TO_STAFF') {
      const staff = await RecruitmentService.convertCandidateToStaff(
        session.tenantId,
        body.jobApplicationId,
        body.staffData,
        {
          id: session.uid,
          name: session.name,
          role: session.role,
        }
      )
      return ok(staff)
    }

    // Default: CREATE_OPENING
    const opening = await RecruitmentService.createJobOpening(
      session.tenantId,
      body,
      {
        id: session.uid,
        name: session.name,
        role: session.role,
      }
    )

    return ok(opening)
  } catch (e: any) {
    return Errors.validation(e.message || 'Failed to process recruitment action')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
