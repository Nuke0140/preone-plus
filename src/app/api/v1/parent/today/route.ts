import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { isoDate } from '@/lib/format'

/**
 * GET /api/v1/parent/today — "How is my child doing today?" (Spec §21/§41).
 * Child-centric: TODAY (safety/attendance/care) + attention items + fees.
 * Guardian scoping: parent sees ONLY linked children; internal staff notes
 * (FollowUp detail, internal observations in DRAFT) never leak.
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'timeline:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const tenantId = session.tenantId
    const today = isoDate()
    const todayDate = new Date(today)

    const guardians = await db.guardian.findMany({
      where: { userId: session.uid, tenantId, deletedAt: null },
      include: {
        studentLinks: {
          include: {
            student: {
              select: {
                id: true, firstName: true, lastName: true, admissionNo: true, photoUrl: true,
                currentClassroom: { select: { id: true, name: true, primaryTeacher: { select: { fullName: true } } } },
              },
            },
          },
        },
      },
    })

    const childrenIds = guardians.flatMap((g) => g.studentLinks.map((l) => l.student.id))
    if (childrenIds.length === 0) return ok({ children: [], today })

    const attendance = await db.attendance.findMany({
      where: { tenantId, date: todayDate, studentId: { in: childrenIds } },
      select: { studentId: true, status: true },
    })
    const careToday = await db.timelineEntry.findMany({
      where: {
        tenantId, studentId: { in: childrenIds },
        createdAt: { gte: todayDate },
        type: { in: ['ARRIVAL', 'MEAL', 'NAP', 'BATHROOM', 'ACTIVITY', 'NOTE', 'MILESTONE', 'PICKUP'] },
      },
      orderBy: { createdAt: 'asc' },
      select: { studentId: true, type: true, title: true, body: true, mood: true, createdAt: true },
    })

    // latest PUBLISHED teacher updates (observations) — parent-appropriate only
    const updates = await db.observation.findMany({
      where: { tenantId, studentId: { in: childrenIds }, status: 'PUBLISHED' },
      orderBy: { observedAt: 'desc' },
      take: 10,
      select: { studentId: true, narrative: true, observedAt: true, category: true },
    })

    // fees: only what the parent needs — outstanding per child
    const invoices = await db.invoice.findMany({
      where: { tenantId, studentId: { in: childrenIds }, deletedAt: null, status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] } },
      select: { studentId: true, invoiceNumber: true, dueDate: true, balanceCents: true, status: true },
    })

    // health/safety flags the parent must know about — RESOLVED ones excluded
    const alerts = await db.followUp.findMany({
      where: {
        tenantId, studentId: { in: childrenIds },
        domain: { in: ['HEALTH', 'SAFETY'] },
        status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'WAITING'] },
      },
      select: { studentId: true, title: true, severity: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    const shapeChild = (s: (typeof guardians)[number]['studentLinks'][number]['student']) => ({
      id: s.id,
      name: `${s.firstName} ${s.lastName || ''}`.trim(),
      admissionNo: s.admissionNo,
      photoUrl: s.photoUrl,
      classroom: s.currentClassroom?.name ?? null,
      teacher: s.currentClassroom?.primaryTeacher?.fullName ?? null,
      attendance: attendance.find((a) => a.studentId === s.id)?.status ?? null,
      todayCare: careToday
        .filter((c) => c.studentId === s.id)
        .map((c) => ({ type: c.type, title: c.title, body: c.body, mood: c.mood, at: c.createdAt })),
      latestUpdate: updates.find((u) => u.studentId === s.id) ?? null,
      feesDue: invoices
        .filter((i) => i.studentId === s.id)
        .map((i) => ({ invoiceNumber: i.invoiceNumber, dueDate: i.dueDate, balanceCents: i.balanceCents, status: i.status })),
      alerts: alerts
        .filter((a) => a.studentId === s.id)
        .map((a) => ({ title: a.title, severity: a.severity, createdAt: a.createdAt })),
    })

    return ok({
      today,
      children: guardians.flatMap((g) => g.studentLinks.map((l) => shapeChild(l.student))),
    })
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
