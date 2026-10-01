import { withApi } from '@/lib/with-api'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AuditService } from '@/lib/audit/audit-service'

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""'
  const str = String(val).replace(/"/g, '""')
  return `"${str}"`
}

/**
 * GET /api/v1/audit-logs/export
 * Authoritative CSV export of audit logs with automatic export auditing.
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
    const from = url.searchParams.get('from') || undefined
    const to = url.searchParams.get('to') || undefined

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
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        if (to.length === 10) toDate.setHours(23, 59, 59, 999)
        where.createdAt.lte = toDate
      }
    }
    if (search) {
      where.OR = [
        { summary: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
        { entity: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
        { actorName: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Fetch up to 1000 latest matching records for export
    const logs = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 1000,
    })

    // Record the export event itself in AuditLog (non-recursive)
    await AuditService.recordExport({
      entity: 'AuditLog',
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
      tenantId: session.tenantId,
      filterSummary: moduleFilter ? `module=${moduleFilter}` : undefined,
      recordCount: logs.length,
      req,
    })

    // Generate CSV output
    const headers = [
      'Timestamp (ISO)',
      'Action',
      'Module',
      'Entity',
      'Entity ID',
      'Summary',
      'Severity',
      'Actor Name',
      'Actor Role',
      'IP Address',
      'Request ID',
    ]

    const csvRows = [headers.map(escapeCsvCell).join(',')]

    for (const log of logs) {
      const row = [
        log.createdAt.toISOString(),
        log.action,
        log.module || '',
        log.entity,
        log.entityId || '',
        log.summary || '',
        log.severity,
        log.actorName || 'System',
        log.actorRole || '',
        log.ipAddress || '',
        log.requestId || '',
      ]
      csvRows.push(row.map(escapeCsvCell).join(','))
    }

    const csvData = csvRows.join('\r\n')
    const filename = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
