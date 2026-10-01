import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { SubjectService } from '@/lib/academics/subject-service'
import type { SubjectType } from '@prisma/client'

/**
 * GET /api/v1/subjects — list subjects for tenant
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'academics:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || undefined
    const subjectType = (searchParams.get('type') as SubjectType) || undefined

    const subjects = await SubjectService.getSubjects(session.tenantId, {
      status,
      subjectType,
    })

    return ok(subjects)
  } catch (e) {
    return Errors.system(e)
  }
}

/**
 * POST /api/v1/subjects — create new subject
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'academics:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json().catch(() => ({}))
    const { name, code, shortName, description, subjectType, programIds } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return Errors.validation('Subject name is required')
    }
    if (!code || typeof code !== 'string' || !code.trim()) {
      return Errors.validation('Subject code is required')
    }

    const actor = { id: session.uid, name: session.name, role: session.role }
    const subject = await SubjectService.createSubject(
      session.tenantId,
      {
        name,
        code,
        shortName,
        description,
        subjectType: subjectType as SubjectType,
        programIds: Array.isArray(programIds) ? programIds : undefined,
      },
      actor
    )

    return ok({ subject }, undefined, 201)
  } catch (e: any) {
    if (e.message?.includes('already exists')) {
      return Errors.conflict('SUBJECT_EXISTS', e.message)
    }
    if (e.message?.includes('Tenant not found') || e.message?.includes('session')) {
      return Errors.unauthorized(e.message)
    }
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
