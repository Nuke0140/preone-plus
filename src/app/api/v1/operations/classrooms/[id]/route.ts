import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { OperationsService } from '@/lib/operations/operations-service'

/**
 * GET /api/v1/operations/classrooms/[id]
 * Real-time classroom daily operational board
 */
async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'attendance:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const { id: classroomId } = await params
    const sp = req.nextUrl.searchParams
    const date = sp.get('date') || undefined

    const data = await OperationsService.getClassroomOperationalBoard(
      session.tenantId,
      classroomId,
      date,
      session.role === 'TEACHER' ? session.uid : null
    )

    return ok(data)
  } catch (err: any) {
    return Errors.system(err)
  }
}

export const GET = withApi(_GET)
