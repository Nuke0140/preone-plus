import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, bad, errValidation, errAuth } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { recordAudit, getRequestMeta } from '@/lib/audit'
import { CANONICAL_ROLES } from '@/lib/roles'

/**
 * GET /api/v1/users/custom-roles — list school-defined custom roles (permission sets)
 */
export const GET = withApi(async (req: NextRequest) => {
  const session = await requireApi(req, 'users:read')
  if (isResponse(session)) return session
  if (!session.tenantId) throw errAuth('Tenant required')

  const roles = await db.customRole.findMany({
    where: { tenantId: session.tenantId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  })

  return ok({ customRoles: roles, total: roles.length })
}, { module: 'users', permission: 'users:read' })

/**
 * POST /api/v1/users/custom-roles — create a custom role (permission set)
 * Body: { name, description?, permissions: string[], baseRole?: UserRole }
 */
export const POST = withApi(async (req: NextRequest) => {
  const session = await requireApi(req, 'users:write')
  if (isResponse(session)) return session
  if (!session.tenantId) throw errAuth('Tenant required')

  const body = (await req.json()) as {
    name?: string
    description?: string
    permissions?: string[]
    baseRole?: string
  }

  const name = body.name?.trim()
  if (!name || name.length < 2 || name.length > 60) {
    throw errValidation('Role name must be between 2 and 60 characters', 'name')
  }

  const permissions = Array.isArray(body.permissions)
    ? Array.from(new Set(body.permissions.map((p) => String(p).trim()).filter(Boolean)))
    : []
  if (permissions.length === 0) {
    throw errValidation('Select at least one permission for the custom role', 'permissions')
  }

  if (body.baseRole && !CANONICAL_ROLES.includes(body.baseRole as (typeof CANONICAL_ROLES)[number])) {
    throw errValidation('baseRole must be a canonical role', 'baseRole')
  }

  const existing = await db.customRole.findFirst({
    where: { tenantId: session.tenantId, name, deletedAt: null },
  })
  if (existing) {
    return bad(`A custom role named "${name}" already exists`, 'CUSTOM_ROLE_EXISTS')
  }

  const created = await db.customRole.create({
    data: {
      tenantId: session.tenantId,
      name,
      description: body.description?.trim() || null,
      permissions,
      baseRole: (body.baseRole as any) || null,
      createdById: session.uid,
      createdByName: session.name,
    },
  })

  const meta = getRequestMeta(req)
  await recordAudit({
    tenantId: session.tenantId,
    actorId: session.uid,
    actorName: session.name,
    actorRole: session.role,
    action: 'CREATE_CUSTOM_ROLE',
    entity: 'CustomRole',
    entityId: created.id,
    module: 'Users',
    severity: 'INFO',
    summary: `Created custom role "${name}" with ${permissions.length} permission(s)`,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    newValues: { name, permissions, baseRole: body.baseRole || null },
  })

  return ok({ customRole: created, success: true })
}, { module: 'users', permission: 'users:write' })
