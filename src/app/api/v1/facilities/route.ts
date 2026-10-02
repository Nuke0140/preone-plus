import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { audit } from '@/lib/sequence'
import type { FacilityType } from '@prisma/client'

const FACILITY_TYPES: FacilityType[] = [
  'CLASSROOM', 'ACTIVITY_AREA', 'PLAY_AREA', 'NAP_AREA', 'MEAL_AREA', 'WASHROOM', 'MEDICAL', 'OTHER',
]

/** GET /api/v1/facilities — infrastructure tree below branches */
async function _GET(req: NextRequest) {
  const session = await requireApi(req)
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const facilities = await db.facility.findMany({
      where: { tenantId: session.tenantId, deletedAt: null },
      include: {
        branch: { select: { name: true, code: true } },
        _count: { select: { classrooms: true } },
      },
      orderBy: [{ branchId: 'asc' }, { type: 'asc' }],
    })
    return ok(facilities.map((f) => ({
      id: f.id, branchId: f.branchId, branchName: f.branch.name,
      type: f.type, name: f.name, code: f.code, capacity: f.capacity,
      floorOrArea: f.floorOrArea, ageSuitability: f.ageSuitability,
      isActive: f.isActive, classrooms: f._count.classrooms,
    })))
  } catch (e) {
    return Errors.system(e)
  }
}

/** POST /api/v1/facilities — register facility under a branch (M00 Step 5) */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { branchId, type, name, code, capacity, floorOrArea, ageSuitability } = body
    if (!branchId || !type || !name || !code) return Errors.validation('branchId, type, name and code are required')
    if (!FACILITY_TYPES.includes(type)) {
      return Errors.validation(`type must be one of: ${FACILITY_TYPES.join(', ')}`)
    }
    const branch = await db.branch.findFirst({ where: { id: branchId, tenantId: session.tenantId, deletedAt: null } })
    if (!branch) return Errors.notFound('Branch')
    const dup = await db.facility.findFirst({ where: { tenantId: session.tenantId, code: String(code).toUpperCase(), deletedAt: null } })
    if (dup) return Errors.conflict(`Facility code "${code}" already exists`)

    const facility = await db.facility.create({
      data: {
        tenantId: session.tenantId, branchId, type, name,
        code: String(code).toUpperCase(),
        capacity: capacity ? Number(capacity) : null,
        floorOrArea: floorOrArea || null, ageSuitability: ageSuitability || null,
      },
    })
    await audit({
      tenantId: session.tenantId, actorId: session.uid, actorName: session.name,
      action: 'CREATE', entity: 'Facility', entityId: facility.id,
      summary: `Registered ${type} "${facility.name}" under branch ${branch.name}`,
    })
    return ok({ id: facility.id, name: facility.name, code: facility.code }, undefined, 201)
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
