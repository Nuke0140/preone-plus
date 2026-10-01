import { NextRequest } from 'next/server'
import { withApi } from '@/lib/with-api'
import { ok, bad, forbidden, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE, Role } from '@/lib/auth'
import { normalizeRole, isCanonicalRole, CanonicalRole } from '@/lib/roles'
import { db } from '@/lib/db'
import { audit, getRequestMeta } from '@/lib/audit'
import { SessionService } from '@/lib/users/session-service'

/**
 * POST /api/v1/auth/switch-role — Multi-Role Workspace Switching (UAM-E3)
 * Switches the active operational role of the authenticated session among their assigned roles.
 */
export const POST = withApi(
  async (req: NextRequest) => {
    const session = await requireApi(req)
    if (isResponse(session)) return session

    const body = await req.json().catch(() => ({}))
    const { role: targetRoleRaw } = body as { role?: string }

    if (!targetRoleRaw) {
      return bad('Target role is required', 'ROLE_REQUIRED')
    }

    const targetRole = normalizeRole(targetRoleRaw)

    // Load active membership from database to guarantee freshest roles
    const membership = session.tenantId
      ? await db.tenantUser.findFirst({
          where: {
            userId: session.uid,
            tenantId: session.tenantId,
            deletedAt: null,
            status: 'ACTIVE',
          },
        })
      : null

    const allowedRoles: string[] = []
    if (membership) {
      allowedRoles.push(membership.role)
      if (Array.isArray(membership.roles)) {
        allowedRoles.push(...membership.roles)
      }
    }
    if (session.roles) {
      allowedRoles.push(...session.roles)
    }
    allowedRoles.push(session.role)

    const normalizedAllowed = Array.from(new Set(allowedRoles.map((r) => normalizeRole(r))))

    if (!normalizedAllowed.includes(targetRole)) {
      return forbidden(`You are not assigned the role: ${targetRole}`)
    }

    // Generate new session token with switched active role
    const newPayload = {
      uid: session.uid,
      email: session.email,
      name: session.name,
      tenantId: session.tenantId,
      branchId: session.branchId,
      role: targetRole,
      roles: normalizedAllowed as Role[],
    }

    const token = await signSession(newPayload)

    // Create session record for the new token
    await SessionService.createSession({
      userId: session.uid,
      tenantId: session.tenantId,
      token,
      req,
    })

    const meta = getRequestMeta(req)
    await audit({
      tenantId: session.tenantId,
      branchId: session.branchId,
      actorId: session.uid,
      actorName: session.name,
      actorRole: targetRole,
      action: 'SWITCH_ROLE',
      entity: 'User',
      entityId: session.uid,
      module: 'AUTH',
      summary: `${session.name} switched active role from ${session.role} to ${targetRole}`,
      severity: 'INFO',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      oldValues: { role: session.role },
      newValues: { role: targetRole },
    })

    const res = ok({
      message: `Active role switched to ${targetRole}`,
      activeRole: targetRole,
      roles: normalizedAllowed,
    })

    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    })

    return res
  },
  { module: 'auth' }
)
