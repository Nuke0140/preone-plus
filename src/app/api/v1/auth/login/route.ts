import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { withApi } from '@/lib/with-api'
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE, Role } from '@/lib/auth'
import { normalizeRole } from '@/lib/roles'
import { audit, getRequestMeta } from '@/lib/audit'
import { SessionService } from '@/lib/users/session-service'

// Sliding window tracker for consecutive failed login attempts
const failedAttemptsTracker = new Map<string, { count: number; lastAttempt: number }>()
const MAX_CONSECUTIVE_FAILURES = 5
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

export const POST = withApi(
  async (req: NextRequest) => {
    try {
      const meta = getRequestMeta(req)
      const body = await req.json().catch(() => null)
      const {
        identifier,
        email,
        username,
        password,
      } = (body || {}) as {
        identifier?: string
        email?: string
        username?: string
        password?: string
      }

      const loginId = (identifier || email || username || '').toLowerCase().trim()
      if (!loginId || !password) {
        return Errors.validation('Username or email and password are required')
      }

      // Check current failure count
      const trackerKey = loginId
      const tracker = failedAttemptsTracker.get(trackerKey)
      const now = Date.now()
      const currentFailures =
        tracker && now - tracker.lastAttempt < ATTEMPT_WINDOW_MS ? tracker.count : 0

      // Find user by either email or username (UAM-E7, UAM-E13)
      const user = await db.user.findFirst({
        where: {
          OR: [{ email: loginId }, { username: loginId }],
        },
        include: {
          memberships: {
            include: { tenant: true },
            where: { deletedAt: null },
          },
        },
      })

      if (!user || user.deletedAt) {
        await audit({
          tenantId: null,
          actorName: loginId,
          action: 'LOGIN_FAILED',
          entity: 'User',
          module: 'AUTH',
          summary: `Failed login attempt for ${loginId} (user not found)`,
          severity: 'WARNING',
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          requestId: meta.requestId,
        })
        return Errors.business('AUTH_003', 'Invalid credentials', 401)
      }

      // Check account status
      if (user.status === 'LOCKED') {
        return Errors.business(
          'ACCOUNT_LOCKED',
          'Account is locked due to security policy. Please contact an administrator.',
          423
        )
      }

      if (user.status === 'SUSPENDED') {
        return Errors.business('ACCOUNT_SUSPENDED', 'Your account has been suspended.', 403)
      }

      if (user.status === 'DEACTIVATED' || (user.status as string) === 'INACTIVE') {
        return Errors.business('ACCOUNT_DEACTIVATED', 'Your account has been deactivated.', 403)
      }

      if (user.status === 'ARCHIVED') {
        return Errors.business('ACCOUNT_ARCHIVED', 'Your account has been archived.', 403)
      }

      const valid = await bcrypt.compare(password, user.passwordHash)
      if (!valid) {
        const nextFailures = currentFailures + 1
        failedAttemptsTracker.set(trackerKey, { count: nextFailures, lastAttempt: now })

        // Check auto-lock threshold
        if (nextFailures >= MAX_CONSECUTIVE_FAILURES) {
          await db.user.update({
            where: { id: user.id },
            data: { status: 'LOCKED', updatedAt: new Date() },
          })
          await SessionService.revokeAllUserSessions(user.id)

          await audit({
            tenantId: user.memberships[0]?.tenantId ?? null,
            actorId: user.id,
            actorName: user.fullName,
            action: 'ACCOUNT_LOCKED',
            entity: 'User',
            entityId: user.id,
            module: 'AUTH',
            summary: `User ${user.fullName} locked after ${nextFailures} failed login attempts`,
            severity: 'CRITICAL',
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
            requestId: meta.requestId,
            newValues: { status: 'LOCKED', consecutiveFailures: nextFailures },
          })

          return Errors.business(
            'ACCOUNT_LOCKED',
            'Account has been locked after 5 consecutive failed login attempts. Contact an administrator to unlock.',
            423
          )
        }

        await audit({
          tenantId: user.memberships[0]?.tenantId ?? null,
          actorId: user.id,
          actorName: user.fullName,
          action: 'LOGIN_FAILED',
          entity: 'User',
          entityId: user.id,
          module: 'AUTH',
          summary: `Failed login attempt for ${loginId} (invalid password - attempt ${nextFailures}/${MAX_CONSECUTIVE_FAILURES})`,
          severity: 'WARNING',
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          requestId: meta.requestId,
          newValues: { consecutiveFailures: nextFailures },
        })

        return Errors.business('AUTH_003', 'Invalid credentials', 401)
      }

      // Successful login -> clear failure tracker
      failedAttemptsTracker.delete(trackerKey)

      const membership = user.memberships[0]

      if (membership) {
        if (membership.status === 'SUSPENDED') {
          return Errors.business('ACCOUNT_SUSPENDED', 'Your account has been suspended.', 403)
        }
        if (membership.status === 'DEACTIVATED' || (membership.status as string) === 'INACTIVE') {
          return Errors.business('ACCOUNT_DEACTIVATED', 'Your account has been deactivated.', 403)
        }
        if (membership.status === 'ARCHIVED') {
          return Errors.business('ACCOUNT_ARCHIVED', 'Your account has been archived.', 403)
        }
        if (membership.status === 'LOCKED') {
          return Errors.business(
            'ACCOUNT_LOCKED',
            'Account is locked due to security policy. Please contact an administrator.',
            423
          )
        }
      }

      // No school membership -> platform-level staff (client onboarding console)
      if (!membership) {
        const token = await signSession({
          uid: user.id,
          email: user.email || '',
          name: user.fullName,
          tenantId: null,
          branchId: null,
          role: 'PLATFORM_ADMIN',
        })
        await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

        // Register session in user_sessions table
        await SessionService.createSession({
          userId: user.id,
          tenantId: null,
          token,
          req,
        })

        await audit({
          tenantId: null,
          actorId: user.id,
          actorName: user.fullName,
          actorRole: 'PLATFORM_ADMIN',
          action: 'LOGIN',
          entity: 'User',
          entityId: user.id,
          module: 'AUTH',
          summary: `${user.fullName} signed into Platform Console`,
          severity: 'INFO',
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          requestId: meta.requestId,
        })

        const res = ok({
          user: {
            id: user.id,
            name: user.fullName,
            email: user.email,
            username: user.username,
            role: 'PLATFORM_ADMIN',
            tenant: null,
            branch: null,
          },
        })
        res.cookies.set(SESSION_COOKIE, token, {
          httpOnly: true,
          sameSite: 'lax',
          maxAge: SESSION_MAX_AGE,
          path: '/',
        })
        return res
      }

      const branch = membership.branchId
        ? await db.branch.findUnique({ where: { id: membership.branchId } })
        : await db.branch.findFirst({ where: { tenantId: membership.tenantId, isMain: true } })

      const primaryRole = normalizeRole(membership.role)
      const allRoles: string[] = [primaryRole]
      if (Array.isArray(membership.roles)) {
        allRoles.push(...membership.roles)
      }
      const effectiveRoles = Array.from(new Set(allRoles.map((r) => normalizeRole(r)))) as Role[]

      const token = await signSession({
        uid: user.id,
        email: user.email || '',
        name: user.fullName,
        tenantId: membership.tenantId,
        branchId: branch?.id ?? null,
        role: primaryRole,
        roles: effectiveRoles,
      })

      await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

      // Register session in user_sessions table
      await SessionService.createSession({
        userId: user.id,
        tenantId: membership.tenantId,
        token,
        req,
      })

      await audit({
        tenantId: membership.tenantId,
        branchId: branch?.id ?? null,
        actorId: user.id,
        actorName: user.fullName,
        actorRole: primaryRole,
        action: 'LOGIN',
        entity: 'User',
        entityId: user.id,
        module: 'AUTH',
        summary: `${user.fullName} signed in (${effectiveRoles.join(', ')})`,
        severity: 'INFO',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      })

      const res = ok({
        user: {
          id: user.id,
          name: user.fullName,
          email: user.email,
          username: user.username,
          role: primaryRole,
          roles: effectiveRoles,
          tenant: { id: membership.tenantId, name: membership.tenant.name },
          branch: branch ? { id: branch.id, name: branch.name } : null,
        },
      })

      res.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: SESSION_MAX_AGE,
        path: '/',
      })
      return res
    } catch (e) {
      return Errors.system(e)
    }
  },
  { module: 'auth' }
)
