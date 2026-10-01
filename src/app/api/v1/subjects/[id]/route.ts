import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { SubjectService } from '@/lib/academics/subject-service'
import type { SubjectType } from '@prisma/client'

/**
 * GET /api/v1/subjects/[id] — get single subject
 */
async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'academics:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params
  try {
    const subject = await SubjectService.getSubject(session.tenantId, id)
    if (!subject) return Errors.notFound('Subject', id)
    return ok({ subject })
  } catch (e) {
    return Errors.system(e)
  }
}

/**
 * PATCH /api/v1/subjects/[id] — update subject
 */
async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'academics:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params
  try {
    const body = await req.json().catch(() => ({}))
    const actor = { id: session.uid, name: session.name, role: session.role }

    const updated = await SubjectService.updateSubject(
      session.tenantId,
      id,
      {
        name: body.name,
        shortName: body.shortName,
        description: body.description,
        subjectType: body.subjectType as SubjectType,
        status: body.status,
        programIds: Array.isArray(body.programIds) ? body.programIds : undefined,
      },
      actor
    )

    return ok({ subject: updated })
  } catch (e: any) {
    if (e.message?.includes('not found')) {
      return Errors.notFound('Subject', id)
    }
    return Errors.system(e)
  }
}

/**
 * DELETE /api/v1/subjects/[id] — deactivate subject
 */
async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'academics:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params
  try {
    const actor = { id: session.uid, name: session.name, role: session.role }
    const deleted = await SubjectService.deleteSubject(session.tenantId, id, actor)
    return ok({ subject: deleted, message: 'Subject deactivated successfully' })
  } catch (e: any) {
    if (e.message?.includes('not found')) {
      return Errors.notFound('Subject', id)
    }
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const PATCH = withApi(_PATCH)
export const DELETE = withApi(_DELETE)
