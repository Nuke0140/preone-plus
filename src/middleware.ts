import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'

const PUBLIC_PATHS = ['/api/v1/auth/login', '/api/v1/auth/branding']

function resolveTraceId(req: NextRequest): string {
  const incoming = req.headers.get('x-trace-id') || req.headers.get('traceparent')
  if (incoming && incoming.startsWith('PRE-')) {
    return incoming
  }
  return 'PRE-' + Math.random().toString(16).substring(2, 10).toUpperCase().padEnd(8, '0')
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const traceId = resolveTraceId(req)

  // Propagate traceId through request headers for downstream API routes & components
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-trace-id', traceId)

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const res = NextResponse.next({ request: { headers: requestHeaders } })
    res.headers.set('X-Trace-Id', traceId)
    return res
  }

  const isProtectedPage = pathname.startsWith('/app') || pathname.startsWith('/onboard')
  const isProtectedApi =
    pathname.startsWith('/api/v1/') && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  if (!isProtectedPage && !isProtectedApi) {
    const res = NextResponse.next({ request: { headers: requestHeaders } })
    res.headers.set('X-Trace-Id', traceId)
    return res
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value
  const session = token ? await verifySession(token) : null

  if (!session) {
    if (isProtectedApi) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_001',
            message: 'Authentication required',
          },
          traceId,
        },
        {
          status: 401,
          headers: {
            'X-Trace-Id': traceId,
            'X-API-Version': '1.0.0',
          },
        }
      )
    }
    const url = req.nextUrl.clone()
    url.pathname = '/'
    url.searchParams.set('next', pathname)
    const redirectRes = NextResponse.redirect(url)
    redirectRes.headers.set('X-Trace-Id', traceId)
    return redirectRes
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } })
  res.headers.set('X-Trace-Id', traceId)
  return res
}

export const config = {
  matcher: ['/app/:path*', '/onboard/:path*', '/api/v1/:path*'],
}
