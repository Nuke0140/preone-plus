import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { SettingsService } from '@/lib/settings/settings-service'

/**
 * GET /api/v1/settings/permissions
 * Returns role-permissions dictionary matrix directly from backend.
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'settings:read')
  if (isResponse(session)) return session

  try {
    const matrix = SettingsService.getRolePermissionsMatrix()
    return ok({ matrix })
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
