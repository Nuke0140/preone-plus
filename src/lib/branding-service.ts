/**
 * PreOne — Canonical Server Branding Service
 *
 * Server-side operations for School Visual Identity:
 *  - Resolving effective branding with Tenant and SchoolConfig fallback
 *  - Theme reset with audit logging
 */

import { db } from '@/lib/db'
import { audit } from '@/lib/sequence'
import {
  PREONE_BRANDING_DEFAULTS,
  isValidHexColor,
  type BrandingConfig,
} from './branding'

export * from './branding'

/**
 * Single Canonical Resolver for Effective Branding across PreOne OS.
 * Reads Tenant and SchoolConfig(domain = "BRANDING") and resolves defaults.
 */
export async function getEffectiveBranding(tenantId: string): Promise<BrandingConfig> {
  const [tenant, configRow] = await Promise.all([
    db.tenant.findUnique({
      where: { id: tenantId },
      select: { logoUrl: true, name: true, code: true },
    }),
    db.schoolConfig.findUnique({
      where: { tenantId_domain: { tenantId, domain: 'BRANDING' } },
    }),
  ])

  const brandData = (configRow?.data as Record<string, unknown>) || {}

  const primaryColor =
    typeof brandData.primaryColor === 'string' && isValidHexColor(brandData.primaryColor)
      ? brandData.primaryColor.trim()
      : PREONE_BRANDING_DEFAULTS.primaryColor

  const accentColor =
    typeof brandData.accentColor === 'string' && isValidHexColor(brandData.accentColor)
      ? brandData.accentColor.trim()
      : PREONE_BRANDING_DEFAULTS.accentColor

  const layout =
    brandData.layout === 'CLASSIC_SIDEBAR' ? 'CLASSIC_SIDEBAR' : 'WINDOWS_SHELL'

  const bannerUrl =
    typeof brandData.bannerUrl === 'string' && brandData.bannerUrl.trim()
      ? brandData.bannerUrl.trim()
      : null

  const logoUrl = tenant?.logoUrl || null

  return {
    primaryColor,
    accentColor,
    layout,
    bannerUrl,
    logoUrl,
    schoolName: tenant?.name || 'PreOne Preschool',
    schoolCode: tenant?.code || '',
  }
}

/**
 * Resets Theme settings to PreOne defaults while preserving Tenant Logo and identity.
 */
export async function resetThemeSettings(
  tenantId: string,
  actor: { id: string; name?: string; role?: string }
): Promise<BrandingConfig> {
  const resetData = {
    primaryColor: PREONE_BRANDING_DEFAULTS.primaryColor,
    accentColor: PREONE_BRANDING_DEFAULTS.accentColor,
    layout: PREONE_BRANDING_DEFAULTS.layout,
    bannerUrl: null,
  }

  const oldConfig = await db.schoolConfig.findUnique({
    where: { tenantId_domain: { tenantId, domain: 'BRANDING' } },
  })
  const oldData = (oldConfig?.data as Record<string, unknown>) || {}

  await db.schoolConfig.upsert({
    where: { tenantId_domain: { tenantId, domain: 'BRANDING' } },
    create: {
      tenantId,
      domain: 'BRANDING',
      data: resetData,
      updatedById: actor.id,
      updatedByName: actor.name,
    },
    update: {
      data: resetData,
      updatedById: actor.id,
      updatedByName: actor.name,
    },
  })

  // Audit event explicitly records BRANDING_THEME_RESET
  await audit({
    tenantId,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: 'BRANDING_THEME_RESET',
    entity: 'SchoolConfig',
    entityId: `${tenantId}:BRANDING`,
    module: 'SETUP',
    summary: 'Reset theme colors, layout, and banner to PreOne defaults. School logo was preserved.',
    oldValues: {
      previousPrimary: oldData.primaryColor,
      previousAccent: oldData.accentColor,
      previousLayout: oldData.layout,
      previousBanner: oldData.bannerUrl,
    },
    newValues: {
      ...resetData,
      logoPreserved: true,
    },
  })

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { logoUrl: true, name: true, code: true },
  })

  return {
    ...resetData,
    logoUrl: tenant?.logoUrl || null,
    schoolName: tenant?.name || 'PreOne Preschool',
    schoolCode: tenant?.code || '',
  }
}
