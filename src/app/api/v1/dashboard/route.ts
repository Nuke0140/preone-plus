import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { isoDate } from '@/lib/format'

/** GET /api/v1/dashboard — role-scoped KPIs (PRD Reports & Analytics). */
async function _GET(req: NextRequest) {
  const session = await requireApi(req)
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const tenantId = session.tenantId
    const today = new Date(isoDate())

    const [totalStudents, activeStudents, presentToday, totalClasses, staffCount] =
      await Promise.all([
        db.student.count({ where: { tenantId, deletedAt: null } }),
        db.student.count({ where: { tenantId, deletedAt: null, status: 'ACTIVE' } }),
        db.attendance.count({
          where: { tenantId, date: today, status: { in: ['PRESENT', 'LATE', 'HALF_DAY'] } },
        }),
        db.classroom.count({ where: { tenantId, isActive: true } }),
        db.tenantUser.count({ where: { tenantId, role: { not: 'PARENT' }, deletedAt: null } }),
      ])

    // fee aggregation
    const invoices = await db.invoice.findMany({
      where: { tenantId, deletedAt: null },
      select: { totalCents: true, paidCents: true, balanceCents: true, dueDate: true, status: true },
    })
    const billed = invoices.reduce((s, i) => s + i.totalCents, 0)
    const collected = invoices.reduce((s, i) => s + i.paidCents, 0)
    const overdue = invoices
      .filter((i) => i.status === 'OVERDUE' || (i.status === 'ISSUED' && i.dueDate < new Date()))
      .reduce((s, i) => s + i.balanceCents, 0)
    const collectRate = billed > 0 ? Math.round((collected / billed) * 100) : 0

    const [pendingAdmissions, newLeads, unreadAnnouncements] = await Promise.all([
      db.admissionApplication.count({
        where: { tenantId, status: { in: ['SUBMITTED', 'DOCUMENT_PENDING', 'VERIFIED', 'UNDER_REVIEW'] } },
      }),
      db.lead.count({ where: { tenantId, status: { in: ['NEW', 'CONTACTED'] }, deletedAt: null } }),
      db.announcement.count({
        where: { tenantId, publishedAt: { gte: new Date(Date.now() - 7 * 864e5) } },
      }),
    ])

    // 7-day attendance trend
    const trendDays = await Promise.all(
      Array.from({ length: 7 }).map(async (_, i) => {
        const d = new Date(today)
        d.setDate(d.getDate() - (6 - i))
        const [present, total] = await Promise.all([
          db.attendance.count({
            where: { tenantId, date: d, status: { in: ['PRESENT', 'LATE', 'HALF_DAY'] } },
          }),
          db.attendance.count({ where: { tenantId, date: d } }),
        ])
        return {
          date: d.toISOString().slice(0, 10),
          label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
          present,
          total,
          pct: total > 0 ? Math.round((present / total) * 100) : 0,
        }
      })
    )

    // recent activity — audit + announcements merged
    const recentAudit = await db.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 6,
    })

    const classrooms = await db.classroom.findMany({
      where: { tenantId, isActive: true },
      include: { _count: { select: { students: true } } },
      orderBy: { name: 'asc' },
    })

    return ok({
      students: { total: totalStudents, active: activeStudents },
      presentToday,
      attendancePct: activeStudents > 0 ? Math.round((presentToday / activeStudents) * 100) : 0,
      classes: totalClasses,
      staff: staffCount,
      fees: { billed, collected, overdue, collectRate },
      admissions: { pending: pendingAdmissions, newLeads },
      announcements: unreadAnnouncements,
      trend: trendDays,
      classrooms: classrooms.map((c) => ({
        id: c.id, name: c.name, programType: c.programType, students: c._count.students,
      })),
      recentActivity: recentAudit.map((a) => ({
        id: a.id, action: a.action, entity: a.entity, summary: a.summary,
        actor: a.actorName, at: a.createdAt,
      })),
    })
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
