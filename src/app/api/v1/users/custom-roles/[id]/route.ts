import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, bad, notFound, errValidation, errAuth } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { recordAudit, getRequestMeta } from '@/lib/audit'
import { CANONICAL_ROLES } from '@/lib/roles'

/**
 * PUT /api/v1/users/custom-roles/[id] — update a custom role (permission set)
 */
export const PUT = withApi(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const session = await requireApi(req, 'users:write')
  if (isResponse(session)) return session
  if (!session.tenantId) throw errAuth('Tenant required')

  const existing = await db.customRole.findFirst({
    where: { id, tenantId: session.tenantId, deletedAt: null },
  })
  if (!existing) return notFound('Custom role not found')

  const body = (await req.json()) as {
    name?: string
    description?: string
    permissions?: string[]
    baseRole?: string
  }

  const data: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name || name.length < 2 || name.length > 60) {
      throw errValidation('Role name must be between 2 and 60 characters', 'name')
    }
    const clash = await db.customRole.findFirst({
      where: { tenantId: session.tenantId, name, deletedAt: null, id: { not: id } },
    })
    if (clash) return bad(`A custom role named "${name}" already exists`, 'CUSTOM_ROLE_EXISTS')
    data.name = name
  }

  if (body.description !== undefined) data.description = body.description.trim() || null

  if (body.permissions !== undefined) {
    const permissions = Array.from(new Set(body.permissions.map((p) => String(p).trim()).filter(Boolean)))
    if (permissions.length === 0) {
      throw errValidation('Select at least one permission for the custom role', 'permissions')
    }
    data.permissions = permissions
  }

  if (body.baseRole !== undefined) {
    if (body.baseRole && !CANONICAL_ROLES.includes(body.baseRole as (typeof CANONICAL_ROLES)[number])) {
      throw errValidation('baseRole must be a canonical role', 'baseRole')
    }
    data.baseRole = body.baseRole || null
  }

  const updated = await db.customRole.update({ where: { id }, data })

  const meta = getRequestMeta(req)
  await recordAudit({
    tenantId: session.tenantId,
    actorId: session.uid,
    actorName: session.name,
    actorRole: session.role,
    action: 'UPDATE_CUSTOM_ROLE',
    entity: 'CustomRole',
    entityId: id,
    module: 'Users',
    severity: 'INFO',
    summary: `Updated custom role "${updated.name}"`,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    oldValues: { name: existing.name, permissions: existing.permissions },
    newValues: { name: updated.name, permissions: updated.permissions },
  })

  return ok({ customRole: updated, success: true })
}, { module: 'users', permission: 'users:write' })

/**
 * DELETE /api/v1/users/custom-roles/[id] — soft-delete a custom role
 */
export const DELETE = withApi(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const session = await requireApi(req, 'users:write')
  if (isResponse(session)) return session
  if (!session.tenantId) throw errAuth('Tenant required')

  const existing = await db.customRole.findFirst({
    where: { id, tenantId: session.tenantId, deletedAt: null },
  })
  if (!existing) return notFound('Custom role not found')

  await db.customRole.update({
    where: { id },
    data: { deletedAt: new Date() },
  })

  const meta = getRequestMeta(req)
  await recordAudit({
    tenantId: session.tenantId,
    actorId: session.uid,
    actorName: session.name,
    actorRole: session.role,
    action: 'DELETE_CUSTOM_ROLE',
    entity: 'CustomRole',
    entityId: id,
    module: 'Users',
    severity: 'WARNING',
    summary: `Deleted custom role "${existing.name}"`,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })

  return ok({ success: true })
}, { module: 'users', permission: 'users:write' })
