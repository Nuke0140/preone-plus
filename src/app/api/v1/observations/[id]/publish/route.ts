import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { audit } from '@/lib/sequence'

/**
 * POST /api/v1/observations/{id}/publish — teacher approves & publishes
 * → fans out to parent timeline (PRD: "one data entry → three outputs").
 */
async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'academics:write')
  if (isResponse(session)) return session
  const { id } = await params

  try {
    const observation = await db.observation.findUnique({
      where: { id },
      include: { student: true },
    })
    if (!observation) return Errors.notFound('Observation')
    if (observation.status === 'PUBLISHED') {
      return Errors.conflict('Observation already published')
    }
    if (session.role === 'TEACHER' && observation.teacherId !== session.uid) {
      return Errors.forbidden('You can only publish your own observations')
    }

    const published = await db.$transaction(async (tx) => {
      await tx.observation.update({
        where: { id },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      })
      const entry = await tx.timelineEntry.create({
        data: {
          tenantId: session.tenantId!,
          studentId: observation.studentId,
          classroomId: observation.classroomId,
          type: 'OBSERVATION',
          title: 'Learning Observation',
          body: observation.narrative,
          authorId: session.uid,
          observationId: observation.id,
        },
      })
      return entry
    })

    await audit({
      tenantId: session.tenantId,
      actorId: session.uid,
      actorName: session.name,
      action: 'PUBLISH',
      entity: 'Observation',
      entityId: id,
      summary: `Observation published to parents of ${observation.student.firstName}`,
    })

    return ok({ timelineEntryId: published.id })
  } catch (e) {
    return Errors.system(e)
  }
}

export const POST = withApi(_POST)
