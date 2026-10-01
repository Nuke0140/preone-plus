import { NextRequest } from 'next/server'
import { ok, withApi, errPermission } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { getRequestMeta } from '@/lib/audit'
import { OperationsService } from '@/lib/operations/operations-service'
import { healthMetrics } from '@/lib/logger'

/**
 * GET /api/v1/operations/health
 * Aggregated platform reliability, error rates, and observability health metrics.
 * Exposes zero PII, zero tokens, and zero sensitive database information.
 */
export const GET = withApi(async () => {
  const snapshot = healthMetrics.getSnapshot()
  return ok({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    ...snapshot,
  })
}, { module: 'operations' })

/**
 * POST /api/v1/operations/health
 * Records morning health check and symptom observation for classroom students.
 */
export const POST = withApi(async (req: NextRequest) => {
  const session = await requireApi(req, 'attendance:mark')
  if (isResponse(session)) return session
  if (!session.tenantId) {
    throw errPermission('No tenant context found in active session')
  }

  const body = await req.json()
  const meta = getRequestMeta(req)

  const res = await OperationsService.recordHealthCheck(
    {
      tenantId: session.tenantId,
      branchId: session.branchId,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
    body
  )

  return ok(res, undefined, 201)
}, { module: 'operations' })
