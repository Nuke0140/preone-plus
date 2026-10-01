import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { audit } from '@/lib/sequence'

/** PATCH /api/v1/programs/{id} - update / deactivate program */
async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params

  try {
    const program = await db.program.findFirst({ where: { id, tenantId: session.tenantId, deletedAt: null } })
    if (!program) return Errors.notFound('Program')
    const body = await req.json()
    const allowed = ['name', 'description', 'ageMinMonths', 'ageMaxMonths', 'durationMonths', 'capacity', 'isActive'] as const
    const data: Record<string, unknown> = {}
    for (const k of allowed) if (k in body) {
      const v = body[k]
      data[k] = v === '' ? null : (['ageMinMonths', 'ageMaxMonths', 'durationMonths', 'capacity'].includes(k) ? Number(v) : v)
    }
    if (Object.keys(data).length === 0) return Errors.validation('No editable fields provided')

    // Safety dependency check if deactivating
    if (data.isActive === false) {
      const activeClassrooms = await db.classroom.count({
        where: { programId: id, tenantId: session.tenantId, isActive: true },
      })
      const activeStudents = await db.student.count({
        where: {
          tenantId: session.tenantId,
          currentClassroom: { programId: id },
          status: 'ACTIVE',
          deletedAt: null,
        },
      })
      if (activeClassrooms > 0 || activeStudents > 0) {
        return Errors.business(
          'PROGRAM_DEACTIVATE_BLOCKED',
          `Cannot deactivate program "${program.name}": it is currently linked to ${activeClassrooms} active classroom(s) and ${activeStudents} active enrolled student(s). Reassign them first.`,
          422
        )
      }
    }

    const updated = await db.program.update({ where: { id }, data })
    await audit({
      tenantId: session.tenantId, actorId: session.uid, actorName: session.name,
      action: 'UPDATE', entity: 'Program', entityId: id,
      summary: `Updated program ${updated.name}: ${Object.keys(data).join(', ')}`,
    })
    return ok({ id: updated.id, name: updated.name, isActive: updated.isActive })
  } catch (e) {
    return Errors.system(e)
  }
}

/** DELETE /api/v1/programs/{id} - soft delete program with dependency check */
async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params

  try {
    const program = await db.program.findFirst({ where: { id, tenantId: session.tenantId, deletedAt: null } })
    if (!program) return Errors.notFound('Program')

    const activeClassrooms = await db.classroom.count({
      where: { programId: id, tenantId: session.tenantId, isActive: true },
    })
    const activeStudents = await db.student.count({
      where: {
        tenantId: session.tenantId,
        currentClassroom: { programId: id },
        status: 'ACTIVE',
        deletedAt: null,
      },
    })
    if (activeClassrooms > 0 || activeStudents > 0) {
      return Errors.business(
        'PROGRAM_DELETE_BLOCKED',
        `Cannot archive program "${program.name}": it is currently linked to ${activeClassrooms} active classroom(s) and ${activeStudents} active enrolled student(s).`,
        422
      )
    }

    await db.program.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    })

    await audit({
      tenantId: session.tenantId, actorId: session.uid, actorName: session.name,
      action: 'ARCHIVE', entity: 'Program', entityId: id,
      summary: `Archived program ${program.name} (${program.code})`,
    })

    return ok({ archived: true, id })
  } catch (e) {
    return Errors.system(e)
  }
}

export const PATCH = withApi(_PATCH)
export const DELETE = withApi(_DELETE)
