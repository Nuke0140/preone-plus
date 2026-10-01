import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, bad, notFound, forbidden, serverError } from '@/lib/api'
import { requireApi, isResponse, requireCanManageUser } from '@/lib/auth-api'
import { recordAudit, getRequestMeta } from '@/lib/audit'
import bcrypt from 'bcryptjs'
import { SessionService } from '@/lib/users/session-service'
import { PermissionCache } from '@/lib/cache/permission-cache'
import { getPasswordPolicy } from '@/lib/config'

/**
 * POST /api/v1/users/[id]/reset-password — Admin-initiated password reset (UAM)
 * Generates a secure temporary password satisfying the tenant's password policy,
 * rotates the hash, revokes every active session, and returns the temp password
 * exactly once to the authorized administrator.
 */
async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireApi(req, 'users:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return bad('Tenant required', 'TENANT_REQUIRED')

  const manageCheck = await requireCanManageUser(session, id)
  if (isResponse(manageCheck)) return manageCheck
  const { targetMember: member } = manageCheck

  try {
    if (member.role === 'OWNER' && session.role !== 'OWNER' && session.role !== 'PLATFORM_ADMIN') {
      return forbidden('Only owners can reset the password of a school owner')
    }

    // Generate a strong temporary password that always satisfies the tenant policy
    const policy = await getPasswordPolicy(session.tenantId)
    const minLen = Math.max(policy.passwordMinLength, 10)
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    const lower = 'abcdefghijkmnpqrstuvwxyz'
    const digits = '23456789'
    const symbols = '@#$%&'

    const pick = (set: string) => set[Math.floor(Math.random() * set.length)]
    const core = [pick(alphabet), pick(lower), pick(digits), pick(symbols)]
    while (core.length < minLen - 2) {
      const all = alphabet + lower + digits
      core.push(pick(all))
    }
    // Fisher-Yates shuffle for unpredictability
    for (let i = core.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[core[i], core[j]] = [core[j], core[i]]
    }
    const tempPassword = `Pre${core.join('')}!1`

    const newHash = await bcrypt.hash(tempPassword, 10)

    // Rotate hash + revoke every active session + bump permission version
    const revokedCount = await SessionService.revokeAllUserSessions(member.userId)
    await db.user.update({
      where: { id: member.userId },
      data: { passwordHash: newHash, updatedAt: new Date() },
    })
    PermissionCache.bumpUserVersion(member.userId)

    const meta = getRequestMeta(req)
    await recordAudit({
      tenantId: session.tenantId,
      branchId: member.branchId || undefined,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
      action: 'ADMIN_PASSWORD_RESET',
      entity: 'User',
      entityId: member.userId,
      module: 'USERS',
      severity: 'WARNING',
      summary: `Admin reset password for ${member.user.fullName} (${member.user.email}); ${revokedCount} session(s) revoked`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    })

    return ok({
      success: true,
      userId: member.userId,
      email: member.user.email,
      tempPassword,
      revokedSessions: revokedCount,
      message: `Temporary password generated for ${member.user.fullName}. Share it securely — it will not be shown again.`,
    })
  } catch (err: any) {
    return serverError(err.message)
  }
}

export const POST = withApi(_POST)
