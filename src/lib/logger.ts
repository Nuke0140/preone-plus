/**
 * PreOne Enterprise Structured Logger & Observability Engine
 * High-performance JSON logger with edge trace propagation, child context,
 * safe secret redaction, and in-memory health metrics aggregation.
 */

import { AsyncLocalStorage } from 'async_hooks'
import { redactSensitive } from './redaction'
import { isOperational, PreOneError } from './errors'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

export interface LogContext {
  traceId?: string
  requestId?: string
  module?: string
  route?: string
  method?: string
  status?: number
  durationMs?: number
  userId?: string
  tenantId?: string
  branchId?: string
  role?: string
  code?: string
  errorClass?: 'OPERATIONAL' | 'DEVELOPER'
  field?: string
  [key: string]: unknown
}

export interface TraceContext extends LogContext {
  traceId: string
  startTime?: number
}

// Global AsyncLocalStorage for request trace context propagation
export const traceStorage = new AsyncLocalStorage<TraceContext>()

/**
 * Generates a unified PreOne Trace ID.
 * Example: PRE-7F3A9C21 or PRE-JOB-7F3A9C21
 */
export function generateTraceId(prefix = 'PRE'): string {
  const randomHex = Math.random().toString(16).substring(2, 10).toUpperCase().padEnd(8, '0')
  return `${prefix}-${randomHex}`
}

/**
 * Retrieves the active trace ID from the async local context, or generates a fallback ID.
 */
export function getActiveTraceId(): string {
  const store = traceStorage.getStore()
  if (store?.traceId) {
    return store.traceId
  }
  return generateTraceId('PRE')
}

// -------------------------------------------------------------
// IN-MEMORY OBSERVABILITY & HEALTH METRICS AGGREGATOR
// -------------------------------------------------------------

interface ErrorMetricItem {
  timestamp: number
  code: string
  module: string
  errorClass: 'OPERATIONAL' | 'DEVELOPER'
  durationMs?: number
}

class HealthMetricsAggregator {
  private static readonly RETENTION_MS = 24 * 60 * 60 * 1000 // 24 hours
  private metrics: ErrorMetricItem[] = []
  private slowRequestCount = 0

  recordError(code: string, module: string, errorClass: 'OPERATIONAL' | 'DEVELOPER') {
    const now = Date.now()
    this.cleanOld(now)
    this.metrics.push({ timestamp: now, code, module, errorClass })
    if (this.metrics.length > 5000) {
      this.metrics.shift()
    }
  }

  recordRequestDuration(durationMs: number, thresholdMs = 1500) {
    if (durationMs > thresholdMs) {
      this.slowRequestCount++
    }
  }

  private cleanOld(now: number) {
    const cutoff = now - HealthMetricsAggregator.RETENTION_MS
    while (this.metrics.length > 0 && this.metrics[0].timestamp < cutoff) {
      this.metrics.shift()
    }
  }

  getSnapshot() {
    const now = Date.now()
    this.cleanOld(now)

    let operationalCount = 0
    let developerCount = 0
    const codeMap: Record<string, number> = {}
    const moduleMap: Record<string, number> = {}

    for (const m of this.metrics) {
      if (m.errorClass === 'OPERATIONAL') operationalCount++
      else developerCount++

      codeMap[m.code] = (codeMap[m.code] || 0) + 1
      moduleMap[m.module] = (moduleMap[m.module] || 0) + 1
    }

    const topCodes = Object.entries(codeMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, count]) => ({ code, count }))

    const topModules = Object.entries(moduleMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([mod, count]) => ({ module: mod, count }))

    return {
      operationalErrorCount24h: operationalCount,
      developerErrorCount24h: developerCount,
      topErrorCodes: topCodes,
      topModules: topModules,
      slowRequestCount: this.slowRequestCount,
    }
  }
}

export const healthMetrics = new HealthMetricsAggregator()

// -------------------------------------------------------------
// STRUCTURED LOGGER IMPLEMENTATION
// -------------------------------------------------------------

export class StructuredLogger {
  private baseContext: LogContext

  constructor(baseContext: LogContext = {}) {
    this.baseContext = baseContext
  }

  private shouldLog(level: LogLevel): boolean {
    const configuredLevel = (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel
    const threshold = LOG_LEVEL_ORDER[configuredLevel] ?? LOG_LEVEL_ORDER.info
    return LOG_LEVEL_ORDER[level] >= threshold
  }

  private emit(
    level: LogLevel,
    message: string,
    context?: LogContext,
    errorObj?: unknown
  ) {
    if (!this.shouldLog(level)) return

    try {
      const activeStore = traceStorage.getStore()
      const mergedContext: LogContext = {
        ...this.baseContext,
        ...(activeStore || {}),
        ...(context || {}),
      }

      const traceId = mergedContext.traceId || getActiveTraceId()
      const safeContext = redactSensitive(mergedContext) as Record<string, unknown>

      let stack: string | undefined
      let errorClass: 'OPERATIONAL' | 'DEVELOPER' | undefined = safeContext.errorClass as any
      let code: string | undefined = safeContext.code as any

      if (errorObj) {
        if (errorObj instanceof PreOneError) {
          errorClass = errorObj.class
          code = errorObj.code
          if (errorObj.class === 'DEVELOPER') {
            stack = errorObj.stack || (errorObj.cause instanceof Error ? errorObj.cause.stack : undefined)
          }
        } else if (errorObj instanceof Error) {
          errorClass = 'DEVELOPER'
          stack = errorObj.stack
        }
      }

      const entry: Record<string, unknown> = {
        ts: new Date().toISOString(),
        level,
        msg: message,
        traceId,
        ...safeContext,
      }

      if (code) entry.code = code
      if (errorClass) entry.errorClass = errorClass
      if (stack && level === 'error') entry.stack = stack

      // Output as clean single-line JSON to standard output
      const jsonLine = JSON.stringify(entry)
      if (level === 'error') {
        process.stderr.write(jsonLine + '\n')
      } else {
        process.stdout.write(jsonLine + '\n')
      }
    } catch {
      // Safe fallback - logger must never crash the host process
    }
  }

  debug(msg: string, ctx?: LogContext) {
    this.emit('debug', msg, ctx)
  }

  info(msg: string, ctx?: LogContext) {
    this.emit('info', msg, ctx)
  }

  warn(msg: string, ctx?: LogContext, err?: unknown) {
    if (err instanceof PreOneError && err.class === 'OPERATIONAL') {
      healthMetrics.recordError(err.code, err.module, 'OPERATIONAL')
    }
    this.emit('warn', msg, ctx, err)
  }

  error(msg: string, ctx?: LogContext, err?: unknown) {
    const errorClass = isOperational(err) ? 'OPERATIONAL' : 'DEVELOPER'
    const code = (err as any)?.code || ctx?.code || 'SYSTEM_001'
    const mod = (err as any)?.module || ctx?.module || 'system'
    healthMetrics.recordError(code, mod, errorClass)

    this.emit('error', msg, ctx, err)
  }

  child(childContext: LogContext): StructuredLogger {
    return new StructuredLogger({
      ...this.baseContext,
      ...childContext,
    })
  }
}

export const logger = new StructuredLogger()
