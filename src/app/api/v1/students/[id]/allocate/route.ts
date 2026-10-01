import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { classroomSeats } from '@/lib/capacity'
import { resolveSessionId } from '@/lib/academic'
import { raiseFollowUp } from '@/lib/followups'
import { audit } from '@/lib/sequence'
import { registerIntegrations } from '@/lib/integrations'

/**
 * POST /api/v1/students/{id}/allocate — academic allocation (Spec §10).
 * Body: { classroomId, reason?, dueDate? } — section change / transfer / promotion.
 *  · capacity guard (no silent overbooking)
 *  · closes previous ACTIVE StudentAllocation, opens new one (history preserved)
 *  · updates Student.currentClassroomId (live pointer)
 *  · raises STUDENT_ALLOC follow-up for records review when reason provided? — no:
 *    audited directly; follow-ups are for exceptions only.
 */
async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'students:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  registerIntegrations()

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { classroomId, reason } = body as { classroomId: string; reason?: string }
  if (!classroomId) return Errors.validation('classroomId is required')

  try {
    const student = await db.student.findFirst({
      where: { id, tenantId: session.tenantId, deletedAt: null },
      include: { currentClassroom: true },
    })
    if (!student) return Errors.notFound('Student')

    const target = await db.classroom.findFirst({
      where: { id: classroomId, tenantId: session.tenantId, isActive: true },
    })
    if (!target) return Errors.notFound('Target classroom')
    if (student.currentClassroomId === classroomId) {
      return Errors.conflict('Student is already allocated to this classroom')
    }

    const seats = await classroomSeats(classroomId)
    if (seats.available <= 0) {
      // visible exception — capacity problems surface to management (Spec §34)
      await raiseFollowUp({
        tenantId: session.tenantId,
        domain: 'ADMISSION',
        severity: 'WARNING',
        title: `Section full — allocation blocked (${target.name})`,
        detail: `Allocation of ${student.firstName} to ${target.name} blocked: ${seats.current}/${seats.capacity}. Waitlist or add capacity.`,
        sourceType: 'Allocation',
        sourceId: `${student.id}:${classroomId}`,
        dedupeKey: `allocfull:${student.id}:${classroomId}`,
        studentId: student.id,
        classroomId,
        responsibleRole: 'PRINCIPAL',
      })
      return Errors.business(
        'BUSINESS_CLASS_FULL',
        `Section ${target.name} is at full capacity (${seats.current}/${seats.capacity}). Waitlist or add capacity.`
      )
    }

    const now = new Date()
    const sessionRow = await resolveSessionId(session.tenantId, { classroomId })

    const result = await db.$transaction(async (tx) => {
      // close previous ACTIVE allocation (never overwrite history)
      if (student.currentClassroomId) {
        await tx.studentAllocation.updateMany({
          where: { studentId: student.id, status: 'ACTIVE' },
          data: {
            status: reason === 'TRANSFER' ? 'TRANSFERRED' : 'COMPLETED',
            endedAt: now,
            reason: reason ?? 'Section change',
          },
        })
      }

      const allocation = await tx.studentAllocation.create({
        data: {
          tenantId: session.tenantId!,
          studentId: student.id,
          academicSessionId: sessionRow?.id ?? target.academicSessionId,
          classroomId,
          programType: target.programType,
          status: 'ACTIVE',
          startedAt: now,
          reason: reason ?? 'Section allocation',
          createdById: session.uid,
          createdByName: session.name,
        },
      })

      const updated = await tx.student.update({
        where: { id: student.id },
        data: { currentClassroomId: classroomId },
      })

      return { allocation, updated }
    })

    await audit({
      tenantId: session.tenantId,
      actorId: session.uid,
      actorName: session.name,
      action: 'ALLOCATE',
      entity: 'StudentAllocation',
      entityId: result.allocation.id,
      summary: `${student.firstName} ${student.lastName || ''} → ${target.name}${reason ? ` (${reason})` : ''}`,
    })

    return ok({
      allocationId: result.allocation.id,
      classroom: target.name,
      programType: target.programType,
      seats: await classroomSeats(classroomId),
    })
  } catch (e) {
    return Errors.system(e)
  }
}

/** GET /api/v1/students/{id}/allocate — allocation history (never overwritten) */
async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'students:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params
  const student = await db.student.findFirst({ where: { id, tenantId: session.tenantId } })
  if (!student) return Errors.notFound('Student')

  const rows = await db.studentAllocation.findMany({
    where: { studentId: id },
    include: { classroom: { select: { name: true, code: true } }, academicSession: { select: { name: true } } },
    orderBy: { startedAt: 'desc' },
  })

  return ok({
    current: student.currentClassroomId,
    history: rows.map((r) => ({
      id: r.id, classroom: r.classroom.name, session: r.academicSession.name,
      programType: r.programType, status: r.status, startedAt: r.startedAt,
      endedAt: r.endedAt, reason: r.reason, by: r.createdByName,
    })),
  })
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
