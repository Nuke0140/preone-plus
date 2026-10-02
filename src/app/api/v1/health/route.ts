import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { can } from '@/lib/auth'
import { getRequestMeta } from '@/lib/audit/audit-service'
import { db } from '@/lib/db'
import { HealthService } from '@/lib/health/health-service'

/** Resolves the linked student id for PARENT/GUARDIAN roles */
async function resolveLinkedStudentId(userId: string, tenantId: string): Promise<string | null> {
  const guardian = await db.guardian.findFirst({
    where: { tenantId, userId, deletedAt: null },
    include: { studentLinks: { select: { studentId: true }, take: 1 } },
  })
  return guardian?.studentLinks?.[0]?.studentId ?? null
}

async function _GET(req: NextRequest) {
  const session = await requireApi(req)
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const effectiveRoles = session.roles && session.roles.length > 0 ? session.roles : [session.role]
  const hasFull = can(effectiveRoles, 'health:read')
  const hasLinked = can(effectiveRoles, 'health:read-linked')
  if (!hasFull && !hasLinked) {
    return Errors.forbidden('Missing permission: health:read or health:read-linked')
  }
  try {
    const { searchParams } = new URL(req.url)
    if (!hasFull) {
      // PARENT/GUARDIAN — child's health records + sick-bay visits only
      const linked = await resolveLinkedStudentId(session.uid, session.tenantId)
      if (!linked) return ok({ records: [], visits: [] })
      const [records, visits] = await Promise.all([
        HealthService.listRecords(session.tenantId, { studentId: linked }),
        HealthService.listVisits(session.tenantId, { studentId: linked }),
      ])
      return ok({ records, visits })
    }
    const stats = searchParams.get('stats') === '1'
    if (stats) return ok(await HealthService.stats(session.tenantId))
    const alerts = searchParams.get('alerts') === '1'
    if (alerts) return ok(await HealthService.alerts(session.tenantId))
    const sickBay = searchParams.get('sickBay') === '1'
    if (sickBay) {
      const visits = await HealthService.listVisits(session.tenantId, {
        studentId: searchParams.get('studentId') || undefined,
        date: searchParams.get('date') || undefined,
      })
      return ok(visits)
    }
    const records = await HealthService.listRecords(session.tenantId, {
      studentId: searchParams.get('studentId') || undefined,
      type: searchParams.get('type') || undefined,
      chronicOnly: searchParams.get('chronic') === '1',
      search: searchParams.get('search') || undefined,
    })
    return ok(records)
  } catch (err: any) {
    return bad(err.message, 'HEALTH_FETCH_FAILED')
  }
}

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'health:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const body = await req.json()
    const meta = getRequestMeta(req)
    if (body.kind === 'sick-bay') {
      const visit = await HealthService.createVisit(
        session.tenantId, body,
        { id: session.uid, name: session.name, role: session.role, ipAddress: meta.ipAddress, userAgent: meta.userAgent },
      )
      return ok(visit, undefined, 201)
    }
    const record = await HealthService.createRecord(
      session.tenantId, body,
      { id: session.uid, name: session.name, role: session.role, ipAddress: meta.ipAddress, userAgent: meta.userAgent },
    )
    return ok(record, undefined, 201)
  } catch (err: any) {
    return bad(err.message, 'HEALTH_CREATE_FAILED')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
