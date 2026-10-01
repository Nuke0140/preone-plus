import { can } from '@/lib/auth'
import { getSession } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { DashboardClient } from './DashboardClient'
import { TeacherToday } from './TeacherToday'
import { ParentToday } from './ParentToday'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session?.tenantId) return null

  const tenantId = session.tenantId

  // M00 — first-login handoff: incomplete setup takes priority over the dashboard
  if (session.role === 'OWNER' || session.role === 'PRINCIPAL') {
    const setup = await db.schoolSetup.findUnique({ where: { tenantId }, select: { status: true } })
    if (setup && setup.status !== 'LIVE') redirect('/app/setup')
  }

  // M01 — role-specific action boards consume the dedicated read-model APIs
  // (teacher sees actions not config tables §11; parent is child-centric §21/§41)
  if (session.role === 'TEACHER') return <TeacherToday />
  if (session.role === 'PARENT') return <ParentToday />

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [activeStudents, presentToday, invoices, pendingApps, newLeads, classrooms, recentAudit] =
    await Promise.all([
      db.student.count({ where: { tenantId, status: 'ACTIVE', deletedAt: null } }),
      db.attendance.count({
        where: { tenantId, date: today, status: { in: ['PRESENT', 'LATE', 'HALF_DAY'] } },
      }),
      db.invoice.findMany({
        where: { tenantId, deletedAt: null },
        select: { totalCents: true, paidCents: true, balanceCents: true, status: true, dueDate: true },
      }),
      db.admissionApplication.count({
        where: { tenantId, status: { in: ['SUBMITTED', 'DOCUMENT_PENDING', 'VERIFIED', 'UNDER_REVIEW'] } },
      }),
      db.lead.count({ where: { tenantId, status: { in: ['NEW', 'CONTACTED'] }, deletedAt: null } }),
      db.classroom.findMany({
        where: { tenantId, isActive: true },
        include: { _count: { select: { students: true } } },
        orderBy: { name: 'asc' },
      }),
      db.auditLog.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 8 }),
    ])

  const billed = invoices.reduce((s, i) => s + i.totalCents, 0)
  const collected = invoices.reduce((s, i) => s + i.paidCents, 0)
  const overdue = invoices
    .filter((i) => i.status === 'OVERDUE' || (i.status === 'ISSUED' && i.dueDate < new Date()))
    .reduce((s, i) => s + i.balanceCents, 0)

  // 7-day attendance trend
  const trend = await Promise.all(
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
        label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        pct: total > 0 ? Math.round((present / total) * 100) : 0,
      }
    })
  )

  return (
    <DashboardClient
      role={session.role}
      perms={{
        students: can(session.role, 'students:read'),
        admissions: can(session.role, 'admissions:read'),
        finance: can(session.role, 'finance:read'),
        attendance: can(session.role, 'attendance:read'),
      }}
      data={{
        activeStudents,
        presentToday,
        attendancePct: activeStudents > 0 ? Math.round((presentToday / activeStudents) * 100) : 0,
        billed,
        collected,
        overdue,
        collectRate: billed > 0 ? Math.round((collected / billed) * 100) : 0,
        pendingApps,
        newLeads,
        classrooms: classrooms.map((c) => ({
          name: c.name,
          programType: c.programType,
          students: c._count.students,
          capacity: c.capacity,
        })),
        trend,
        recentActivity: recentAudit.map((a) => ({
          summary: a.summary || `${a.action} ${a.entity}`,
          actor: a.actorName,
          at: a.createdAt.toISOString(),
        })),
      }}
    />
  )
}
