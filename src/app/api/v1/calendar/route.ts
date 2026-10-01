import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { audit } from '@/lib/sequence'
import type { CalendarEventType } from '@prisma/client'

const EVENT_TYPES: CalendarEventType[] = ['HOLIDAY', 'VACATION', 'EVENT', 'PARENT_MEETING', 'ASSESSMENT', 'SPECIAL_DAY']

/** GET /api/v1/calendar — school calendar entries */
async function _GET(req: NextRequest) {
  const session = await requireApi(req)
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const events = await db.calendarEvent.findMany({
      where: { tenantId: session.tenantId },
      include: { branch: { select: { name: true } } },
      orderBy: { date: 'asc' },
    })
    return ok(events.map((e) => ({
      id: e.id, date: e.date, type: e.type, title: e.title, notes: e.notes,
      branchId: e.branchId, branchName: e.branch?.name ?? null,
      academicSessionId: e.academicSessionId,
    })))
  } catch (e) {
    return Errors.system(e)
  }
}

/** POST /api/v1/calendar — add calendar event (M00 Step 12) */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { date, type, title, notes, branchId } = body
    if (!date || !type || !title) return Errors.validation('date, type and title are required')
    if (!EVENT_TYPES.includes(type)) return Errors.validation(`type must be one of: ${EVENT_TYPES.join(', ')}`)
    const d = new Date(date)
    if (isNaN(d.getTime())) return Errors.validation('Invalid date')

    const current = await db.academicSession.findFirst({ where: { tenantId: session.tenantId, isCurrent: true } })
    const event = await db.calendarEvent.create({
      data: {
        tenantId: session.tenantId,
        branchId: branchId || null,
        academicSessionId: current?.id ?? null,
        date: d, type, title, notes: notes || null,
      },
    })
    await audit({
      tenantId: session.tenantId, actorId: session.uid, actorName: session.name,
      action: 'CREATE', entity: 'CalendarEvent', entityId: event.id,
      summary: `Added ${type} "${title}" on ${date} to school calendar`,
    })
    return ok({ id: event.id, title: event.title }, undefined, 201)
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
