/**
 * PreOne — Settings Domain Service
 *
 * Central configuration & administration service operating as a control layer
 * over authoritative entities (Tenant, Branch, AcademicSession, Program, Classroom,
 * SchoolConfig, DocumentTemplate, User, TenantUser, AuditLog).
 *
 * ZERO DUPLICATE ENTITIES / TABLES:
 * Delegates to canonical tables and domains. Never creates duplicate stores.
 */

import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { ROLE_PERMISSIONS, Role } from '@/lib/auth'
import { CANONICAL_ROLES } from '@/lib/roles'
import bcrypt from 'bcryptjs'
import type { ConfigDomain } from '@prisma/client'
import { getDomainConfig } from '@/lib/config'

export interface ScopeActor {
  id: string
  name: string
  role: string
  ipAddress?: string
  userAgent?: string
}

export class SettingsService {
  /**
   * Aggregates complete effective settings for a tenant
   */
  static async getEffectiveSettings(tenantId: string) {
    const [
      tenant,
      operating,
      admission,
      studentParent,
      finance,
      dailyOps,
      healthSafety,
      communication,
      curriculum,
      branding,
      branchesCount,
      academicSessionsCount,
      programsCount,
      classroomsCount,
    ] = await Promise.all([
      db.tenant.findUnique({ where: { id: tenantId } }),
      getDomainConfig(tenantId, 'OPERATING'),
      getDomainConfig(tenantId, 'ADMISSION'),
      getDomainConfig(tenantId, 'STUDENT_PARENT'),
      getDomainConfig(tenantId, 'FINANCE'),
      getDomainConfig(tenantId, 'DAILY_OPERATIONS'),
      getDomainConfig(tenantId, 'HEALTH_SAFETY'),
      getDomainConfig(tenantId, 'COMMUNICATION'),
      getDomainConfig(tenantId, 'CURRICULUM'),
      getDomainConfig(tenantId, 'BRANDING'),
      db.branch.count({ where: { tenantId, deletedAt: null } }),
      db.academicSession.count({ where: { tenantId } }),
      db.program.count({ where: { tenantId, deletedAt: null } }),
      db.classroom.count({ where: { tenantId } }),
    ])

    if (!tenant) throw new Error('Tenant not found')

    return {
      schoolProfile: {
        id: tenant.id,
        name: tenant.name,
        code: tenant.code,
        email: tenant.email,
        phone: tenant.phone,
        website: tenant.website,
        address: tenant.address,
        city: tenant.city,
        state: tenant.state,
        pincode: tenant.pincode,
        gstNumber: tenant.gstNumber,
        panNumber: tenant.panNumber,
        logoUrl: tenant.logoUrl,
        timezone: tenant.timezone,
        locale: tenant.locale,
        academicYearStartMonth: tenant.academicYearStartMonth,
        status: tenant.status,
        subscriptionPlan: tenant.subscriptionPlan,
        counts: {
          branches: branchesCount,
          academicSessions: academicSessionsCount,
          programs: programsCount,
          classrooms: classroomsCount,
        },
      },
      domains: {
        OPERATING: operating,
        ADMISSION: admission,
        STUDENT_PARENT: studentParent,
        FINANCE: finance,
        DAILY_OPERATIONS: dailyOps,
        HEALTH_SAFETY: healthSafety,
        COMMUNICATION: communication,
        CURRICULUM: curriculum,
        BRANDING: branding,
      },
    }
  }

  /**
   * Updates a canonical SchoolConfig domain with audit logging
   */
  static async updateDomainConfig(
    tenantId: string,
    domain: ConfigDomain,
    data: Record<string, any>,
    actor?: ScopeActor
  ) {
    const before = await db.schoolConfig.findUnique({
      where: { tenantId_domain: { tenantId, domain } },
    })

    const updated = await db.schoolConfig.upsert({
      where: { tenantId_domain: { tenantId, domain } },
      create: {
        tenantId,
        domain,
        data,
        updatedById: actor?.id,
        updatedByName: actor?.name,
      },
      update: {
        data,
        updatedById: actor?.id,
        updatedByName: actor?.name,
      },
    })

    await recordAudit({
      tenantId,
      actorId: actor?.id,
      actorName: actor?.name,
      actorRole: actor?.role,
      action: 'UPDATE_CONFIG_DOMAIN',
      entity: 'SchoolConfig',
      entityId: `${tenantId}:${domain}`,
      module: 'Settings',
      summary: `Updated configuration for domain ${domain}`,
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
      oldValues: before?.data,
      newValues: data,
    })

    return updated
  }

  /**
   * Updates Tenant School Profile & Regional Settings
   */
  static async updateSchoolProfile(
    tenantId: string,
    data: {
      name?: string
      email?: string
      phone?: string
      website?: string
      address?: string
      city?: string
      state?: string
      pincode?: string
      timezone?: string
      locale?: string
      logoUrl?: string
      academicYearStartMonth?: number
      gstNumber?: string
      panNumber?: string
    },
    actor?: ScopeActor
  ) {
    const existing = await db.tenant.findUnique({ where: { id: tenantId } })
    if (!existing) throw new Error('Tenant not found')

    const updated = await db.tenant.update({
      where: { id: tenantId },
      data: {
        name: data.name !== undefined ? data.name.trim() : undefined,
        email: data.email !== undefined ? data.email.trim() : undefined,
        phone: data.phone !== undefined ? data.phone.trim() : undefined,
        website: data.website !== undefined ? data.website.trim() : undefined,
        address: data.address !== undefined ? data.address.trim() : undefined,
        city: data.city !== undefined ? data.city.trim() : undefined,
        state: data.state !== undefined ? data.state.trim() : undefined,
        pincode: data.pincode !== undefined ? data.pincode.trim() : undefined,
        timezone: data.timezone,
        locale: data.locale,
        logoUrl: data.logoUrl,
        academicYearStartMonth: data.academicYearStartMonth,
        gstNumber: data.gstNumber !== undefined ? data.gstNumber.trim() : undefined,
        panNumber: data.panNumber !== undefined ? data.panNumber.trim() : undefined,
      },
    })

    await recordAudit({
      tenantId,
      actorId: actor?.id,
      actorName: actor?.name,
      actorRole: actor?.role,
      action: 'UPDATE_SCHOOL_PROFILE',
      entity: 'Tenant',
      entityId: tenantId,
      module: 'Settings',
      summary: `Updated school profile fields: ${Object.keys(data).join(', ')}`,
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
      oldValues: { name: existing.name, email: existing.email, phone: existing.phone, timezone: existing.timezone },
      newValues: data,
    })

    return updated
  }

  /**
   * Secure Password Change with bcrypt & policy validation
   */
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    actor?: ScopeActor
  ) {
    if (!newPassword || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long')
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) throw new Error('User not found')

    const match = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!match) {
      throw new Error('Current password does not match')
    }

    const newHash = await bcrypt.hash(newPassword, 10)
    await db.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        updatedAt: new Date(),
      },
    })

    await recordAudit({
      tenantId: undefined,
      actorId: actor?.id || userId,
      actorName: actor?.name || user.fullName,
      actorRole: actor?.role,
      action: 'CHANGE_PASSWORD',
      entity: 'User',
      entityId: userId,
      module: 'Security',
      severity: 'WARNING',
      summary: `User ${user.fullName} changed password`,
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
    })

    return { success: true, message: 'Password changed successfully' }
  }

  /**
   * Authoritative Role-Permission Matrix
   */
  static getRolePermissionsMatrix() {
    const roles: Role[] = [...CANONICAL_ROLES]

    const modules = [
      'students',
      'admissions',
      'attendance',
      'finance',
      'communication',
      'academics',
      'timeline',
      'settings',
      'users',
      'audit',
      'operations',
    ]

    return roles.map((role) => {
      const perms = ROLE_PERMISSIONS[role] || []
      const isWildcard = perms.includes('*')

      const moduleBreakdown = modules.map((mod) => {
        const matchingPerms = isWildcard
          ? ['read', 'write', 'approve']
          : perms
              .filter((p) => p.startsWith(`${mod}:`))
              .map((p) => p.split(':')[1])

        return {
          module: mod,
          hasAccess: isWildcard || matchingPerms.length > 0,
          actions: matchingPerms,
        }
      })

      return {
        role,
        isWildcard,
        permissionsCount: isWildcard ? 'All School Permissions' : perms.length,
        permissions: perms,
        moduleBreakdown,
      }
    })
  }

  /**
   * User UI Preferences (Theme, Density, Notifications, etc.) backed by canonical User.preferences JSON
   */
  static async getUserPreferences(userId: string) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, locale: true, preferences: true },
    })
    const defaultPrefs = {
      theme: 'SYSTEM',
      density: 'COMFORTABLE',
      soundEnabled: true,
      emailAlerts: true,
      locale: user?.locale || 'en-IN',
    }
    const storedPrefs = (user?.preferences as Record<string, any>) || {}
    return {
      userId,
      ...defaultPrefs,
      ...storedPrefs,
      locale: user?.locale || storedPrefs.locale || 'en-IN',
    }
  }

  /**
   * Updates user preferences in User.preferences and optionally User.locale
   */
  static async updateUserPreferences(userId: string, updates: Record<string, any>) {
    const current = await this.getUserPreferences(userId)
    const { userId: _uid, ...existingPrefs } = current

    const merged = {
      ...existingPrefs,
      ...updates,
    }

    const dataToUpdate: any = {
      preferences: merged,
      updatedAt: new Date(),
    }
    if (updates.locale && typeof updates.locale === 'string') {
      dataToUpdate.locale = updates.locale
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: { id: true, locale: true, preferences: true, updatedAt: true },
    })

    return {
      userId,
      ...(updatedUser.preferences as Record<string, any>),
      locale: updatedUser.locale,
      updatedAt: updatedUser.updatedAt.toISOString(),
    }
  }
}
