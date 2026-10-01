import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { audit } from '@/lib/sequence'

/** GET /api/v1/branches — list branches for tenant */
async function _GET(req: NextRequest) {
  const session = await requireApi(req)
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const branches = await db.branch.findMany({
      where: { tenantId: session.tenantId, deletedAt: null },
      include: { _count: { select: { staffProfiles: true, facilities: true, calendarEvents: true } } },
      orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
    })
    return ok(branches.map((b) => ({
      id: b.id, name: b.name, code: b.code, address: b.address, city: b.city,
      state: b.state, pincode: b.pincode, phone: b.phone, email: b.email,
      timingOpen: b.timingOpen, timingClose: b.timingClose, capacity: b.capacity,
      isMain: b.isMain, isActive: b.isActive,
      facilities: b._count.facilities, staff: b._count.staffProfiles,
    })))
  } catch (e) {
    return Errors.system(e)
  }
}

/** POST /api/v1/branches — create branch (M00 Step 3) */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { name, code, address, city, state, pincode, phone, email, timingOpen, timingClose, capacity } = body
    if (!name || !code) return Errors.validation('name and code are required')
    const dup = await db.branch.findFirst({ where: { tenantId: session.tenantId, code: String(code).toUpperCase(), deletedAt: null } })
    if (dup) return Errors.conflict(`Branch code "${code}" already exists`)

    const branch = await db.branch.create({
      data: {
        tenantId: session.tenantId,
        name, code: String(code).toUpperCase(),
        address: address || null, city: city || null, state: state || null, pincode: pincode || null,
        phone: phone || null, email: email || null,
        timingOpen: timingOpen || '08:30', timingClose: timingClose || '16:00',
        capacity: capacity ? Number(capacity) : null,
      },
    })
    await audit({
      tenantId: session.tenantId, actorId: session.uid, actorName: session.name,
      action: 'CREATE', entity: 'Branch', entityId: branch.id,
      summary: `Created branch ${branch.name} (${branch.code})`,
    })
    return ok({ id: branch.id, name: branch.name, code: branch.code }, undefined, 201)
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
