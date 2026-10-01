/**
 * PreOne Enterprise API Route Wrapper (withApi)
 * Single authoritative error boundary, trace injector, context resolver,
 * performance monitor, and structured observability wrapper for Next.js App Router API routes.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  generateTraceId,
  logger,
  traceStorage,
  healthMetrics,
  TraceContext,
} from './logger'
import { toPreOneError, PreOneError } from './errors'
import { requireApi, isResponse } from './auth-api'
import { SessionPayload } from './auth'

export interface ApiContext {
  traceId: string
  module: string
  params?: Record<string, string | string[]>
  session?: SessionPayload
}

export interface WithApiOptions {
  module?: string
  permission?: string
  slowThresholdMs?: number
}

/**
 * Dynamically resolves the domain module from the API route pathname.
 * Example: /api/v1/students/123 -> "students"
 * Example: /api/v1/hr/staff -> "hr"
 */
export function deriveModuleFromPath(pathname: string): string {
  const clean = pathname.replace(/^\/api\/v\d+\//, '')
  const segments = clean.split('/').filter(Boolean)
  return segments[0] || 'core'
}

/**
 * Higher-order function wrapping Next.js route handlers.
 */
export function withApi<T = unknown>(
  handler: (req: NextRequest, ctx: any) => Promise<NextResponse | Response>,
  options: WithApiOptions = {}
) {
  return async (req: NextRequest, segmentData?: { params?: Promise<Record<string, string | string[]>> | Record<string, string | string[]> }) => {
    const startTime = Date.now()

    // 1. Resolve or extract single authoritative Trace ID
    const incomingTraceId = req.headers.get('x-trace-id') || req.headers.get('traceparent')
    const traceId = incomingTraceId && incomingTraceId.startsWith('PRE-')
      ? incomingTraceId
      : generateTraceId('PRE')

    // 2. Derive domain module dynamically
    const derivedModule = options.module || deriveModuleFromPath(req.nextUrl.pathname)

    // 3. Resolve params safely
    let params: Record<string, string | string[]> | undefined
    if (segmentData?.params) {
      params = segmentData.params instanceof Promise ? await segmentData.params : segmentData.params
    }

    // 4. Create child logger scoped to this request
    const reqLogger = logger.child({
      traceId,
      module: derivedModule,
      route: req.nextUrl.pathname,
      method: req.method,
    })

    const traceContext: TraceContext = {
      traceId,
      module: derivedModule,
      route: req.nextUrl.pathname,
      method: req.method,
      startTime,
    }

    return traceStorage.run(traceContext, async () => {
      let session: SessionPayload | undefined

      // 5. Optional route-level permission enforcement
      if (options.permission) {
        const authResult = await requireApi(req, options.permission)
        if (isResponse(authResult)) {
          // Attach X-Trace-Id header to unauthorized response
          const res = authResult as Response
          const headers = new Headers(res.headers)
          headers.set('X-Trace-Id', traceId)
          headers.set('X-API-Version', '1.0.0')
          return new Response(res.body, {
            status: res.status,
            statusText: res.statusText,
            headers,
          })
        }
        session = authResult
        traceContext.userId = session.uid
        traceContext.tenantId = session.tenantId || undefined
        traceContext.branchId = session.branchId || undefined
        traceContext.role = session.role
      }

      try {
        const apiCtx: ApiContext = {
          traceId,
          module: derivedModule,
          params: params || {},
          session,
        }

        const response = await handler(req, apiCtx)
        const durationMs = Date.now() - startTime

        // Record request duration for observability
        const slowThreshold = options.slowThresholdMs || Number(process.env.SLOW_REQUEST_MS) || 1500
        healthMetrics.recordRequestDuration(durationMs, slowThreshold)

        if (durationMs > slowThreshold) {
          reqLogger.warn(`Slow API request detected: ${durationMs}ms`, {
            durationMs,
            status: response.status,
          })
        }

        // Ensure X-Trace-Id is attached to successful responses
        if (response instanceof NextResponse || response instanceof Response) {
          response.headers.set('X-Trace-Id', traceId)
          response.headers.set('X-API-Version', '1.0.0')
        }

        return response
      } catch (rawError: unknown) {
        const durationMs = Date.now() - startTime

        // Normalize caught error into authoritative PreOneError
        const error = toPreOneError(rawError, derivedModule)
        error.traceId = traceId

        if (error.isOperational()) {
          reqLogger.warn(error.userMessage, {
            code: error.code,
            field: error.field,
            status: error.httpStatus,
            durationMs,
          }, error)
        } else {
          reqLogger.error(
            `Unhandled exception in ${req.method} ${req.nextUrl.pathname}: ${error.message}`,
            {
              code: error.code,
              status: error.httpStatus,
              durationMs,
            },
            error
          )
        }

        return NextResponse.json(
          {
            success: false,
            error: error.toPublicJson(),
            traceId,
          },
          {
            status: error.httpStatus,
            headers: {
              'X-Trace-Id': traceId,
              'X-API-Version': '1.0.0',
            },
          }
        )
      }
    })
  }
}
