import { NextRequest } from 'next/server'
import { withApi } from '@/lib/with-api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { ok, Errors } from '@/lib/api'
import { DailyDiaryService, getScopeFromSession } from '@/lib/daily-diary/daily-diary-service'
import { isoDate } from '@/lib/format'

async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'attendance:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const scope = getScopeFromSession(session)
  if (!scope.isAdmin) {
    return Errors.forbidden('Admin or Coordinator access required')
  }

  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get('date') || isoDate()
  const branchId = searchParams.get('branchId') || undefined

  try {
    const data = await DailyDiaryService.getAdminSchoolOverview(session, dateStr, branchId)
    return ok(data)
  } catch (err: any) {
    return Errors.internal(err.message || 'Failed to fetch admin school overview')
  }
}

export const GET = withApi(_GET)
