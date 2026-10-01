import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { UsernameService, UsernameType } from '@/lib/users/username-service'

/**
 * GET /api/v1/users/username?name=Ananya+Sharma&type=STAFF|PARENT|GUARDIAN|STUDENT
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'users:read')
  if (isResponse(session)) return session

  const url = new URL(req.url)
  const name = url.searchParams.get('name')?.trim() || ''
  const type = (url.searchParams.get('type')?.toUpperCase() || 'STAFF') as UsernameType
  const preferred = url.searchParams.get('preferred')?.trim() || undefined

  if (!name && !preferred) {
    return bad('name or preferred is required', 'MISSING_FIELDS')
  }

  try {
    const suggestedUsername = await UsernameService.generateUniqueUsername({
      type,
      name: name || preferred || 'user',
      preferred,
      tenantId: session.tenantId || undefined,
    })

    const isAvailable = preferred
      ? await UsernameService.isUsernameAvailable(preferred, type)
      : true

    return ok({
      username: suggestedUsername,
      isAvailable,
    })
  } catch (err: any) {
    return bad(err.message)
  }
}

export const GET = withApi(_GET)
