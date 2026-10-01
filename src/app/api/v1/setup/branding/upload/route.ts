import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { saveBrandingAsset, BrandingAssetType } from '@/lib/storage'
import { audit } from '@/lib/sequence'

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const type = ((formData.get('type') as string) || 'logo') as BrandingAssetType

    if (!file || !(file instanceof File)) {
      return Errors.validation('A valid image file must be uploaded.', 'file')
    }

    if (type !== 'logo' && type !== 'banner') {
      return Errors.validation('Asset type must be "logo" or "banner".', 'type')
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const saved = await saveBrandingAsset({
      tenantId: session.tenantId,
      type,
      buffer,
      mimeType: file.type,
      originalName: file.name,
    })

    await audit({
      tenantId: session.tenantId,
      actorId: session.uid,
      actorName: session.name,
      action: 'BRANDING_ASSET_UPLOADED',
      entity: 'BrandingAsset',
      entityId: `${session.tenantId}:${type}`,
      summary: `Uploaded school ${type}: ${saved.url} (${Math.round(saved.size / 1024)} KB)`,
    })

    return ok({
      url: saved.url,
      size: saved.size,
      mimeType: saved.mimeType,
      type,
    })
  } catch (err: any) {
    if (err.message && (err.message.includes('Invalid file format') || err.message.includes('exceeds maximum'))) {
      return Errors.validation(err.message)
    }
    return Errors.system(err)
  }
}

export const POST = withApi(_POST)
