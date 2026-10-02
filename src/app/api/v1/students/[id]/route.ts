import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { can } from '@/lib/auth'
import { StudentService } from '@/lib/students/student-service'

/**
 * GET /api/v1/students/[id] — 360° Comprehensive Student Profile
 */
async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req)
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const effectiveRoles = session.roles && session.roles.length > 0 ? session.roles : [session.role]
  const hasAccess = can(effectiveRoles, 'students:read') || can(effectiveRoles, 'students:read-linked')
  if (!hasAccess) {
    return Errors.forbidden('Missing permission: students:read or students:read-linked')
  }

  const { id } = await params
  const academicSessionId = req.nextUrl.searchParams.get('academicSessionId') || undefined

  try {
    const profile = await StudentService.getStudentProfile(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        academicSessionId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id
    )

    return ok(profile)
  } catch (e: any) {
    if (e.message.includes('Unauthorized')) {
      return Errors.forbidden(e.message)
    }
    return Errors.notFound('Student')
  }
}

/**
 * PATCH /api/v1/students/[id] — Update student profile attributes
 */
async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'students:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params

  try {
    const body = await req.json()
    const { firstName, lastName, dob, gender, bloodGroup, address, photoUrl, seatNumber, generateSeatNumber } = body

    const updated = await StudentService.updateStudent(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id,
      {
        firstName,
        lastName,
        dob,
        gender,
        bloodGroup,
        address,
        photoUrl,
        seatNumber,
        generateSeatNumber,
      }
    )

    return ok(updated)
  } catch (e: any) {
    return Errors.business('STUDENT_UPDATE_FAILED', e.message || 'Failed to update student profile', 422)
  }
}

export const GET = withApi(_GET)
export const PATCH = withApi(_PATCH)
