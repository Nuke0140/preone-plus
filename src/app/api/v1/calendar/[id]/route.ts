import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { audit } from '@/lib/sequence'

/** DELETE /api/v1/calendar/{id} — remove a calendar entry */
async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params

  try {
    const event = await db.calendarEvent.findFirst({ where: { id, tenantId: session.tenantId } })
    if (!event) return Errors.notFound('Calendar event')
    await db.calendarEvent.delete({ where: { id } })
    await audit({
      tenantId: session.tenantId, actorId: session.uid, actorName: session.name,
      action: 'DELETE', entity: 'CalendarEvent', entityId: id,
      summary: `Removed ${event.type} "${event.title}" from school calendar`,
    })
    return ok({ id })
  } catch (e) {
    return Errors.system(e)
  }
}

export const DELETE = withApi(_DELETE)
