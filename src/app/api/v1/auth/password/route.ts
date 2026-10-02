import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { withApi } from '@/lib/with-api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { SettingsService } from '@/lib/settings/settings-service'

/**
 * POST /api/v1/auth/password
 * Secure password update for authenticated user.
 */
export const POST = withApi(async (req: NextRequest) => {
  const session = await requireApi(req)
  if (isResponse(session)) return session

  try {
    const body = await req.json()
    const { currentPassword, newPassword } = body as { currentPassword?: string; newPassword?: string }

    if (!currentPassword || !newPassword) {
      return Errors.validation('Both currentPassword and newPassword are required')
    }

    const actor = {
      id: session.uid,
      name: session.name,
      role: session.role,
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    }

    const result = await SettingsService.changePassword(session.uid, currentPassword, newPassword, actor)
    return ok(result)
  } catch (e: any) {
    return Errors.business('PASSWORD_CHANGE_FAILED', e.message || 'Failed to change password', 400)
  }
}, { module: 'auth' })
