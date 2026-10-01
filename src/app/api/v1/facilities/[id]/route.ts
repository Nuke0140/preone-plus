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

/** PATCH /api/v1/facilities/{id} — update facility/area */
async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params

  try {
    const facility = await db.facility.findFirst({ where: { id, tenantId: session.tenantId, deletedAt: null } })
    if (!facility) return Errors.notFound('Facility')

    const body = await req.json()
    const allowed = ['name', 'type', 'capacity', 'floorOrArea', 'ageSuitability', 'isActive'] as const
    const data: Record<string, unknown> = {}
    for (const k of allowed) {
      if (k in body) {
        if (k === 'type' && !FACILITY_TYPES.includes(body[k])) {
          return Errors.validation('Invalid facility type')
        }
        if (k === 'capacity') {
          data[k] = body[k] ? Number(body[k]) : null
        } else {
          data[k] = body[k]
        }
      }
    }
    if (Object.keys(data).length === 0) return Errors.validation('No editable fields provided')

    const updated = await db.facility.update({ where: { id }, data })
    await audit({
      tenantId: session.tenantId, actorId: session.uid, actorName: session.name,
      action: 'UPDATE', entity: 'Facility', entityId: id,
      summary: `Updated facility ${updated.name}: ${Object.keys(data).join(', ')}`,
    })
    return ok({ id: updated.id, name: updated.name, type: updated.type, capacity: updated.capacity })
  } catch (e) {
    return Errors.system(e)
  }
}

export const PATCH = withApi(_PATCH)
