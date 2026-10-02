import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AdmissionsAnalyticsService } from '@/lib/admissions/analytics-service'

/**
 * GET /api/v1/admissions/analytics
 * Server-side admissions analytics aggregation (Modern Schools Edition).
 *
 * Query params:
 *  - from / to         : ISO date range (defaults: last 12 months)
 *  - branchId          : optional branch scope
 *  - programType       : optional program scope
 *
 * Returns: 12-stage funnel, monthly trends, source ROI, counsellor leaderboard,
 * aging & stuck applications, offer insights, capacity forecast, speed metrics,
 * lost reasons and the canonical source catalogue.
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'admissions:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const sp = req.nextUrl.searchParams

    const parseDate = (key: string): Date | undefined => {
      const raw = sp.get(key)
      if (!raw) return undefined
      const d = new Date(raw)
      return Number.isNaN(d.getTime()) ? undefined : d
    }

    const from = parseDate('from')
    const to = parseDate('to')
    if (from && to && from > to) return Errors.badRequest('from must be before to')

    const branchId = sp.get('branchId') || undefined
    const programType = sp.get('programType') || sp.get('program') || undefined

    const analytics = await AdmissionsAnalyticsService.getAnalytics(session.tenantId, {
      from,
      to,
      branchId,
      programType,
    })

    return ok(analytics)
  } catch (error) {
    console.error('[admissions/analytics] GET failed:', error)
    return Errors.system(error ?? 'Failed to compute admissions analytics')
  }
}

export const GET = withApi(_GET, { module: 'admissions' })
