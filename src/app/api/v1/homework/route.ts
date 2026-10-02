import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { can } from '@/lib/auth'
import { getRequestMeta } from '@/lib/audit/audit-service'
import { db } from '@/lib/db'
import { HomeworkService } from '@/lib/homework/homework-service'

/** Resolves the linked student id for PARENT/GUARDIAN roles */
async function resolveLinkedStudentId(userId: string, tenantId: string): Promise<string | null> {
  const guardian = await db.guardian.findFirst({
    where: { tenantId, userId, deletedAt: null },
    include: { studentLinks: { select: { studentId: true }, take: 1 } },
  })
  return guardian?.studentLinks?.[0]?.studentId ?? null
}

async function _GET(req: NextRequest) {
  const session = await requireApi(req)
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const effectiveRoles = session.roles && session.roles.length > 0 ? session.roles : [session.role]
  const hasFull = can(effectiveRoles, 'homework:read')
  const hasLinked = can(effectiveRoles, 'homework:read-linked')
  if (!hasFull && !hasLinked) {
    return Errors.forbidden('Missing permission: homework:read or homework:read-linked')
  }
  try {
    const { searchParams } = new URL(req.url)
    if (hasFull) {
      const stats = searchParams.get('stats') === '1'
      if (stats) return ok(await HomeworkService.stats(session.tenantId))
      const homeworks = await HomeworkService.list(session.tenantId, {
        classroomId: searchParams.get('classroomId') || undefined,
        teacherId: searchParams.get('teacherId') || undefined,
        status: searchParams.get('status') || undefined,
        search: searchParams.get('search') || undefined,
      })
      return ok(homeworks)
    }
    // PARENT/GUARDIAN — child's submissions only
    const linked = await resolveLinkedStudentId(session.uid, session.tenantId)
    if (!linked) return ok([])
    const subs = await db.homeworkSubmission.findMany({
      where: { tenantId: session.tenantId, studentId: linked },
      include: {
        homework: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
            teacher: { select: { id: true, fullName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return ok(subs)
  } catch (err: any) {
    return bad(err.message, 'HOMEWORK_FETCH_FAILED')
  }
}

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'homework:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const body = await req.json()
    const meta = getRequestMeta(req)
    const homework = await HomeworkService.create(
      session.tenantId,
      body,
      { id: session.uid, name: session.name, role: session.role, ipAddress: meta.ipAddress, userAgent: meta.userAgent },
    )
    return ok(homework, undefined, 201)
  } catch (err: any) {
    return bad(err.message, 'HOMEWORK_CREATE_FAILED')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
