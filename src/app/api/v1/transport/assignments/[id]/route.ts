import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportService } from '@/lib/transport/transport-service'

/**
 * GET /api/v1/transport/assignments/[id] — Get transport assignment details
 */
async function _GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const session = await requireApi(req, 'transport:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const assignment = await TransportService.getStudentAssignmentById(
      {
        tenantId: session.tenantId,
        branchId: session.branchId || undefined,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id
    )

    if (!assignment) return Errors.notFound('Assignment not found')
    return ok(assignment)
  } catch (e: any) {
    return Errors.system(e)
  }
}

/**
 * PATCH /api/v1/transport/assignments/[id] — Update transport assignment (e.g. suspend or status change)
 */
async function _PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const session = await requireApi(req, 'transport:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json().catch(() => ({}))
    const assignment = await TransportService.updateStudentAssignment(
      {
        tenantId: session.tenantId,
        branchId: session.branchId || undefined,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      body
    )

    return ok(assignment)
  } catch (e: any) {
    return Errors.system(e)
  }
}

/**
 * DELETE /api/v1/transport/assignments/[id] — Cancel/delete assignment
 */
async function _DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const session = await requireApi(req, 'transport:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    await TransportService.deleteStudentAssignment(
      {
        tenantId: session.tenantId,
        branchId: session.branchId || undefined,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id
    )

    return ok({ success: true, message: 'Assignment deleted' })
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const PATCH = withApi(_PATCH)
export const DELETE = withApi(_DELETE)
