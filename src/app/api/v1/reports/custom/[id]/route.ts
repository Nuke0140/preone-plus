import { NextRequest, NextResponse } from 'next/server'
import { withApi } from '@/lib/with-api'
import { errAuth } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { ReportService } from '@/lib/reports/report-service'
import { ScopeContext } from '@/lib/reports/report-types'

export const DELETE = withApi(async (req: NextRequest, ctx) => {
  const session = await requireApi(req, 'reports:custom')
  if (isResponse(session)) return session
  if (!session.tenantId) {
    throw errAuth('Tenant context required')
  }

  const id = ctx.params?.id as string
  const scopeCtx: ScopeContext = {
    tenantId: session.tenantId,
    branchId: session.branchId,
    actorId: session.uid,
    actorName: session.name || 'User',
    actorRole: session.role,
    roles: session.roles && session.roles.length > 0 ? session.roles : [session.role],
  }

  await ReportService.deleteCustomReport(id, scopeCtx)
  return NextResponse.json({
    success: true,
    traceId: ctx.traceId,
  })
}, { module: 'reports' })
