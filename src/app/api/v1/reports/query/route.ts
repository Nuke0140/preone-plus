import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/lib/with-api'
import { errValidation } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { ReportService } from '@/lib/reports/report-service'
import { ScopeContext } from '@/lib/reports/report-types'

export const POST = withApi(async (req: NextRequest, ctx) => {
  const session = await requireApi(req, 'reports:read')
  if (isResponse(session)) return session

  const body = await req.json()
  const { reportId, options = {} } = body

  if (!reportId) {
    throw errValidation('reportId is required', 'reportId')
  }

  const scopeCtx: ScopeContext = {
    tenantId: session.tenantId ?? '',
    branchId: options.branchId || session.branchId,
    academicSessionId: options.academicSessionId || null,
    actorId: session.uid,
    actorName: session.name || 'User',
    actorRole: session.role,
    roles: session.roles && session.roles.length > 0 ? session.roles : [session.role],
  }

  const result = await ReportService.queryReport(reportId, options, scopeCtx)
  return NextResponse.json({
    success: true,
    report: result,
    data: result,
    traceId: ctx.traceId,
  })
}, { module: 'reports' })
