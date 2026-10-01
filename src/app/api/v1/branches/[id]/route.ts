import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { audit } from '@/lib/sequence'

/** PATCH /api/v1/branches/{id} — update branch (timings, contact, capacity, active) */
async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params

  try {
    const branch = await db.branch.findFirst({ where: { id, tenantId: session.tenantId, deletedAt: null } })
    if (!branch) return Errors.notFound('Branch')
    const body = await req.json()
    const allowed = ['name', 'address', 'city', 'state', 'pincode', 'phone', 'email', 'timingOpen', 'timingClose', 'capacity', 'isActive'] as const
    const data: Record<string, unknown> = {}
    for (const k of allowed) if (k in body) data[k] = body[k]
    if (Object.keys(data).length === 0) return Errors.validation('No editable fields provided')

    const updated = await db.branch.update({ where: { id }, data })
    await audit({
      tenantId: session.tenantId, actorId: session.uid, actorName: session.name,
      action: 'UPDATE', entity: 'Branch', entityId: id,
      summary: `Updated branch ${updated.name}: ${Object.keys(data).join(', ')}`,
    })
    return ok({ id: updated.id, name: updated.name, code: updated.code, isActive: updated.isActive })
  } catch (e) {
    return Errors.system(e)
  }
}

export const PATCH = withApi(_PATCH)
