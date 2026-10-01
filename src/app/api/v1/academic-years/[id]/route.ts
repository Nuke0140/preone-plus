import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { audit } from '@/lib/sequence'

/** PATCH /api/v1/academic-years/{id} — update / set current / close year */
async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params

  try {
    const row = await db.academicSession.findFirst({ where: { id, tenantId: session.tenantId } })
    if (!row) return Errors.notFound('Academic year')
    const body = await req.json()
    const { setStatusCurrent, status, name, startDate, endDate } = body

    if (setStatusCurrent === true) {
      await db.$transaction([
        db.academicSession.updateMany({ where: { tenantId: session.tenantId, isCurrent: true }, data: { isCurrent: false } }),
        db.academicSession.update({ where: { id }, data: { isCurrent: true, status: 'ACTIVE' } }),
      ])
      await audit({
        tenantId: session.tenantId, actorId: session.uid, actorName: session.name,
        action: 'UPDATE', entity: 'AcademicSession', entityId: id,
        summary: `Academic year ${row.name} set as the current operating year`,
      })
      return ok({ id, isCurrent: true })
    }

    const data: Record<string, unknown> = {}
    if (name) data.name = name
    if (status) data.status = status
    if (startDate) data.startDate = new Date(startDate)
    if (endDate) data.endDate = new Date(endDate)
    if (Object.keys(data).length === 0) return Errors.validation('Nothing to update (use setStatusCurrent:true to switch year)')

    const updated = await db.academicSession.update({ where: { id }, data })
    await audit({
      tenantId: session.tenantId, actorId: session.uid, actorName: session.name,
      action: 'UPDATE', entity: 'AcademicSession', entityId: id,
      summary: `Updated academic year ${updated.name}: ${Object.keys(data).join(', ')}`,
    })
    return ok({ id: updated.id, name: updated.name, status: updated.status })
  } catch (e) {
    return Errors.system(e)
  }
}

export const PATCH = withApi(_PATCH)
