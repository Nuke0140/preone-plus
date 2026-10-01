import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { UserRole, UserStatus } from '@prisma/client'
import { UsernameService, UsernameType } from './username-service'

export interface BaseIdentityOptions {
  fullName: string
  email?: string | null
  phone?: string | null
  username?: string
  password?: string
  status?: UserStatus
  usernameType: UsernameType
  avatarUrl?: string | null
}

export interface TenantMembershipOptions {
  tenantId: string
  userId: string
  role: UserRole
  roles: UserRole[]
  branchId?: string | null
  status: UserStatus
}

export class UserIdentityService {
  /**
   * Normalizes an email address.
   */
  static normalizeEmail(email: string): string {
    return email.toLowerCase().trim()
  }

  /**
   * Normalizes a phone number string.
   */
  static normalizePhone(phone?: string | null): string | null {
    if (!phone) return null
    const cleaned = phone.trim().replace(/[^\d+]/g, '')
    return cleaned || null
  }

  /**
   * Hashes a plaintext password using bcrypt with 10 salt rounds.
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10)
  }

  /**
   * Resolves or creates a base User identity record.
   * Runs within an existing Prisma transaction client or standalone db.
   */
  static async resolveOrCreateUser(
    tx: Prisma.TransactionClient,
    opts: BaseIdentityOptions
  ): Promise<{ user: any; isNewUser: boolean }> {
    const emailNorm = opts.email && opts.email.trim() ? this.normalizeEmail(opts.email) : null
    const phoneNorm = this.normalizePhone(opts.phone)
    const initialStatus: UserStatus = opts.status || 'ACTIVE'

    let user: any = null
    if (emailNorm) {
      user = await tx.user.findUnique({
        where: { email: emailNorm },
      })
    }
    if (!user && opts.username?.trim()) {
      user = await tx.user.findUnique({
        where: { username: opts.username.trim().toLowerCase() },
      })
    }
    if (!user && phoneNorm) {
      user = await tx.user.findFirst({
        where: { phone: phoneNorm },
      })
    }
    if (!user && opts.username?.trim()) {
      user = await tx.user.findUnique({
        where: { username: opts.username.trim().toLowerCase() },
      })
    }

    // Determine unique username
    let username = opts.username?.trim().toLowerCase()
    if (user && user.username) {
      username = user.username
    } else if (!username) {
      username = await UsernameService.generateUniqueUsername({
        name: opts.fullName,
        type: opts.usernameType,
      })
    } else {
      // Validate provided username
      const available = await UsernameService.isUsernameAvailable(username, opts.usernameType)
      if (!available) {
        username = await UsernameService.generateUniqueUsername({
          name: opts.fullName,
          type: opts.usernameType,
          preferred: username,
        })
      }
    }

    // Determine password hash
    const rawPassword = opts.password || `PreOne@${Math.random().toString(36).slice(-8)}`
    const passwordHash = await this.hashPassword(rawPassword)

    if (!user) {
      user = await tx.user.create({
        data: {
          email: emailNorm,
          username,
          phone: phoneNorm,
          fullName: opts.fullName.trim(),
          avatarUrl: opts.avatarUrl?.trim() || null,
          passwordHash,
          status: initialStatus,
        },
      })
      return { user, isNewUser: true }
    } else {
      // Update phone if previously unset
      const needsPhoneUpdate = !user.phone && phoneNorm
      const needsUsernameUpdate = !user.username && username
      const needsAvatarUpdate = !user.avatarUrl && opts.avatarUrl?.trim()

      if (needsPhoneUpdate || needsUsernameUpdate || needsAvatarUpdate) {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            ...(needsPhoneUpdate ? { phone: phoneNorm } : {}),
            ...(needsUsernameUpdate ? { username } : {}),
            ...(needsAvatarUpdate ? { avatarUrl: opts.avatarUrl!.trim() } : {}),
          },
        })
      }

      return { user, isNewUser: false }
    }
  }

  /**
   * Creates or activates a TenantUser membership record.
   */
  static async createOrUpdateMembership(
    tx: Prisma.TransactionClient,
    opts: TenantMembershipOptions
  ): Promise<any> {
    const existingMembership = await tx.tenantUser.findFirst({
      where: {
        tenantId: opts.tenantId,
        userId: opts.userId,
        deletedAt: null,
      },
    })

    if (existingMembership) {
      // Merge roles if membership exists
      const mergedRoles = [...new Set([...existingMembership.roles, ...opts.roles])]
      return tx.tenantUser.update({
        where: { id: existingMembership.id },
        data: {
          role: opts.role,
          roles: mergedRoles,
          status: opts.status,
          ...(opts.branchId !== undefined ? { branchId: opts.branchId } : {}),
        },
      })
    }

    return tx.tenantUser.create({
      data: {
        tenantId: opts.tenantId,
        userId: opts.userId,
        role: opts.role,
        roles: opts.roles,
        branchId: opts.branchId || null,
        status: opts.status,
      },
    })
  }
}
