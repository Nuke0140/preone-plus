import { NextRequest } from 'next/server'
import { withApi } from '@/lib/with-api'
import { errValidation, errAuth } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { ReportService } from '@/lib/reports/report-service'
import { ExportFormat, ScopeContext } from '@/lib/reports/report-types'

export const POST = withApi(async (req: NextRequest, ctx) => {
  const session = await requireApi(req, 'reports:export')
  if (isResponse(session)) return session
  if (!session.tenantId) {
    throw errAuth('Tenant context required')
  }

  const body = await req.json()
  const { reportId, format = 'CSV', options = {} } = body

  if (!reportId) {
    throw errValidation('reportId is required', 'reportId')
  }

  const scopeCtx: ScopeContext = {
    tenantId: session.tenantId,
    branchId: options.branchId || session.branchId,
    actorId: session.uid,
    actorName: session.name || 'User',
    actorRole: session.role,
    roles: session.roles && session.roles.length > 0 ? session.roles : [session.role],
  }

  const exportData = await ReportService.exportReport(
    reportId,
    format.toUpperCase() as ExportFormat,
    options,
    scopeCtx
  )

  return new Response(exportData.content, {
    status: 200,
    headers: {
      'Content-Type': exportData.contentType,
      'Content-Disposition': `attachment; filename="${exportData.filename}"`,
      'X-Trace-Id': ctx.traceId,
      'X-API-Version': '1.0.0',
    },
  })
}, { module: 'reports' })
