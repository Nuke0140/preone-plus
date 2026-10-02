import { ok } from '@/lib/api'
import { withApi } from '@/lib/with-api'
import { SESSION_COOKIE } from '@/lib/auth'

export const POST = withApi(async () => {
  const res = ok({ loggedOut: true })
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, maxAge: 0, path: '/' })
  return res
}, { module: 'auth' })
