/**
 * PreOne Client API Client & Unified Error Parser
 * Standardized client-side fetch, response parser, and UI error presenter.
 */

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  meta?: Record<string, unknown>
  error?: {
    code: string
    message: string
    field?: string
    details?: unknown
  }
  traceId?: string
}

export interface ParsedClientError {
  code: string
  message: string
  field?: string
  details?: unknown
  traceId?: string
  isOperational: boolean
}

/**
 * Parses any client error, fetch exception, or API response into a standardized shape.
 */
export function parseApiError(err: unknown): ParsedClientError {
  if (err && typeof err === 'object') {
    const obj = err as Record<string, any>

    // 1. API Response error object
    if (obj.error && typeof obj.error === 'object') {
      const code = obj.error.code || 'SYSTEM_001'
      const isOp = !code.startsWith('SYSTEM_')
      return {
        code,
        message: obj.error.message || 'An unexpected error occurred.',
        field: obj.error.field,
        details: obj.error.details,
        traceId: obj.traceId,
        isOperational: isOp,
      }
    }

    // 2. HTTP Fetch Response object
    if (typeof obj.status === 'number' && obj.status >= 400) {
      const isOp = obj.status < 500
      return {
        code: isOp ? 'OPERATION_FAILED' : 'SYSTEM_001',
        message: obj.statusText || 'Request failed',
        traceId: obj.traceId,
        isOperational: isOp,
      }
    }

    // 3. Standard JS Error
    if (err instanceof Error) {
      return {
        code: 'CLIENT_ERROR',
        message: err.message || 'Something went wrong on your device.',
        isOperational: false,
      }
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: typeof err === 'string' ? err : 'An unexpected error occurred.',
    isOperational: false,
  }
}

/**
 * Formats a user-facing toast notification for UI display.
 */
export function formatErrorToast(err: unknown): {
  title: string
  description: string
  traceId?: string
} {
  const parsed = parseApiError(err)

  if (parsed.isOperational) {
    return {
      title: 'Action Required',
      description: parsed.message,
      traceId: parsed.traceId,
    }
  }

  return {
    title: 'Something went wrong',
    description: parsed.traceId
      ? `${parsed.message} (Reference: ${parsed.traceId})`
      : parsed.message,
    traceId: parsed.traceId,
  }
}

/**
 * Authoritative client fetch wrapper enforcing trace propagation and response envelopes.
 */
export async function apiFetch<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(input, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init?.headers || {}),
      },
    })

    const headerTraceId = res.headers.get('X-Trace-Id') || undefined
    let body: any = null

    try {
      body = await res.json()
    } catch {
      // Non-JSON response
      body = null
    }

    if (!res.ok) {
      if (body && typeof body === 'object' && body.error) {
        return {
          success: false,
          error: body.error,
          traceId: body.traceId || headerTraceId,
        }
      }

      return {
        success: false,
        error: {
          code: res.status >= 500 ? 'SYSTEM_001' : 'REQUEST_FAILED',
          message: res.statusText || `Request failed with status ${res.status}`,
        },
        traceId: headerTraceId,
      }
    }

    return {
      success: true,
      data: body?.data ?? body,
      meta: body?.meta,
      traceId: body?.traceId || headerTraceId,
    }
  } catch (netErr: any) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: netErr?.message || 'Network connection failed. Please check your internet.',
      },
    }
  }
}
