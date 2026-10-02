import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'

/**
 * GET /api/v1/operations/exceptions — banded exception feed for the command
 * centre (alias view over FollowUp with severity banding only).
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'operations:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const sp = req.nextUrl.searchParams
    const includeResolved = sp.get('includeResolved') === 'true'

    const rows = await db.followUp.findMany({
      where: {
        tenantId: session.tenantId,
        ...(includeResolved ? {} : { status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'WAITING'] } }),
      },
      include: {
        student: { select: { firstName: true, lastName: true, admissionNo: true } },
        classroom: { select: { name: true } },
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    })

    const band = (sev: string) =>
      sev === 'EMERGENCY' || sev === 'URGENT' ? 'CRITICAL' : sev === 'WARNING' ? 'ATTENTION' : 'NORMAL'

    return ok({
      items: rows.map((f) => ({
        id: f.id, band: band(f.severity), domain: f.domain, severity: f.severity,
        status: f.status, title: f.title, detail: f.detail,
        student: f.student ? `${f.student.firstName} ${f.student.lastName || ''}`.trim() : null,
        admissionNo: f.student?.admissionNo ?? null,
        classroom: f.classroom?.name ?? null,
        responsibleRole: f.responsibleRole, dueAt: f.dueAt, createdAt: f.createdAt,
        outcome: f.outcome, resolvedAt: f.resolvedAt,
      })),
      counts: {
        CRITICAL: rows.filter((r) => band(r.severity) === 'CRITICAL').length,
        ATTENTION: rows.filter((r) => band(r.severity) === 'ATTENTION').length,
        NORMAL: rows.filter((r) => band(r.severity) === 'NORMAL').length,
      },
    })
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
