import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { LeaveService } from '@/lib/hr/leave-service'

async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'hr:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const sp = req.nextUrl.searchParams
    const status = sp.get('status') || undefined
    const staffProfileId = sp.get('staffProfileId') || undefined

    const requests = await db.leaveRequest.findMany({
      where: {
        tenantId: session.tenantId,
        ...(status ? { status: status as any } : {}),
        ...(staffProfileId ? { staffProfileId } : {}),
      },
      include: {
        staffProfile: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
            branch: { select: { id: true, name: true } },
          },
        },
        leaveType: true,
        coverages: {
          include: { classroom: true },
        },
      },
      orderBy: { appliedAt: 'desc' },
    })

    return ok(requests)
  } catch (e) {
    return Errors.system(e)
  }
}

async function _POST(req: NextRequest) {
  const session = await requireApi(req)
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    let staffProfileId = body.staffProfileId

    // If no staffProfileId provided, resolve from session user
    if (!staffProfileId) {
      const profile = await db.staffProfile.findUnique({
        where: { userId: session.uid },
      })
      if (!profile) return Errors.notFound('Staff profile for current user')
      staffProfileId = profile.id
    }

    const leave = await LeaveService.applyLeave({
      tenantId: session.tenantId,
      staffProfileId,
      leaveTypeId: body.leaveTypeId,
      startDate: body.startDate,
      endDate: body.endDate,
      reason: body.reason,
    })

    return ok(leave)
  } catch (e: any) {
    return Errors.validation(e.message || 'Failed to submit leave request')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
