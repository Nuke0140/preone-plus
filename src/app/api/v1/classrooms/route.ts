import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'

/** GET /api/v1/classrooms — list classrooms for tenant (with student counts) */
async function _GET(req: NextRequest) {
  const session = await requireApi(req)
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const classrooms = await db.classroom.findMany({
      where: { tenantId: session.tenantId, isActive: true },
      include: {
        primaryTeacher: { select: { fullName: true } },
        program: { select: { name: true, code: true } },
        _count: { select: { students: true } },
      },
      orderBy: [{ programType: 'asc' }, { name: 'asc' }],
    })
    return ok(
      classrooms.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        programType: c.programType,
        programId: c.programId,
        programName: c.program?.name ?? null,
        branchId: c.branchId,
        academicSessionId: c.academicSessionId,
        primaryTeacherId: c.primaryTeacherId,
        capacity: c.capacity,
        teacher: c.primaryTeacher?.fullName ?? null,
        students: c._count.students,
      }))
    )
  } catch (e) {
    return Errors.system(e)
  }
}

/** POST /api/v1/classrooms — create classroom (settings:write) */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { name, programType, capacity, branchId, programId, primaryTeacherId, facilityId } = body
    if (!name || !programType) {
      return Errors.validation('name and programType are required')
    }
    const branch = branchId
      ? await db.branch.findFirst({ where: { id: branchId, tenantId: session.tenantId } })
      : await db.branch.findFirst({ where: { tenantId: session.tenantId, isMain: true } })
    if (!branch) return Errors.notFound('Branch')

    const acad = await db.academicSession.findFirst({
      where: { tenantId: session.tenantId, isCurrent: true },
    })
    if (!acad) return Errors.notFound('Academic session')

    const count = await db.classroom.count({ where: { tenantId: session.tenantId } })
    const classroom = await db.classroom.create({
      data: {
        tenantId: session.tenantId,
        branchId: branch.id,
        academicSessionId: acad.id,
        name,
        code: `${programType.slice(0, 3)}-${String.fromCharCode(65 + (count % 26))}`,
        programType,
        capacity: capacity || 20,
        programId: programId || null,
        primaryTeacherId: primaryTeacherId || null,
        facilityId: facilityId || null,
      },
    })
    return ok({ id: classroom.id }, undefined, 201)
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
