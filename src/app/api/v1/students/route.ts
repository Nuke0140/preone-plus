import { NextRequest } from 'next/server'
import { ok, withApi, errPermission } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { StudentService } from '@/lib/students/student-service'
import type { ProgramType, StudentStatus } from '@prisma/client'

/**
 * GET /api/v1/students — Paginated directory with multi-dimensional filtering & search
 */
export const GET = withApi(async (req: NextRequest) => {
  const session = await requireApi(req, 'students:read')
  if (isResponse(session)) return session
  if (!session.tenantId) {
    throw errPermission('No tenant context found in active session')
  }

  const sp = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '20', 10)))
  const search = sp.get('q') || sp.get('search') || undefined
  const classroomId = sp.get('classroomId') || undefined
  const branchId = sp.get('branchId') || session.branchId || undefined
  const academicSessionId = sp.get('academicSessionId') || undefined
  const programType = (sp.get('programType') as ProgramType) || undefined
  const status = (sp.get('status') as StudentStatus) || undefined

  const result = await StudentService.listStudents(
    {
      tenantId: session.tenantId,
      branchId: session.branchId,
      academicSessionId,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    },
    {
      page,
      pageSize,
      search,
      classroomId,
      branchId,
      academicSessionId,
      programType,
      status,
    }
  )

  return ok(result.data, result.pagination)
}, { module: 'students' })

/**
 * POST /api/v1/students — Transactional manual student creation with duplicate check
 */
export const POST = withApi(async (req: NextRequest) => {
  const session = await requireApi(req, 'students:write')
  if (isResponse(session)) return session
  if (!session.tenantId) {
    throw errPermission('No tenant context found in active session')
  }

  const body = await req.json()
  const {
    firstName,
    lastName,
    dob,
    gender,
    bloodGroup,
    address,
    photoUrl,
    programId,
    programType,
    classroomId,
    branchId,
    academicSessionId,
    guardianName,
    guardianPhone,
    guardianEmail,
    guardianRelationship,
    canPickup,
    isFeePayer,
    confirmDuplicate,
  } = body

  const student = await StudentService.createStudent(
    {
      tenantId: session.tenantId,
      branchId: branchId || session.branchId,
      academicSessionId,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    },
    {
      firstName,
      lastName,
      dob,
      gender,
      bloodGroup,
      address,
      photoUrl,
      programId,
      programType,
      classroomId,
      branchId,
      academicSessionId,
      guardianName,
      guardianPhone,
      guardianEmail,
      guardianRelationship,
      canPickup,
      isFeePayer,
      confirmDuplicate,
    }
  )

  return ok(student, undefined, 201)
}, { module: 'students' })
