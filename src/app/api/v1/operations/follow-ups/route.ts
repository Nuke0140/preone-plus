import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'

/**
 * GET /api/v1/operations/follow-ups — exception & follow-up queue.
 * Filters: status, severity, domain, studentId, mine=true.
 * Auth: operations:read. Every unresolved item stays visible (Spec §42).
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'operations:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const sp = req.nextUrl.searchParams
    const status = sp.get('status')
    const severity = sp.get('severity')
    const domain = sp.get('domain')
    const studentId = sp.get('studentId')
    const mine = sp.get('mine') === 'true'
    const take = Math.min(Number(sp.get('take') || 100), 200)

    const rows = await db.followUp.findMany({
      where: {
        tenantId: session.tenantId,
        ...(status ? { status: status as 'OPEN' } : {}),
        ...(severity ? { severity: severity as 'WARNING' } : {}),
        ...(domain ? { domain: domain as 'ATTENDANCE' } : {}),
        ...(studentId ? { studentId } : {}),
        ...(mine ? { assignedToId: session.uid } : {}),
        // teachers only see their classroom's items or ones assigned to them
        ...(session.role === 'TEACHER' && !mine
          ? {
              OR: [
                { assignedToId: session.uid },
                { classroom: { primaryTeacherId: session.uid } },
                { studentId: null },
              ],
            }
          : {}),
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
        classroom: { select: { id: true, name: true } },
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take,
    })

    const openCount = await db.followUp.count({
      where: { tenantId: session.tenantId, status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'WAITING'] } },
    })

    return ok({
      openCount,
      items: rows.map((f) => ({
        id: f.id, domain: f.domain, severity: f.severity, status: f.status,
        title: f.title, detail: f.detail, sourceType: f.sourceType, sourceId: f.sourceId,
        student: f.student ? { id: f.student.id, name: `${f.student.firstName} ${f.student.lastName || ''}`.trim(), admissionNo: f.student.admissionNo } : null,
        classroom: f.classroom?.name ?? null,
        responsibleRole: f.responsibleRole, assignedToId: f.assignedToId,
        dueAt: f.dueAt, actionTaken: f.actionTaken, outcome: f.outcome,
        resolvedAt: f.resolvedAt, resolvedByName: f.resolvedByName, closedAt: f.closedAt,
        createdAt: f.createdAt, createdByName: f.createdByName,
      })),
    })
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
