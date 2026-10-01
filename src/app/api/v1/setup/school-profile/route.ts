import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { audit } from '@/lib/sequence'

/** PATCH /api/v1/setup/school-profile — Step 1/2: edit existing Tenant identity (writes the real Tenant row) */
async function _PATCH(req: NextRequest) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const allowed = [
      'name', 'email', 'phone', 'website', 'address', 'city', 'state', 'pincode',
      'timezone', 'locale', 'logoUrl', 'principalSignatureUrl', 'academicYearStartMonth',
    ] as const
    const data: Record<string, unknown> = {}
    for (const k of allowed) {
      if (k in body) data[k] = body[k]
    }
    if ((data.name ?? '').toString().trim() === '') {
      return Errors.validation('School name cannot be empty', 'name')
    }
    if (Object.keys(data).length === 0) {
      return Errors.validation('No editable fields provided')
    }

    const before = await db.tenant.findUnique({ where: { id: session.tenantId } })
    const tenant = await db.tenant.update({ where: { id: session.tenantId }, data })
    await audit({
      tenantId: session.tenantId, actorId: session.uid, actorName: session.name,
      action: 'SETUP_PROFILE_UPDATE', entity: 'Tenant', entityId: tenant.id,
      summary: `School profile updated: ${Object.keys(data).join(', ')}`,
    })
    return ok({
      id: tenant.id, name: tenant.name, email: tenant.email, phone: tenant.phone,
      website: tenant.website, address: tenant.address, city: tenant.city,
      state: tenant.state, pincode: tenant.pincode, timezone: tenant.timezone,
      locale: tenant.locale, logoUrl: tenant.logoUrl,
      principalSignatureUrl: tenant.principalSignatureUrl,
      academicYearStartMonth: tenant.academicYearStartMonth,
    })
  } catch (e) {
    return Errors.system(e)
  }
}

/** GET /api/v1/setup/school-profile — current identity for the step form */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'settings:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } })
    if (!tenant) return Errors.notFound('Tenant')
    return ok({
      id: tenant.id, name: tenant.name, legalName: tenant.name, code: tenant.code,
      email: tenant.email, phone: tenant.phone, website: tenant.website,
      address: tenant.address, city: tenant.city, state: tenant.state, pincode: tenant.pincode,
      timezone: tenant.timezone, locale: tenant.locale, logoUrl: tenant.logoUrl,
      principalSignatureUrl: tenant.principalSignatureUrl,
      academicYearStartMonth: tenant.academicYearStartMonth,
    })
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const PATCH = withApi(_PATCH)
