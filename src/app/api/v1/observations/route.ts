import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { audit } from '@/lib/sequence'
import { getDomainConfig, getCurriculum } from '@/lib/config'
import { resolveSessionId } from '@/lib/academic'
import { emit } from '@/lib/events'
import { registerIntegrations } from '@/lib/integrations'

/** GET /api/v1/observations — list (teacher sees own; principal sees all) */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'academics:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const observations = await db.observation.findMany({
      where: {
        tenantId: session.tenantId,
        ...(session.role === 'TEACHER' ? { teacherId: session.uid } : {}),
      },
      include: {
        student: { select: { firstName: true, lastName: true, admissionNo: true } },
        classroom: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
    })
    return ok(
      observations.map((o) => ({
        id: o.id,
        studentName: `${o.student.firstName} ${o.student.lastName || ''}`.trim(),
        studentId: o.studentId,
        classroom: o.classroom?.name ?? null,
        narrative: o.narrative,
        milestoneTags: o.milestoneTags,
        category: o.category,
        concern: o.concern,
        status: o.status,
        observedAt: o.observedAt,
        publishedAt: o.publishedAt,
      }))
    )
  } catch (e) {
    return Errors.system(e)
  }
}

/** POST /api/v1/observations — record observation (min 20 chars per PRD)
 *  M01 learning loop (Spec §17-19): category (CURRICULUM learning areas) +
 *  deterministic concern triage (NORMAL/PROGRESS/NEEDS_ATTENTION/URGENT — never
 *  a diagnosis). NEEDS_ATTENTION/URGENT → Learning follow-up via event seam. */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'academics:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  registerIntegrations()

  try {
    const body = await req.json()
    const { studentId, narrative, milestoneTags, category, concern } = body as {
      studentId: string
      narrative: string
      milestoneTags?: string
      category?: string
      concern?: 'NORMAL' | 'PROGRESS' | 'NEEDS_ATTENTION' | 'URGENT'
    }
    if (!studentId || !narrative) {
      return Errors.validation('studentId and narrative are required')
    }
    if (narrative.trim().length < 20) {
      return Errors.validation('Observation narrative must be at least 20 characters', 'narrative')
    }
    if (concern && !['NORMAL', 'PROGRESS', 'NEEDS_ATTENTION', 'URGENT'].includes(concern)) {
      return Errors.validation('concern must be NORMAL, PROGRESS, NEEDS_ATTENTION or URGENT')
    }

    const student = await db.student.findFirst({
      where: { id: studentId, tenantId: session.tenantId },
    })
    if (!student) return Errors.notFound('Student')

    // category validated against CURRICULUM config learning areas (when provided)
    if (category) {
      const curriculum = getCurriculum(await getDomainConfig(session.tenantId, 'CURRICULUM'))
      const areas: string[] = curriculum.learningAreas || []
      if (areas.length > 0 && !areas.includes(category)) {
        return Errors.validation(`category must be one of the configured learning areas: ${areas.join(', ')}`)
      }
    }

    const sessionRow = await resolveSessionId(session.tenantId, { classroomId: student.currentClassroomId })

    const observation = await db.observation.create({
      data: {
        tenantId: session.tenantId,
        studentId,
        classroomId: student.currentClassroomId,
        teacherId: session.uid,
        narrative: narrative.trim(),
        milestoneTags: milestoneTags || null,
        category: category || null,
        concern: concern || 'NORMAL',
        learningGoalId: body.learningGoalId || null,
        activityId: body.activityId || null,
        status: 'DRAFT',
        academicSessionId: sessionRow?.id,
      },
    })

    // learning loop: observation → action → outcome (via follow-up engine)
    if (concern === 'NEEDS_ATTENTION' || concern === 'URGENT') {
      await emit({
        type: 'ObservationRecorded',
        tenantId: session.tenantId,
        studentId,
        observationId: observation.id,
        concern,
        category: category || null,
        title: concern === 'URGENT' ? `Urgent learning concern — ${student.firstName}` : `Learning attention needed — ${student.firstName}`,
        detail: narrative.trim().slice(0, 280),
      })
    }

    await audit({
      tenantId: session.tenantId,
      actorId: session.uid,
      actorName: session.name,
      action: 'CREATE',
      entity: 'Observation',
      entityId: observation.id,
      summary: `Observation recorded for ${student.firstName}${category ? ` [${category}]` : ''}${concern && concern !== 'NORMAL' ? ` — ${concern}` : ''}`,
    })

    return ok({ observationId: observation.id, concern: concern || 'NORMAL' }, undefined, 201)
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
