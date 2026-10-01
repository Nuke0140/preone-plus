import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { audit } from '@/lib/sequence'
import { emit } from '@/lib/events'
import { registerIntegrations } from '@/lib/integrations'

/**
 * POST /api/v1/academic-years/{id}/close — transactional year-end step 1
 * (Spec §6/§Scenario 10). ACTIVE → CLOSING → CLOSED, isCurrent cleared.
 * Reports open items (outstanding invoices / unresolved follow-ups) — the
 * caller decides to proceed; historical data is never touched.
 */
async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  registerIntegrations()

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const confirm: boolean = body?.confirm === true

  try {
    const row = await db.academicSession.findFirst({ where: { id, tenantId: session.tenantId } })
    if (!row) return Errors.notFound('Academic year')
    if (row.status === 'CLOSED' || row.status === 'ARCHIVED') {
      return Errors.conflict(`Academic year already ${row.status.toLowerCase()}`)
    }

    // open-items report (visibility, not a hard block — principals decide)
    const outstandingInvoices = await db.invoice.count({
      where: { tenantId: session.tenantId, deletedAt: null, status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] } },
    })
    const unresolvedFollowUps = await db.followUp.count({
      where: { tenantId: session.tenantId, status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'WAITING'] } },
    })
    const activeStudents = await db.student.count({
      where: { tenantId: session.tenantId, status: 'ACTIVE', deletedAt: null, currentClassroom: { academicSessionId: id } },
    })

    if (!confirm) {
      return ok({
        requiresConfirmation: true,
        report: { outstandingInvoices, unresolvedFollowUps, activeStudents },
        message: 'Review open items and re-send with confirm:true to close the year.',
      })
    }

    const updated = await db.$transaction(async (tx) => {
      const s = await tx.academicSession.update({ where: { id }, data: { status: 'CLOSING' } })
      const done = await tx.academicSession.update({
        where: { id },
        data: { status: 'CLOSED', isCurrent: false },
      })
      void s
      return done
    })

    await emit({ type: 'AcademicYearClosed', tenantId: session.tenantId, sessionId: id, name: updated.name })

    await audit({
      tenantId: session.tenantId, actorId: session.uid, actorName: session.name,
      action: 'CLOSE', entity: 'AcademicSession', entityId: id,
      summary: `Academic year ${updated.name} closed — ${activeStudents} students, ${outstandingInvoices} outstanding invoices, ${unresolvedFollowUps} unresolved follow-ups at close`,
    })

    return ok({
      id: updated.id, name: updated.name, status: updated.status, isCurrent: updated.isCurrent,
      report: { outstandingInvoices, unresolvedFollowUps, activeStudents },
    })
  } catch (e) {
    return Errors.system(e)
  }
}

export const POST = withApi(_POST)
