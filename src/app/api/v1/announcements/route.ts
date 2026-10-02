import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { audit } from '@/lib/sequence'

/** GET /api/v1/announcements — list broadcasts */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'communication:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const announcements = await db.announcement.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { publishedAt: 'desc' },
      take: 50,
    })
    return ok(announcements)
  } catch (e) {
    return Errors.system(e)
  }
}

/** POST /api/v1/announcements — broadcast (communication:broadcast) */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'communication:broadcast')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { title, body: text, type, audience, classroomId } = body as {
      title: string
      body: string
      type?: 'GENERAL' | 'HOLIDAY' | 'EMERGENCY' | 'EVENT' | 'ACHIEVEMENT' | 'IMPORTANT' | 'FEE_REMINDER' | 'ACADEMIC'
      audience?: 'ALL_PARENTS' | 'BRANCH_PARENTS' | 'CLASS_PARENTS' | 'ALL_STAFF' | 'SCHOOL_WIDE'
      classroomId?: string
    }
    if (!title || !text) return Errors.validation('title and body are required')

    const announcement = await db.announcement.create({
      data: {
        tenantId: session.tenantId,
        title,
        body: text,
        type: type || 'GENERAL',
        audience: audience || 'SCHOOL_WIDE',
        classroomId: audience === 'CLASS_PARENTS' ? classroomId || null : null,
        authorId: session.uid,
        status: 'PUBLISHED',
      },
    })

    // fan out to parent timelines for school-wide/class audience
    if (audience !== 'ALL_STAFF') {
      const students = await db.student.findMany({
        where: {
          tenantId: session.tenantId,
          status: 'ACTIVE',
          deletedAt: null,
          ...(audience === 'CLASS_PARENTS' && classroomId ? { currentClassroomId: classroomId } : {}),
        },
        select: { id: true },
        take: 500,
      })
      await db.timelineEntry.createMany({
        data: students.map((s) => ({
          tenantId: session.tenantId!,
          studentId: s.id,
          type: 'NOTE',
          title: `Announcement: ${title}`,
          body: text,
        })),
      })
    }

    await audit({
      tenantId: session.tenantId,
      actorId: session.uid,
      actorName: session.name,
      action: 'CREATE',
      entity: 'Announcement',
      entityId: announcement.id,
      summary: `Broadcast "${title}" to ${audience || 'SCHOOL_WIDE'}`,
    })

    return ok({ announcementId: announcement.id }, undefined, 201)
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
