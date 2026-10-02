import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/lib/with-api'
import { errAuth, errValidation } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { ReportService } from '@/lib/reports/report-service'
import { ScopeContext } from '@/lib/reports/report-types'

export const GET = withApi(async (req: NextRequest, ctx) => {
  const session = await requireApi(req, 'reports:read')
  if (isResponse(session)) return session
  if (!session.tenantId) {
    throw errAuth('Tenant context required')
  }

  const scopeCtx: ScopeContext = {
    tenantId: session.tenantId,
    branchId: session.branchId,
    actorId: session.uid,
    actorName: session.name || 'User',
    actorRole: session.role,
    roles: session.roles && session.roles.length > 0 ? session.roles : [session.role],
  }

  const reports = await ReportService.listCustomReports(scopeCtx)
  return NextResponse.json({
    success: true,
    reports,
    data: reports,
    traceId: ctx.traceId,
  })
}, { module: 'reports' })

export const POST = withApi(async (req: NextRequest, ctx) => {
  const session = await requireApi(req, 'reports:custom')
  if (isResponse(session)) return session
  if (!session.tenantId) {
    throw errAuth('Tenant context required')
  }

  const payload = await req.json()
  if (!payload.name || !payload.source || !payload.fields || payload.fields.length === 0) {
    throw errValidation('Name, source, and at least one field are required')
  }

  const scopeCtx: ScopeContext = {
    tenantId: session.tenantId,
    branchId: session.branchId,
    actorId: session.uid,
    actorName: session.name || 'User',
    actorRole: session.role,
    roles: session.roles && session.roles.length > 0 ? session.roles : [session.role],
  }

  const saved = await ReportService.saveCustomReport(payload, scopeCtx)
  return NextResponse.json({
    success: true,
    report: saved,
    data: saved,
    traceId: ctx.traceId,
  })
}, { module: 'reports' })
