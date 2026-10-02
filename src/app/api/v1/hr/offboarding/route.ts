import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { OffboardingService } from '@/lib/hr/offboarding-service'

async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'hr:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const resignations = await db.resignationRequest.findMany({
      where: { tenantId: session.tenantId },
      include: {
        staffProfile: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
            branch: { select: { id: true, name: true } },
            offboardingTasks: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return ok(resignations)
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
    const { action = 'SUBMIT_RESIGNATION' } = body

    if (action === 'COMPLETE_TASK') {
      const task = await OffboardingService.completeClearanceTask(
        session.tenantId,
        body.taskId,
        {
          id: session.uid,
          name: session.name,
          role: session.role,
        },
        body.remarks
      )
      return ok(task)
    }

    if (action === 'REOPEN_TASK') {
      const task = await OffboardingService.reopenClearanceTask(
        session.tenantId,
        body.taskId,
        {
          id: session.uid,
          name: session.name,
          role: session.role,
        },
        body.remarks
      )
      return ok(task)
    }

    if (action === 'ACTION_RESIGNATION') {
      if (!body.resignationId || !body.status) {
        return Errors.validation('resignationId and status are required')
      }
      const updated = await OffboardingService.actionResignation(
        session.tenantId,
        body.resignationId,
        {
          status: body.status,
          agreedLwd: body.agreedLwd,
        },
        {
          id: session.uid,
          name: session.name,
          role: session.role,
        }
      )
      return ok(updated)
    }

    // Default: SUBMIT_RESIGNATION
    const resignation = await OffboardingService.submitResignation(
      session.tenantId,
      body.staffProfileId,
      body,
      {
        id: session.uid,
        name: session.name,
        role: session.role,
      }
    )

    return ok(resignation)
  } catch (e: any) {
    return Errors.validation(e.message || 'Failed to process offboarding action')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
