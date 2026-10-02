import { NextRequest } from 'next/server'
import { withApi } from '@/lib/with-api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { ok, Errors } from '@/lib/api'
import { DailyDiaryService } from '@/lib/daily-diary/daily-diary-service'

async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'attendance:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const context = await DailyDiaryService.getContext(session)
    return ok(context)
  } catch (err: any) {
    return Errors.internal(err.message || 'Failed to fetch Daily Diary context')
  }
}

export const GET = withApi(_GET)
