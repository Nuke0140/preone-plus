import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { audit } from '@/lib/sequence'
import { emit } from '@/lib/events'
import { registerIntegrations } from '@/lib/integrations'

/**
 * POST /api/v1/academic-years/{id}/promote — transactional year-end step 2
 * (Spec §6/§10, Scenario 10). Body: { toSessionId, mappings: [{from, to}] }
 *  · {id} = the OLD (just closed) session; toSessionId = the NEW active year
 *  · per ACTIVE student of each `from` classroom: old-year allocation row is
 *    marked PROMOTED/COMPLETED (history preserved), a new ACTIVE allocation is
 *    created in the mapped `to` classroom of the new year, and
 *    Student.currentClassroomId is moved. Capacity guarded (never overbook).
 *  · unallocated students remain in the old year (must be handled explicitly).
 *  · idempotent per student (students already allocated into `to` are skipped).
 */
async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  registerIntegrations()

  const { id } = await params
  const body = await req.json()
  const { toSessionId, mappings } = body as {
    toSessionId: string
    mappings: { from: string; to: string }[]
  }
  if (!toSessionId || !Array.isArray(mappings) || mappings.length === 0) {
    return Errors.validation('toSessionId and mappings[] ({from,to} classroom ids) are required')
  }

  try {
    const fromSession = await db.academicSession.findFirst({ where: { id, tenantId: session.tenantId } })
    const toSession = await db.academicSession.findFirst({ where: { id: toSessionId, tenantId: session.tenantId } })
    if (!fromSession || !toSession) return Errors.notFound('Academic year')
    if (fromSession.id === toSession.id) return Errors.conflict('Cannot promote into the same academic year')

    // verify mapping targets belong to tenant + new session
    const targetIds = mappings.map((m) => m.to)
    const targets = await db.classroom.findMany({
      where: { id: { in: targetIds }, tenantId: session.tenantId, academicSessionId: toSession.id },
      select: { id: true, name: true, capacity: true, programType: true },
    })
    if (targets.length !== new Set(targetIds).size) {
      return Errors.validation('Every mapping target must be an existing classroom of the NEW academic year')
    }

    const promoted: { studentId: string; name: string; to: string }[] = []
    const skipped: { studentId: string; reason: string }[] = []

    for (const m of mappings) {
      const students = await db.student.findMany({
        where: { tenantId: session.tenantId, currentClassroomId: m.from, status: 'ACTIVE', deletedAt: null },
      })

      for (const student of students) {
        // idempotency: already allocated in the new year?
        const existing = await db.studentAllocation.findFirst({
          where: { studentId: student.id, academicSessionId: toSession.id },
        })
        if (existing) {
          skipped.push({ studentId: student.id, reason: 'Already allocated in the new academic year' })
          continue
        }

        const capacity = await db.student.count({
          where: { currentClassroomId: m.to, status: 'ACTIVE', deletedAt: null },
        })
        const target = targets.find((t) => t.id === m.to)!
        if (capacity >= target.capacity) {
          skipped.push({ studentId: student.id, reason: `Target ${target.name} full (${capacity}/${target.capacity})` })
          continue
        }

        await db.$transaction(async (tx) => {
          await tx.studentAllocation.updateMany({
            where: { studentId: student.id, academicSessionId: fromSession.id, status: 'ACTIVE' },
            data: { status: 'PROMOTED', endedAt: new Date(), reason: 'Promoted to next academic year' },
          })
          await tx.studentAllocation.create({
            data: {
              tenantId: session.tenantId!,
              studentId: student.id,
              academicSessionId: toSession.id,
              classroomId: m.to,
              programType: target.programType,
              status: 'ACTIVE',
              startedAt: new Date(),
              reason: `Promoted from ${fromSession.name}`,
              createdById: session.uid,
              createdByName: session.name,
            },
          })
          await tx.student.update({ where: { id: student.id }, data: { currentClassroomId: m.to } })
        })

        promoted.push({
          studentId: student.id,
          name: `${student.firstName} ${student.lastName || ''}`.trim(),
          to: target.name,
        })

        await emit({
          type: 'StudentPromoted',
          tenantId: session.tenantId,
          studentId: student.id,
          fromSessionId: fromSession.id,
          toSessionId: toSession.id,
          toClassroomId: m.to,
        })
      }
    }

    await audit({
      tenantId: session.tenantId, actorId: session.uid, actorName: session.name,
      action: 'PROMOTE', entity: 'AcademicSession', entityId: id,
      summary: `Promotion ${fromSession.name} → ${toSession.name}: ${promoted.length} promoted, ${skipped.length} skipped`,
    })

    return ok({
      promotedCount: promoted.length,
      skippedCount: skipped.length,
      promoted,
      skipped,
    })
  } catch (e) {
    return Errors.system(e)
  }
}

export const POST = withApi(_POST)
