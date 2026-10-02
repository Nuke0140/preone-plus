import { db } from '../db'
import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { logger } from '../logger'

export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export type AuditModule =
  | 'AUTH'
  | 'USERS'
  | 'SETUP'
  | 'ACADEMICS'
  | 'ADMISSIONS'
  | 'STUDENTS'
  | 'OPERATIONS'
  | 'FEES'
  | 'ANNOUNCEMENTS'
  | 'SETTINGS'
  | 'AUDIT'
  | 'SYSTEM'
  | 'INVENTORY'
  | 'PROCUREMENT'
  | 'HR'
  | 'PAYROLL'
  | 'TRANSPORT'
  | 'REPORTS'

export interface AuditEntry {
  tenantId?: string | null
  branchId?: string | null
  academicSessionId?: string | null
  actorId?: string | null
  actorName?: string | null
  actorRole?: string | null
  action: string
  entity: string
  entityId?: string | null
  module?: string | null
  summary?: string | null
  severity?: AuditSeverity
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
  oldValues?: any
  newValues?: any
}

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'secretkey',
  'apikey',
  'clientsecret',
  'webhooksecret',
  'privatekey',
  'otp',
  'cvv',
  'cardnumber',
])

/**
 * Recursively masks sensitive fields in objects/arrays to '[REDACTED]'.
 */
export function redactSensitive(val: any): any {
  if (val === null || val === undefined) return val
  if (typeof val === 'string') return val
  if (typeof val !== 'object') return val

  if (Array.isArray(val)) {
    return val.map((item) => redactSensitive(item))
  }

  const result: Record<string, any> = {}
  for (const [k, v] of Object.entries(val)) {
    const lowerKey = k.toLowerCase().replace(/[-_]/g, '')
    if (SENSITIVE_KEYS.has(lowerKey)) {
      result[k] = '[REDACTED]'
    } else if (v && typeof v === 'object') {
      result[k] = redactSensitive(v)
    } else {
      result[k] = v
    }
  }
  return result
}

/**
 * Computes deep field-level diff between two objects, retaining only changed fields
 * and applying sensitive redaction.
 */
export function computeDiff(before: any, after: any): { oldValues: any; newValues: any } | null {
  if (!before && !after) return null
  if (!before && after) {
    return { oldValues: null, newValues: redactSensitive(after) }
  }
  if (before && !after) {
    return { oldValues: redactSensitive(before), newValues: null }
  }

  const redactedBefore = redactSensitive(before)
  const redactedAfter = redactSensitive(after)

  if (typeof redactedBefore !== 'object' || typeof redactedAfter !== 'object') {
    return { oldValues: redactedBefore, newValues: redactedAfter }
  }

  const allKeys = new Set([...Object.keys(redactedBefore), ...Object.keys(redactedAfter)])
  const oldDiff: Record<string, any> = {}
  const newDiff: Record<string, any> = {}
  let hasChanges = false

  for (const key of allKeys) {
    const oldVal = redactedBefore[key]
    const newVal = redactedAfter[key]

    // Skip technical timestamp or runtime fields
    if (key === 'updatedAt' || key === 'lastLoginAt' || key === 'createdAt') {
      continue
    }

    const oldStr = JSON.stringify(oldVal)
    const newStr = JSON.stringify(newVal)

    if (oldStr !== newStr) {
      oldDiff[key] = oldVal === undefined ? null : oldVal
      newDiff[key] = newVal === undefined ? null : newVal
      hasChanges = true
    }
  }

  if (!hasChanges) return null
  return { oldValues: oldDiff, newValues: newDiff }
}

/**
 * Derives default audit severity based on action keywords and security classifications.
 */
export function deriveSeverity(action: string, explicitSeverity?: AuditSeverity): AuditSeverity {
  if (explicitSeverity) return explicitSeverity

  const act = action.toUpperCase()
  if (
    act.includes('CRITICAL') ||
    act.includes('ROLE_CHANGED') ||
    act.includes('PERMISSION_CHANGED') ||
    act.includes('SECURITY_SETTING_CHANGED') ||
    act.includes('INTEGRATION_CHANGED') ||
    act.includes('EMERGENCY_BLOCK')
  ) {
    return 'CRITICAL'
  }

  if (
    act.includes('FAILED') ||
    act.includes('FAILURE') ||
    act.includes('REJECTED') ||
    act.includes('WARNING') ||
    act.includes('PICKUP_VERIFICATION_FAILED') ||
    act.includes('LOGIN_FAILED') ||
    act.includes('AUTHORIZATION_FAILED') ||
    act.includes('SESSION_REVOKED') ||
    act.includes('PASSWORD_RESET') ||
    act.includes('CANCELLED')
  ) {
    return 'WARNING'
  }

  return 'INFO'
}

/**
 * Extracts client IP and User Agent headers from a NextRequest or standard Request.
 */
export function getRequestMeta(req?: NextRequest | Request | null): {
  ipAddress?: string
  userAgent?: string
  requestId?: string
} {
  if (!req) return {}
  const headers = req.headers
  const ip =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    undefined
  const ua = headers.get('user-agent') || undefined
  const reqId = headers.get('x-request-id') || undefined
  return { ipAddress: ip, userAgent: ua, requestId: reqId }
}

/**
 * Single Authoritative Audit Service
 */
export class AuditService {
  /**
   * Primary writer for AuditLog records. Accepts an optional Prisma transaction client.
   */
  static async record(
    entry: AuditEntry,
    tx?: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
  ): Promise<any> {
    const client = tx || db
    const severity = deriveSeverity(entry.action, entry.severity)

    // Redact both old and new values
    const safeOldValues = entry.oldValues ? redactSensitive(entry.oldValues) : undefined
    const safeNewValues = entry.newValues ? redactSensitive(entry.newValues) : undefined

    try {
      return await client.auditLog.create({
        data: {
          tenantId: entry.tenantId ?? undefined,
          branchId: entry.branchId ?? undefined,
          academicSessionId: entry.academicSessionId ?? undefined,
          actorId: entry.actorId ?? undefined,
          actorName: entry.actorName ?? undefined,
          actorRole: entry.actorRole ?? undefined,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId ?? undefined,
          module: entry.module ?? undefined,
          summary: entry.summary ?? undefined,
          severity,
          ipAddress: entry.ipAddress ?? undefined,
          userAgent: entry.userAgent ?? undefined,
          requestId: entry.requestId ?? undefined,
          oldValues: safeOldValues !== undefined ? JSON.stringify(safeOldValues) : undefined,
          newValues: safeNewValues !== undefined ? JSON.stringify(safeNewValues) : undefined,
        },
      })
    } catch (err) {
      logger.warn('Failed to write audit log', { code: 'AUDIT_WRITE_FAILED', entity: entry.entity, action: entry.action }, err)
      if (tx) throw err
      return null
    }
  }

  /**
   * Helper for recording security attempts and unauthorized actions.
   */
  static async recordSecurityEvent(params: {
    action: string
    entity: string
    entityId?: string | null
    module?: string
    actorId?: string | null
    actorName?: string | null
    actorRole?: string | null
    tenantId?: string | null
    summary: string
    severity?: AuditSeverity
    req?: NextRequest | Request | null
    details?: any
  }): Promise<void> {
    const meta = getRequestMeta(params.req)
    await AuditService.record({
      tenantId: params.tenantId,
      actorId: params.actorId,
      actorName: params.actorName,
      actorRole: params.actorRole,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      module: params.module || 'AUTH',
      summary: params.summary,
      severity: params.severity || 'WARNING',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
      newValues: params.details,
    })
  }

  /**
   * Helper for recording entity mutations with before/after diff computation.
   */
  static async recordDataChange(params: {
    action: string
    entity: string
    entityId?: string | null
    module?: string
    actorId?: string | null
    actorName?: string | null
    actorRole?: string | null
    tenantId?: string | null
    branchId?: string | null
    academicSessionId?: string | null
    summary: string
    before?: any
    after?: any
    severity?: AuditSeverity
    req?: NextRequest | Request | null
    tx?: any
  }): Promise<void> {
    const meta = getRequestMeta(params.req)
    const diff = computeDiff(params.before, params.after)

    await AuditService.record(
      {
        tenantId: params.tenantId,
        branchId: params.branchId,
        academicSessionId: params.academicSessionId,
        actorId: params.actorId,
        actorName: params.actorName,
        actorRole: params.actorRole,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        module: params.module,
        summary: params.summary,
        severity: params.severity,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
        oldValues: diff?.oldValues ?? null,
        newValues: diff?.newValues ?? null,
      },
      params.tx
    )
  }

  /**
   * Helper for recording export events.
   */
  static async recordExport(params: {
    entity: string
    actorId?: string | null
    actorName?: string | null
    actorRole?: string | null
    tenantId?: string | null
    filterSummary?: string
    recordCount: number
    req?: NextRequest | Request | null
  }): Promise<void> {
    const meta = getRequestMeta(params.req)
    await AuditService.record({
      tenantId: params.tenantId,
      actorId: params.actorId,
      actorName: params.actorName,
      actorRole: params.actorRole,
      action: 'AUDIT_LOG_EXPORTED',
      entity: params.entity,
      module: 'AUDIT',
      summary: `Exported ${params.recordCount} audit records${params.filterSummary ? ` (${params.filterSummary})` : ''}`,
      severity: 'INFO',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
      newValues: {
        recordCount: params.recordCount,
        filter: params.filterSummary || 'none',
      },
    })
  }
}

// Backward-compatible export bindings
export const recordAudit = AuditService.record
export const audit = AuditService.record
