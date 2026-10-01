import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AuditService } from '@/lib/audit/audit-service'

/**
 * GET /api/v1/hr/performance — Performance review cycles and staff reviews
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'hr:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const tenantId = session.tenantId

    // 1. Fetch review cycles
    const cycles = await db.reviewCycle.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { reviews: true } },
      },
    })

    // 2. Fetch staff reviews
    const reviews = await db.staffReview.findMany({
      where: { tenantId },
      include: {
        staffProfile: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
            branch: { select: { id: true, name: true } },
          },
        },
        reviewCycle: { select: { id: true, title: true, cycleType: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const staffList = await db.staffProfile.findMany({
      where: { tenantId, status: 'ACTIVE', deletedAt: null },
      include: {
        user: { select: { id: true, fullName: true } },
      },
      select: {
        id: true,
        employeeCode: true,
        designation: true,
        department: true,
        user: { select: { id: true, fullName: true } },
      },
      orderBy: { employeeCode: 'asc' },
    })

    return ok({
      cycles,
      reviews: reviews.map((r) => ({
        id: r.id,
        staffProfileId: r.staffProfileId,
        employeeName: r.staffProfile.user.fullName,
        employeeCode: r.staffProfile.employeeCode,
        designation: r.staffProfile.designation,
        branchName: r.staffProfile.branch?.name || null,
        cycleId: r.reviewCycleId,
        cycleTitle: r.reviewCycle.title,
        cycleType: r.reviewCycle.cycleType,
        selfRating: r.selfRating,
        selfComments: r.selfComments,
        reviewerRating: r.reviewerRating,
        reviewerComments: r.reviewerComments,
        finalRating: r.finalRating,
        recommendation: r.recommendation,
        status: r.status,
        completedAt: r.completedAt,
      })),
      staffList,
    })
  } catch (e) {
    return Errors.system(e)
  }
}

/**
 * POST /api/v1/hr/performance — Submit or update a staff review / create cycle
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'hr:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { action = 'SUBMIT_REVIEW', ...data } = body

    if (action === 'CREATE_CYCLE') {
      const { title, cycleType = 'ANNUAL', startDate, endDate } = data
      if (!title || !startDate || !endDate) {
        return Errors.validation('Title, startDate, and endDate are required')
      }
      const cycle = await db.reviewCycle.create({
        data: {
          tenantId: session.tenantId,
          title,
          cycleType,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          status: 'OPEN',
        },
      })
      return ok(cycle)
    }

    if (action === 'SUBMIT_REVIEW') {
      const {
        staffProfileId,
        reviewCycleId,
        reviewerRating,
        reviewerComments,
        finalRating,
        recommendation = 'NONE',
        status = 'COMPLETED',
      } = data

      if (!staffProfileId) {
        return Errors.validation('staffProfileId is required')
      }

      // Ensure review cycle exists or create default current year cycle
      let targetCycleId = reviewCycleId
      if (!targetCycleId) {
        let activeCycle = await db.reviewCycle.findFirst({
          where: { tenantId: session.tenantId, status: 'OPEN' },
        })
        if (!activeCycle) {
          const year = new Date().getFullYear()
          activeCycle = await db.reviewCycle.create({
            data: {
              tenantId: session.tenantId,
              title: `Annual Performance Appraisal ${year}-${year + 1}`,
              cycleType: 'ANNUAL',
              startDate: new Date(`${year}-04-01`),
              endDate: new Date(`${year + 1}-03-31`),
              status: 'OPEN',
            },
          })
        }
        targetCycleId = activeCycle.id
      }

      const review = await db.staffReview.upsert({
        where: {
          reviewCycleId_staffProfileId: {
            reviewCycleId: targetCycleId,
            staffProfileId,
          },
        },
        create: {
          tenantId: session.tenantId,
          reviewCycleId: targetCycleId,
          staffProfileId,
          reviewerId: session.uid,
          reviewerRating: reviewerRating ? parseFloat(String(reviewerRating)) : null,
          reviewerComments: reviewerComments || null,
          finalRating: finalRating ? parseFloat(String(finalRating)) : (reviewerRating ? parseFloat(String(reviewerRating)) : null),
          recommendation,
          status,
          completedAt: status === 'COMPLETED' ? new Date() : null,
        },
        update: {
          reviewerId: session.uid,
          reviewerRating: reviewerRating ? parseFloat(String(reviewerRating)) : undefined,
          reviewerComments: reviewerComments || undefined,
          finalRating: finalRating ? parseFloat(String(finalRating)) : undefined,
          recommendation: recommendation || undefined,
          status,
          completedAt: status === 'COMPLETED' ? new Date() : undefined,
        },
      })

      await AuditService.record({
        tenantId: session.tenantId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
        action: 'STAFF_REVIEW_RECORDED',
        entity: 'StaffReview',
        entityId: review.id,
        module: 'HR',
        summary: `Recorded performance appraisal for staff profile ${staffProfileId}: Rating ${reviewerRating ?? 'N/A'}`,
        severity: 'INFO',
      })

      return ok(review)
    }

    return Errors.validation(`Unknown action: ${action}`)
  } catch (e: any) {
    return Errors.validation(e.message || 'Failed to process performance review')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
