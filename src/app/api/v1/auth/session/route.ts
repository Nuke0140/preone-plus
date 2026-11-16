import { NextRequest } from 'next/server'
import { withApi } from '@/lib/with-api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { ok } from '@/lib/api'

async function _GET(req: NextRequest) {
  const session = await requireApi(req)
  if (isResponse(session)) return session
  return ok({
    role: session.role,
    roles: session.roles?.length ? session.roles : [session.role],
  })
}

export const GET = withApi(_GET)
