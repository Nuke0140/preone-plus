import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'

/**
 * GET /api/v1/audit-logs
 * Authoritative immutable audit query & dashboard aggregates.
 * Requires 'audit:read' permission. Strictly tenant-isolated.
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'audit:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const url = req.nextUrl
    const search = url.searchParams.get('search')?.trim() || undefined
    const moduleFilter = url.searchParams.get('module') || undefined
    const actionFilter = url.searchParams.get('action') || undefined
    const severityFilter = url.searchParams.get('severity') || undefined
    const entityTypeFilter = url.searchParams.get('entity') || url.searchParams.get('entityType') || undefined
    const entityIdFilter = url.searchParams.get('entityId') || undefined
    const actorIdFilter = url.searchParams.get('actorUserId') || url.searchParams.get('actorId') || undefined
    const roleFilter = url.searchParams.get('role') || undefined
    const branchIdFilter = url.searchParams.get('branchId') || undefined
    const academicYearIdFilter = url.searchParams.get('academicYearId') || undefined
    const categoryView = url.searchParams.get('category') || undefined // 'security' | 'changes' | 'finance' | 'exports'
    const from = url.searchParams.get('from') || undefined
    const to = url.searchParams.get('to') || undefined

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '25')))

    const where: Record<string, any> = {
      tenantId: session.tenantId,
    }

    if (moduleFilter && moduleFilter !== 'ALL') {
      where.module = { equals: moduleFilter, mode: 'insensitive' }
    }
    if (actionFilter && actionFilter !== 'ALL') {
      where.action = actionFilter
    }
    if (severityFilter && severityFilter !== 'ALL') {
      where.severity = severityFilter
    }
    if (entityTypeFilter) {
      where.entity = { equals: entityTypeFilter, mode: 'insensitive' }
    }
    if (entityIdFilter) {
      where.entityId = entityIdFilter
    }
    if (actorIdFilter) {
      where.actorId = actorIdFilter
    }
    if (roleFilter && roleFilter !== 'ALL') {
      where.actorRole = roleFilter
    }
    if (branchIdFilter) {
      where.branchId = branchIdFilter
    }
    if (academicYearIdFilter) {
      where.academicSessionId = academicYearIdFilter
    }

    // Category Views
    if (categoryView === 'security') {
      where.OR = [
        { severity: { in: ['WARNING', 'CRITICAL'] } },
        { action: { in: ['LOGIN_FAILED', 'AUTHORIZATION_FAILED', 'ROLE_CHANGED', 'PERMISSION_CHANGED', 'SESSION_REVOKED', 'PASSWORD_RESET', 'PICKUP_VERIFICATION_FAILED', 'SECURITY_SETTING_CHANGED', 'INTEGRATION_CHANGED'] } },
      ]
    } else if (categoryView === 'changes') {
      where.AND = [
        { oldValues: { not: null } },
        { newValues: { not: null } },
      ]
    } else if (categoryView === 'finance') {
      where.OR = [
        { module: { in: ['FEES', 'Fees', 'Finance'] } },
        { action: { in: ['INVOICE_CREATED', 'PAYMENT_INITIATED', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'PAYMENT_REFUNDED', 'RECEIPT_GENERATED'] } },
      ]
    } else if (categoryView === 'exports') {
      where.action = { contains: 'EXPORT' }
    }

    // Date Range
    if (from || to) {
      where.createdAt = {}
      if (from) {
        where.createdAt.gte = new Date(from)
      }
      if (to) {
        // End of day if YYYY-MM-DD
        const toDate = new Date(to)
        if (to.length === 10) toDate.setHours(23, 59, 59, 999)
        where.createdAt.lte = toDate
      }
    }

    // Global Search
    if (search) {
      where.OR = [
        { summary: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
        { entity: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
        { actorName: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Include dashboard KPIs if requested on page 1
    const includeKpis = url.searchParams.get('includeKpis') === 'true' || page === 1

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const [total, logs, kpis] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      includeKpis
        ? Promise.all([
            db.auditLog.count({ where: { tenantId: session.tenantId } }),
            db.auditLog.count({
              where: {
                tenantId: session.tenantId,
                createdAt: { gte: startOfToday },
              },
            }),
            db.auditLog.count({
              where: {
                tenantId: session.tenantId,
                OR: [
                  { severity: { in: ['WARNING', 'CRITICAL'] } },
                  { action: { in: ['LOGIN_FAILED', 'AUTHORIZATION_FAILED', 'PICKUP_VERIFICATION_FAILED', 'ROLE_CHANGED'] } },
                ],
              },
            }),
            db.auditLog.count({
              where: {
                tenantId: session.tenantId,
                severity: 'CRITICAL',
              },
            }),
            db.auditLog.count({
              where: {
                tenantId: session.tenantId,
                OR: [
                  { action: { contains: 'FAIL' } },
                  { action: { contains: 'REJECT' } },
                ],
              },
            }),
            db.auditLog.count({
              where: {
                tenantId: session.tenantId,
                action: { contains: 'EXPORT' },
              },
            }),
          ]).then(([totalEvents, todayEvents, securityEvents, criticalEvents, failedActions, exportEvents]) => ({
            totalEvents,
            todayEvents,
            securityEvents,
            criticalEvents,
            failedActions,
            exportEvents,
          }))
        : Promise.resolve(null),
    ])

    return ok(logs, {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      kpis,
    })
  } catch (e) {
    return Errors.system(e)
  }
}

/**
 * Audit logs are immutable. Rejects any mutation method.
 */
async function _POST() {
  return Errors.business('IMMUTABLE_LOG', 'Audit logs are immutable and cannot be created directly via API', 405)
}

async function _PUT() {
  return Errors.business('IMMUTABLE_LOG', 'Audit logs are immutable and cannot be modified', 405)
}

async function _PATCH() {
  return Errors.business('IMMUTABLE_LOG', 'Audit logs are immutable and cannot be modified', 405)
}

async function _DELETE() {
  return Errors.business('IMMUTABLE_LOG', 'Audit logs are immutable and cannot be deleted', 405)
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
export const PUT = withApi(_PUT)
export const PATCH = withApi(_PATCH)
export const DELETE = withApi(_DELETE)
