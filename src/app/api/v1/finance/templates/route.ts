import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { FeeService } from '@/lib/fees/fee-service'

async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'finance:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const sp = req.nextUrl.searchParams
    const type = (sp.get('type') as 'INVOICE' | 'RECEIPT') || undefined
    const templates = await FeeService.getTemplates(session.tenantId, type)
    return ok(templates)
  } catch (e: any) {
    return Errors.system(e)
  }
}

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'finance:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { type, name, isDefault, content } = body
    if (!type || !['INVOICE', 'RECEIPT'].includes(type)) {
      return Errors.validation('type must be INVOICE or RECEIPT')
    }
    if (!name || typeof name !== 'string') {
      return Errors.validation('name is required')
    }

    const template = await FeeService.createTemplate(
      {
        tenantId: session.tenantId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      { type, name, isDefault, content: content || {} }
    )

    return ok(template, undefined, 201)
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
