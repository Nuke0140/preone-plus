import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { StudentService } from '@/lib/students/student-service'
import type { ProgramType } from '@prisma/client'

/**
 * POST /api/v1/students/[id]/program — Program transition with age eligibility validation
 */
async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'students:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params

  try {
    const body = await req.json()
    const { programType, destinationClassroomId, reason } = body

    if (!programType) {
      return Errors.validation('programType is required')
    }

    const updated = await StudentService.changeProgram(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      {
        programType: programType as ProgramType,
        destinationClassroomId,
        reason,
      }
    )

    return ok(updated)
  } catch (e: any) {
    return Errors.business('PROGRAM_CHANGE_FAILED', e.message || 'Failed to change program', 422)
  }
}

export const POST = withApi(_POST)
