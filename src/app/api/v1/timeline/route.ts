import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'

/** GET /api/v1/timeline — parent timeline or classroom feed (API Catalog §18) */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'timeline:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const sp = req.nextUrl.searchParams
    let studentId = sp.get('studentId')

    let childrenIds: string[] | null = null
    if (session.role === 'PARENT') {
      const guardians = await db.guardian.findMany({
        where: { userId: session.uid, tenantId: session.tenantId },
        include: { studentLinks: { select: { studentId: true } } },
      })
      childrenIds = guardians.flatMap((g) => g.studentLinks.map((l) => l.studentId))
      if (studentId && childrenIds && !childrenIds.includes(studentId)) {
        return Errors.forbidden('You can only view your own child')
      }
      studentId = null // show all children
    }

    const entries = await db.timelineEntry.findMany({
      where: {
        tenantId: session.tenantId,
        ...(studentId ? { studentId } : {}),
        ...(childrenIds !== null ? { studentId: { in: childrenIds } } : {}),
      },
      include: {
        student: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
    })

    return ok(
      entries.map((e) => ({
        id: e.id,
        type: e.type,
        title: e.title,
        body: e.body,
        mediaUrl: e.mediaUrl,
        mood: e.mood,
        activityType: e.activityType,
        mealType: e.mealType,
        napDurationMin: e.napDurationMin,
        incidentSeverity: e.incidentSeverity,
        createdAt: e.createdAt,
        childName: `${e.student.firstName} ${e.student.lastName || ''}`.trim(),
      }))
    )
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
