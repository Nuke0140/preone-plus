import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { audit } from '@/lib/sequence'
import type { ProgramType } from '@prisma/client'

const PROGRAM_TYPES: ProgramType[] = ['PLAYGROUP', 'NURSERY', 'LKG', 'UKG', 'DAYCARE']

/** GET /api/v1/programs — program master data with classroom/fee coverage */
async function _GET(req: NextRequest) {
  const session = await requireApi(req)
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const programs = await db.program.findMany({
      where: { tenantId: session.tenantId, deletedAt: null },
      include: { _count: { select: { classrooms: true } } },
      orderBy: { createdAt: 'asc' },
    })
    const feePlans = await db.feePlan.findMany({
      where: { tenantId: session.tenantId, isActive: true },
      select: { programType: true },
    })
    const feeTypes = new Set(feePlans.map((f) => f.programType))
    return ok(programs.map((p) => ({
      id: p.id, code: p.code, name: p.name, programType: p.programType,
      description: p.description, ageMinMonths: p.ageMinMonths, ageMaxMonths: p.ageMaxMonths,
      durationMonths: p.durationMonths, capacity: p.capacity, isActive: p.isActive,
      classrooms: p._count.classrooms,
      hasFeePlan: feeTypes.has(p.programType),
    })))
  } catch (e) {
    return Errors.system(e)
  }
}

/** POST /api/v1/programs — create program (M00 Step 4) */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { name, code, programType, description, ageMinMonths, ageMaxMonths, durationMonths, capacity } = body
    if (!name || !code || !programType) return Errors.validation('name, code and programType are required')
    if (!PROGRAM_TYPES.includes(programType)) {
      return Errors.validation(`programType must be one of: ${PROGRAM_TYPES.join(', ')}`)
    }
    const dup = await db.program.findFirst({ where: { tenantId: session.tenantId, code: String(code).toUpperCase(), deletedAt: null } })
    if (dup) return Errors.conflict(`Program code "${code}" already exists`)

    const program = await db.program.create({
      data: {
        tenantId: session.tenantId,
        name, code: String(code).toUpperCase(), programType,
        description: description || null,
        ageMinMonths: ageMinMonths != null && ageMinMonths !== '' ? Number(ageMinMonths) : null,
        ageMaxMonths: ageMaxMonths != null && ageMaxMonths !== '' ? Number(ageMaxMonths) : null,
        durationMonths: durationMonths != null && durationMonths !== '' ? Number(durationMonths) : null,
        capacity: capacity ? Number(capacity) : 20,
      },
    })
    await audit({
      tenantId: session.tenantId, actorId: session.uid, actorName: session.name,
      action: 'CREATE', entity: 'Program', entityId: program.id,
      summary: `Created program ${program.name} (${program.code}) with capacity ${program.capacity}`,
    })
    return ok({ id: program.id, name: program.name, code: program.code }, undefined, 201)
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
