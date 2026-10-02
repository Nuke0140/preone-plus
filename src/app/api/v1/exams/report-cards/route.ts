import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { can } from '@/lib/auth'
import { getRequestMeta } from '@/lib/audit/audit-service'
import { db } from '@/lib/db'
import { ExamsService } from '@/lib/exams/exam-service'

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
  const hasFull = can(effectiveRoles, 'exams:read')
  const hasLinked = can(effectiveRoles, 'exams:read-linked')
  if (!hasFull && !hasLinked) {
    return Errors.forbidden('Missing permission: exams:read or exams:read-linked')
  }
  try {
    const { searchParams } = new URL(req.url)
    let studentId = searchParams.get('studentId') || undefined
    let classroomId = searchParams.get('classroomId') || undefined
    let examId = searchParams.get('examId') || undefined

    if (!hasFull) {
      // PARENT/GUARDIAN — lock to own child's cards only
      const linked = await resolveLinkedStudentId(session.uid, session.tenantId)
      if (!linked) return ok([])
      studentId = linked
      classroomId = undefined
      examId = undefined
    }

    const cards = await ExamsService.listReportCards(session.tenantId, { examId, classroomId, studentId })
    return ok(cards)
  } catch (err: any) {
    return bad(err.message, 'REPORT_CARDS_FETCH_FAILED')
  }
}

/** POST — generate report cards for an exam + classroom (staff only) */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'exams:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  try {
    const body = await req.json()
    if (!body.examId || !body.classroomId) return Errors.validation('examId and classroomId are required')
    const meta = getRequestMeta(req)
    const result = await ExamsService.generateReportCards(
      session.tenantId, body.examId, body.classroomId,
      { id: session.uid, name: session.name, role: session.role, ipAddress: meta.ipAddress, userAgent: meta.userAgent },
    )
    return ok(result, undefined, 201)
  } catch (err: any) {
    return bad(err.message, 'REPORT_CARDS_GENERATE_FAILED')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
