import { NextResponse } from 'next/server'
import { getActiveTraceId, logger, generateTraceId } from './logger'
import { toPreOneError } from './errors'

/**
 * PreOne Authoritative API Contract Shim
 * 100% backward-compatible with legacy ok(), fail(), and Errors.* helpers
 * while routing trace ID, response headers, and system logging through the new pipeline.
 */

/**
 * Returns the current request's trace ID or generates an authoritative PRE-XXXXXXXX ID.
 */
export function traceId(): string {
  return getActiveTraceId()
}

export function ok<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  const currentTrace = traceId()
  return NextResponse.json(
    { success: true, data, ...(meta ? { meta } : {}), traceId: currentTrace },
    {
      status,
      headers: {
        'X-API-Version': '1.0.0',
        'X-Trace-Id': currentTrace,
      },
    }
  )
}

export function fail(
  code: string,
  message: string,
  status = 400,
  field?: string,
  details?: unknown
) {
  const currentTrace = traceId()
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(field ? { field } : {}),
        ...(details ? { details } : {}),
      },
      traceId: currentTrace,
    },
    {
      status,
      headers: {
        'X-API-Version': '1.0.0',
        'X-Trace-Id': currentTrace,
      },
    }
  )
}

export const Errors = {
  unauthorized: (msg = 'Authentication required') => fail('AUTH_001', msg, 401),
  invalidToken: (msg = 'Invalid or expired session') => fail('AUTH_002', msg, 401),
  forbidden: (what = 'You do not have permission to perform this action') =>
    fail('PERMISSION_001', what, 403),
  notFound: (entity = 'Resource') => fail('NOT_FOUND_001', `${entity} not found`, 404),
  validation: (message: string, field?: string, details?: unknown) =>
    fail('VALIDATION_001', message, 400, field, details),
  badRequest: (message: string, field?: string) => fail('BAD_REQUEST', message, 400, field),
  conflict: (message: string, field?: string) => fail('CONFLICT_001', message, 409, field),
  business: (code: string, message: string, status = 422, details?: unknown) =>
    fail(code, message, status, undefined, details),
  system: (e: unknown) => {
    const error = toPreOneError(e)
    const currentTrace = traceId()
    logger.error(`System API Error: ${error.message}`, {
      code: error.code,
      traceId: currentTrace,
    }, error)

    return fail('SYSTEM_001', 'Something went wrong on our side', 500)
  },
}

export const bad = (message: string, code = 'BAD_REQUEST', field?: string) =>
  fail(code, message, 400, field)
export const forbidden = (message = 'Forbidden') => Errors.forbidden(message)
export const notFound = (message = 'Resource not found') => fail('NOT_FOUND', message, 404)
export const conflict = (message: string, field?: string) => Errors.conflict(message, field)
export const serverError = (e?: unknown) => Errors.system(e)

// Re-export core platform infrastructure
export { withApi } from './with-api'
export {
  PreOneError,
  errValidation,
  errPermission,
  errNotFound,
  errConflict,
  errBusiness,
  errAuth,
  errDeveloper,
  toPreOneError,
} from './errors'
export { logger, generateTraceId } from './logger'
export { ErrorCodes } from './error-codes'
export { ErrorMessages, getErrorMessage } from './error-messages'
