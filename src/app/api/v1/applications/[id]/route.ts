import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AdmissionService } from '@/lib/admissions/admission-service'

/**
 * GET /api/v1/applications/[id] — Full review & detail summary for an admission form
 */
async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'admissions:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params
  const sp = req.nextUrl.searchParams
  const branchId = sp.get('branchId') || session.branchId
  const academicYearId = sp.get('academicYearId')

  try {
    const reviewData = await AdmissionService.reviewApplication(
      {
        tenantId: session.tenantId,
        branchId: branchId || '',
        academicYearId: academicYearId || '',
        actorId: session.uid,
        actorName: session.name,
      },
      id
    )

    return ok(reviewData)
  } catch (e: any) {
    return Errors.notFound(e.message || 'Application')
  }
}

/**
 * PATCH /api/v1/applications/[id] — Update draft notes, child, or parent details
 */
async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'admissions:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params

  try {
    const body = await req.json()
    const app = await db.admissionApplication.findFirst({
      where: { id, tenantId: session.tenantId, deletedAt: null },
    })
    if (!app) return Errors.notFound('Application')

    if (app.status === 'ENROLLED') {
      return Errors.conflict('Cannot modify an already enrolled application')
    }

    const {
      childFirstName,
      childLastName,
      childDob,
      childGender,
      parentName,
      parentPhone,
      parentEmail,
      previousSchool,
      notes,
    } = body

    const updated = await db.admissionApplication.update({
      where: { id },
      data: {
        ...(childFirstName ? { childFirstName } : {}),
        ...(childLastName !== undefined ? { childLastName } : {}),
        ...(childDob ? { childDob: new Date(childDob) } : {}),
        ...(childGender ? { childGender } : {}),
        ...(parentName ? { parentName } : {}),
        ...(parentPhone ? { parentPhone } : {}),
        ...(parentEmail !== undefined ? { parentEmail } : {}),
        ...(previousSchool !== undefined ? { previousSchool } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
    })

    return ok(updated)
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const PATCH = withApi(_PATCH)
