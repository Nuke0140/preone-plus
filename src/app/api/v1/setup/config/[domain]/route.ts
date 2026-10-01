import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { audit } from '@/lib/sequence'
import type { ConfigDomain } from '@prisma/client'

const VALID_DOMAINS: ConfigDomain[] = [
  'OPERATING', 'ADMISSION', 'STUDENT_PARENT', 'FINANCE', 'DAILY_OPERATIONS',
  'HEALTH_SAFETY', 'COMMUNICATION', 'DOCUMENT_TEMPLATES', 'CURRICULUM', 'BRANDING',
]

import { isValidHexColor, getEffectiveBranding, resetThemeSettings } from '@/lib/branding-service'
import { isDurableAssetUrl } from '@/lib/storage'

/** GET /api/v1/setup/config/{domain} — read JSON config (defaults for null) */
async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  const session = await requireApi(req, 'settings:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { domain } = await params
  if (!VALID_DOMAINS.includes(domain as ConfigDomain)) {
    return Errors.validation(`domain must be one of: ${VALID_DOMAINS.join(', ')}`)
  }

  try {
    if (domain === 'BRANDING') {
      const effective = await getEffectiveBranding(session.tenantId)
      const row = await db.schoolConfig.findUnique({
        where: { tenantId_domain: { tenantId: session.tenantId, domain: 'BRANDING' } },
      })
      return ok({
        domain: 'BRANDING',
        data: effective,
        raw: row?.data ?? null,
        updatedAt: row?.updatedAt ?? null,
        updatedByName: row?.updatedByName ?? null,
      })
    }

    const row = await db.schoolConfig.findUnique({
      where: { tenantId_domain: { tenantId: session.tenantId, domain: domain as ConfigDomain } },
    })
    return ok({ domain, data: row?.data ?? null, updatedAt: row?.updatedAt ?? null, updatedByName: row?.updatedByName ?? null })
  } catch (e) {
    return Errors.system(e)
  }
}

/** PUT /api/v1/setup/config/{domain} — upsert JSON config (single source of truth for that domain) */
async function _PUT(
  req: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { domain } = await params
  if (!VALID_DOMAINS.includes(domain as ConfigDomain)) {
    return Errors.validation(`domain must be one of: ${VALID_DOMAINS.join(', ')}`)
  }

  try {
    const body = await req.json()
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return Errors.validation('config body must be a JSON object')
    }

    if (domain === 'BRANDING') {
      // 1. Handle Reset Theme action
      if (body.action === 'RESET_THEME') {
        const resetResult = await resetThemeSettings(session.tenantId, {
          id: session.uid,
          name: session.name,
          role: session.role,
        })
        return ok({ domain: 'BRANDING', data: resetResult, updatedAt: new Date() })
      }

      // 2. Validate Colors
      if (body.primaryColor !== undefined && body.primaryColor !== null) {
        if (!isValidHexColor(body.primaryColor)) {
          return Errors.validation('Invalid primaryColor format. Must be a valid HEX color (e.g. #7C3AED)', 'primaryColor')
        }
      }

      if (body.accentColor !== undefined && body.accentColor !== null) {
        if (!isValidHexColor(body.accentColor)) {
          return Errors.validation('Invalid accentColor format. Must be a valid HEX color (e.g. #3B82F6)', 'accentColor')
        }
      }

      // 3. Validate Layout
      if (body.layout !== undefined && body.layout !== null) {
        if (!['WINDOWS_SHELL', 'CLASSIC_SIDEBAR'].includes(body.layout)) {
          return Errors.validation('Invalid layout. Must be WINDOWS_SHELL or CLASSIC_SIDEBAR', 'layout')
        }
      }

      // 4. Validate Logo & Banner durability (reject data: or blob: URIs)
      if (body.logoUrl !== undefined && body.logoUrl !== null && body.logoUrl !== '') {
        if (!isDurableAssetUrl(body.logoUrl)) {
          return Errors.validation('logoUrl must be a durable file path or URL (cannot be data URI or blob URL)', 'logoUrl')
        }
      }

      if (body.bannerUrl !== undefined && body.bannerUrl !== null && body.bannerUrl !== '') {
        if (!isDurableAssetUrl(body.bannerUrl)) {
          return Errors.validation('bannerUrl must be a durable file path or URL (cannot be data URI or blob URL)', 'bannerUrl')
        }
      }

      // 5. Canonical Logo handling: Tenant.logoUrl
      if ('logoUrl' in body) {
        await db.tenant.update({
          where: { id: session.tenantId },
          data: { logoUrl: body.logoUrl?.trim() || null },
        })
      }

      // Extract config-only fields for SchoolConfig(BRANDING)
      const configPayload: Record<string, unknown> = {}
      if (body.primaryColor !== undefined) configPayload.primaryColor = body.primaryColor?.trim()
      if (body.accentColor !== undefined) configPayload.accentColor = body.accentColor?.trim()
      if (body.layout !== undefined) configPayload.layout = body.layout
      if ('bannerUrl' in body) configPayload.bannerUrl = body.bannerUrl || null

      const before = await db.schoolConfig.findUnique({
        where: { tenantId_domain: { tenantId: session.tenantId, domain: 'BRANDING' } },
      })

      const row = await db.schoolConfig.upsert({
        where: { tenantId_domain: { tenantId: session.tenantId, domain: 'BRANDING' } },
        create: {
          tenantId: session.tenantId,
          domain: 'BRANDING',
          data: configPayload,
          updatedById: session.uid,
          updatedByName: session.name,
        },
        update: {
          data: configPayload,
          updatedById: session.uid,
          updatedByName: session.name,
        },
      })

      await audit({
        tenantId: session.tenantId,
        actorId: session.uid,
        actorName: session.name,
        action: 'BRANDING_UPDATED',
        entity: 'SchoolConfig',
        entityId: `${session.tenantId}:BRANDING`,
        summary: `Updated school branding configuration (Primary: ${configPayload.primaryColor || 'default'}, Accent: ${configPayload.accentColor || 'default'}, Layout: ${configPayload.layout || 'default'})`,
      })

      const effective = await getEffectiveBranding(session.tenantId)
      return ok({ domain: 'BRANDING', data: effective, updatedAt: row.updatedAt })
    }

    const before = await db.schoolConfig.findUnique({
      where: { tenantId_domain: { tenantId: session.tenantId, domain: domain as ConfigDomain } },
    })
    const row = await db.schoolConfig.upsert({
      where: { tenantId_domain: { tenantId: session.tenantId, domain: domain as ConfigDomain } },
      create: {
        tenantId: session.tenantId,
        domain: domain as ConfigDomain,
        data: body,
        updatedById: session.uid,
        updatedByName: session.name,
      },
      update: {
        data: body,
        updatedById: session.uid,
        updatedByName: session.name,
      },
    })
    await audit({
      tenantId: session.tenantId, actorId: session.uid, actorName: session.name,
      action: 'SETUP_CONFIG_UPDATE', entity: 'SchoolConfig', entityId: `${session.tenantId}:${domain}`,
      summary: `Updated ${domain} configuration${before ? ' (edited existing)' : ' (first configuration)'}`,
    })
    return ok({ domain: row.domain, data: row.data, updatedAt: row.updatedAt })
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const PUT = withApi(_PUT)
