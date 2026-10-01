import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { recordAudit, getRequestMeta } from '@/lib/audit'

/** GET /api/v1/tenant/profile � get current school profile & settings */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'settings:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const [tenant, brandConfig] = await Promise.all([
      db.tenant.findUnique({
        where: { id: session.tenantId },
        include: {
          _count: {
            select: {
              students: true,
              branches: true,
              members: true,
              classrooms: true,
            },
          },
        },
      }),
      db.schoolConfig.findUnique({
        where: { tenantId_domain: { tenantId: session.tenantId, domain: 'BRANDING' } },
      }),
    ])
    if (!tenant) return Errors.notFound('School profile')

    const brandData = (brandConfig?.data as Record<string, unknown>) || {}

    return ok({
      id: tenant.id,
      name: tenant.name,
      code: tenant.code,
      tagline: brandData.tagline || null,
      logoUrl: tenant.logoUrl,
      address: tenant.address,
      city: tenant.city,
      state: tenant.state,
      pincode: tenant.pincode,
      phone: tenant.phone,
      email: tenant.email,
      website: tenant.website,
      gstNumber: tenant.gstNumber,
      currency: brandData.currency || 'INR',
      timezone: tenant.timezone,
      themeColor: (brandData.primaryColor as string) || brandData.themeColor || '#7C3AED',
      branding: {
        primaryColor: (brandData.primaryColor as string) || '#7C3AED',
        accentColor: (brandData.accentColor as string) || '#3B82F6',
        layout: brandData.layout === 'CLASSIC_SIDEBAR' ? 'CLASSIC_SIDEBAR' : 'WINDOWS_SHELL',
        bannerUrl: (brandData.bannerUrl as string) || null,
        logoUrl: tenant.logoUrl || null,
      },
      status: tenant.status,
      subscriptionPlan: tenant.subscriptionPlan,
      counts: {
        students: tenant._count.students,
        branches: tenant._count.branches,
        staff: tenant._count.members,
        classrooms: tenant._count.classrooms,
      },
    })
  } catch (e) {
    return Errors.system(e)
  }
}

/** PATCH /api/v1/tenant/profile - update school profile & settings */
async function _PATCH(req: NextRequest) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const tenantFields = [
      'name',
      'address',
      'city',
      'state',
      'pincode',
      'phone',
      'email',
      'website',
      'gstNumber',
      'timezone',
      'logoUrl',
    ] as const

    const brandFields = ['tagline', 'themeColor', 'currency'] as const

    const tenantData: Record<string, unknown> = {}
    const brandUpdates: Record<string, unknown> = {}

    for (const k of tenantFields) {
      if (k in body) tenantData[k] = body[k]
    }
    for (const k of brandFields) {
      if (k in body) brandUpdates[k] = body[k]
    }

    if (Object.keys(tenantData).length === 0 && Object.keys(brandUpdates).length === 0) {
      return Errors.validation('No valid fields provided to update')
    }

    const before = await db.tenant.findUnique({ where: { id: session.tenantId } })

    const updated = await db.$transaction(async (tx) => {
      let t = before
      if (Object.keys(tenantData).length > 0) {
        t = await tx.tenant.update({
          where: { id: session.tenantId! },
          data: tenantData,
        })
      }

      if (Object.keys(brandUpdates).length > 0) {
        const existingBrand = await tx.schoolConfig.findUnique({
          where: { tenantId_domain: { tenantId: session.tenantId!, domain: 'BRANDING' } },
        })
        const mergedData = { ...(existingBrand?.data as Record<string, unknown> ?? {}), ...brandUpdates }
        await tx.schoolConfig.upsert({
          where: { tenantId_domain: { tenantId: session.tenantId!, domain: 'BRANDING' } },
          create: {
            tenantId: session.tenantId!,
            domain: 'BRANDING',
            data: mergedData,
            updatedById: session.uid,
            updatedByName: session.name,
          },
          update: {
            data: mergedData,
            updatedById: session.uid,
            updatedByName: session.name,
          },
        })
      }

      return t
    })

    const meta = getRequestMeta(req)
    await recordAudit({
      tenantId: session.tenantId,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
      action: 'UPDATE_SCHOOL_PROFILE',
      entity: 'Tenant',
      entityId: session.tenantId,
      module: 'Settings',
      summary: `Updated school profile fields: ${[...Object.keys(tenantData), ...Object.keys(brandUpdates)].join(', ')}`,
      oldValues: before ? JSON.stringify(before) : undefined,
      newValues: JSON.stringify({ ...tenantData, ...brandUpdates }),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    })

    return ok(updated)
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const PATCH = withApi(_PATCH)
