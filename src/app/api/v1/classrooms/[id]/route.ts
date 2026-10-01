import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { audit } from '@/lib/sequence'
import { ConfigurationService } from '@/lib/setup/config-service'

/**
 * PATCH /api/v1/classrooms/{id} - assign teacher / link program & facility /
 * adjust capacity (M00 Steps: Classes & Sections, Teacher Assignment)
 */
async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params

  try {
    const classroom = await db.classroom.findFirst({ where: { id, tenantId: session.tenantId } })
    if (!classroom) return Errors.notFound('Classroom')
    const body = await req.json()

    const data: Record<string, unknown> = {}
    if ('primaryTeacherId' in body) {
      const teacherId = body.primaryTeacherId || null
      if (teacherId) {
        const teacher = await db.tenantUser.findFirst({
          where: { tenantId: session.tenantId, userId: teacherId, deletedAt: null },
        })
        if (!teacher) return Errors.notFound('Teacher (no such member in this school)')
        data.primaryTeacherId = teacherId
      } else {
        data.primaryTeacherId = null
      }
    }
    if ('programId' in body) {
      const programId = body.programId || null
      if (programId) {
        const program = await db.program.findFirst({ where: { id: programId, tenantId: session.tenantId, deletedAt: null } })
        if (!program) return Errors.notFound('Program')
        data.programId = programId
      } else {
        data.programId = null
      }
    }
    if ('facilityId' in body) {
      const facilityId = body.facilityId || null
      if (facilityId) {
        const facility = await db.facility.findFirst({ where: { id: facilityId, tenantId: session.tenantId, deletedAt: null } })
        if (!facility) return Errors.notFound('Facility')
        data.facilityId = facilityId
      } else {
        data.facilityId = null
      }
    }
    if ('capacity' in body && body.capacity != null) {
      const cap = Number(body.capacity)
      if (!Number.isFinite(cap) || cap < 1) return Errors.validation('capacity must be a positive number')
      const check = await ConfigurationService.validateClassroomCapacity(session.tenantId, id, cap)
      if (!check.valid) {
        return Errors.business('SETUP_004', check.message || 'Capacity over-allocation guard violation', 422)
      }
      data.capacity = cap
    }
    if ('name' in body && body.name) data.name = body.name
    if (Object.keys(data).length === 0) return Errors.validation('Nothing to update')

    const updated = await db.classroom.update({ where: { id }, data })
    await audit({
      tenantId: session.tenantId, actorId: session.uid, actorName: session.name,
      action: 'UPDATE', entity: 'Classroom', entityId: id,
      summary: `Updated class ${updated.name}: ${Object.keys(data).join(', ')}`,
    })
    return ok({ id: updated.id, name: updated.name, primaryTeacherId: updated.primaryTeacherId, programId: updated.programId, capacity: updated.capacity })
  } catch (e) {
    return Errors.system(e)
  }
}

export const PATCH = withApi(_PATCH)
