import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { audit } from '@/lib/sequence'

/** PATCH /api/v1/tenants/{id} — activate / suspend a tenant (platform admin) */
async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'platform:manage')
  if (isResponse(session)) return session
  const { id } = await params

  try {
    const body = await req.json()
    const { status } = body as { status?: 'ACTIVE' | 'SUSPENDED' }
    if (!status || !['ACTIVE', 'SUSPENDED'].includes(status)) {
      return Errors.validation('status must be ACTIVE or SUSPENDED')
    }
    const tenant = await db.tenant.update({ where: { id }, data: { status } })
    await audit({
      actorId: session.uid,
      actorName: session.name,
      action: 'UPDATE',
      entity: 'Tenant',
      entityId: id,
      summary: `Tenant ${tenant.name} set to ${status}`,
    })
    return ok({ id: tenant.id, status: tenant.status })
  } catch (e) {
    return Errors.system(e)
  }
}

export const PATCH = withApi(_PATCH)
