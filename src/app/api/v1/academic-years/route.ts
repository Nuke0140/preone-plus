import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { audit } from '@/lib/sequence'

/** GET /api/v1/academic-years — academic sessions (years) */
async function _GET(req: NextRequest) {
  const session = await requireApi(req)
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const sessions = await db.academicSession.findMany({
      where: { tenantId: session.tenantId },
      include: { _count: { select: { classrooms: true, calendarEvents: true } } },
      orderBy: { startDate: 'desc' },
    })
    return ok(sessions.map((s) => ({
      id: s.id, name: s.name, startDate: s.startDate, endDate: s.endDate,
      status: s.status, isCurrent: s.isCurrent,
      classrooms: s._count.classrooms, calendarEvents: s._count.calendarEvents,
    })))
  } catch (e) {
    return Errors.system(e)
  }
}

/** POST /api/v1/academic-years — create academic year (M00 Step 9) */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { name, startDate, endDate, terms } = body
    if (!name || !startDate || !endDate) return Errors.validation('name, startDate and endDate are required')
    const start = new Date(startDate); const end = new Date(endDate)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return Errors.validation('Invalid dates')
    if (start >= end) return Errors.business('SETUP_003', 'Academic year end date must be after start date', 422)
    const dup = await db.academicSession.findFirst({ where: { tenantId: session.tenantId, name } })
    if (dup) return Errors.conflict(`Academic year "${name}" already exists`)

    const count = await db.academicSession.count({ where: { tenantId: session.tenantId } })
    const created = await db.academicSession.create({
      data: {
        tenantId: session.tenantId, name, startDate: start, endDate: end,
        status: 'PLANNED', isCurrent: count === 0, // first year automatically current
      },
    })
    // terms are advisory metadata stored with the operating config
    if (Array.isArray(terms) && terms.length > 0) {
      const existing = await db.schoolConfig.findUnique({
        where: { tenantId_domain: { tenantId: session.tenantId, domain: 'OPERATING' } },
      })
      const data = { ...(existing?.data as Record<string, unknown> ?? {}), terms }
      await db.schoolConfig.upsert({
        where: { tenantId_domain: { tenantId: session.tenantId, domain: 'OPERATING' } },
        create: { tenantId: session.tenantId, domain: 'OPERATING', data, updatedById: session.uid, updatedByName: session.name },
        update: { data, updatedById: session.uid, updatedByName: session.name },
      })
    }
    await audit({
      tenantId: session.tenantId, actorId: session.uid, actorName: session.name,
      action: 'CREATE', entity: 'AcademicSession', entityId: created.id,
      summary: `Created academic year ${created.name} (${startDate} → ${endDate})${count === 0 ? ' — set as current' : ''}`,
    })
    return ok({ id: created.id, name: created.name, isCurrent: created.isCurrent }, undefined, 201)
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
