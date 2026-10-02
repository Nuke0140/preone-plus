import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AcademicService } from '@/lib/academics/academic-service'
import type { CurriculumStatus, ProgramType } from '@prisma/client'

/**
 * GET /api/v1/academics/curriculum — List curriculum frameworks
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'academics:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { searchParams } = new URL(req.url)
  const programId = searchParams.get('programId') || undefined
  const programType = (searchParams.get('programType') as ProgramType) || undefined
  const status = (searchParams.get('status') as CurriculumStatus) || undefined
  const academicSessionId = searchParams.get('academicSessionId') || undefined

  try {
    const list = await AcademicService.listCurricula(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        academicSessionId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      { programId, programType, status }
    )

    return ok(list)
  } catch (e: any) {
    return Errors.system(e)
  }
}

/**
 * POST /api/v1/academics/curriculum — Create curriculum framework with optional foundational areas
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'academics:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const {
      name,
      programId,
      programType,
      academicSessionId,
      framework,
      description,
      version,
      effectiveFrom,
      effectiveTo,
      seedDefaultAreas,
    } = body

    if (!name || !name.trim()) {
      return Errors.validation('Curriculum name is required', 'name')
    }

    const curriculum = await AcademicService.createCurriculum(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        academicSessionId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      {
        name,
        programId,
        programType,
        academicSessionId,
        framework,
        description,
        version,
        effectiveFrom,
        effectiveTo,
        seedDefaultAreas,
      }
    )

    return ok(curriculum, undefined, 201)
  } catch (e: any) {
    return Errors.business('CURRICULUM_CREATE_FAILED', e.message || 'Failed to create curriculum', 422)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
