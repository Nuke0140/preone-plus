/**
 * PreOne — M03 Admission Analytics Service (Server-Side Aggregation)
 *
 * Design principles (Modern Schools Edition):
 * 1. Single Source of Truth: every number is aggregated from the live database
 *    via Prisma (never derived from client-side page state or paginated lists).
 * 2. Zero Hardcoding: source catalogue, program labels and stage semantics are
 *    derived from the canonical enums / services — UI renders whatever the API
 *    returns, so adding a new LeadSource in Prisma instantly appears in reports.
 * 3. Real-School Semantics: stages mirror how admissions actually happen on the
 *    ground — enquiry → parent conversation → campus visit → program/age fit →
 *    application → documents → child-parent meeting → decision → offer →
 *    parent acceptance → classroom placement → enrollment.
 * 4. Cross-Module Connectivity: enrollment trends read from Students
 *    (admissionDate), capacity from Classrooms + live Student occupancy,
 *    offers from AdmissionOffer, counsellor names from Users — analytics is a
 *    joined view across modules, not an admissions-only island.
 * 5. Tenant-safe: every query is scoped by tenantId (+ optional branchId /
 *    programType / date range).
 */

import { db } from '@/lib/db'
import { CANONICAL_LEAD_SOURCES } from '@/lib/admissions/lead-service'
import { LeadSource, ProgramType, LeadStatus, ApplicationStatus } from '@prisma/client'

// ── Public types ─────────────────────────────────────────────────────────────

export interface AnalyticsFilters {
  from?: Date
  to?: Date
  branchId?: string
  programType?: string
}

export interface FunnelStage {
  step: number
  key: string
  label: string
  count: number
  dropFromPrevious: number
  conversionFromPrevious: number // percentage 0-100 (100 for first stage)
  conversionFromStart: number
}

export interface MonthTrendPoint {
  month: string // YYYY-MM
  label: string // e.g. "Oct 26"
  enquiries: number
  enrollments: number
}

export interface SourceRoiRow {
  source: string
  leads: number
  applications: number
  enrolled: number
  conversionRate: number // leads → enrolled %
  avgDaysToConvert: number | null
}

export interface CounsellorRow {
  userId: string
  name: string
  assigned: number
  converted: number
  followUpsDue: number
  conversionRate: number
}

export interface AgingBucket {
  bucket: string
  count: number
}

export interface StuckApplication {
  id: string
  applicationNumber: string
  childName: string
  programType: string
  status: string
  daysInStage: number
}

export interface OfferInsights {
  total: number
  issued: number
  accepted: number
  declined: number
  expired: number
  cancelled: number
  acceptanceRate: number
  avgHoursToAccept: number | null
  declineReasons: { reason: string; count: number }[]
}

export interface ProgramCapacityRow {
  programType: string
  label: string
  sections: number
  capacity: number
  enrolled: number
  availableSeats: number
  pipelineActive: number
  waitlisted: number
  projectedFillPercent: number
}

export interface SpeedMetrics {
  avgFirstResponseHours: number | null
  visitsScheduled: number
  visitsCompleted: number
  visitsMissed: number
  visitNoShowRate: number
  followUpsDueToday: number
}

export interface LostReasonRow {
  reason: string
  count: number
}

export interface AdmissionsAnalytics {
  range: { from: string; to: string }
  filters: { branchId?: string; programType?: string }
  funnel: FunnelStage[]
  monthlyTrends: MonthTrendPoint[]
  sourceRoi: SourceRoiRow[]
  counsellorBoard: CounsellorRow[]
  aging: AgingBucket[]
  stuckApplications: StuckApplication[]
  offerInsights: OfferInsights
  capacityForecast: ProgramCapacityRow[]
  speedMetrics: SpeedMetrics
  lostReasons: LostReasonRow[]
  sources: string[]
  totals: {
    leads: number
    applications: number
    enrolled: number
    leadToEnrollRate: number
  }
}

// ── Constants ────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000

const PROGRAM_LABELS: Record<string, string> = {
  PLAYGROUP: 'Playgroup',
  NURSERY: 'Nursery',
  JR_KG: 'Jr. KG',
  SR_KG: 'Sr. KG',
  DAYCARE: 'Daycare',
  GRADE_1: 'Grade 1',
  GRADE_2: 'Grade 2',
  GRADE_3: 'Grade 3',
  GRADE_4: 'Grade 4',
  GRADE_5: 'Grade 5',
  GRADE_6: 'Grade 6',
  GRADE_7: 'Grade 7',
  GRADE_8: 'Grade 8',
}

function programLabel(pt: string): string {
  return PROGRAM_LABELS[pt] ?? pt.replace(/_/g, ' ')
}

const L = LeadStatus
const A = ApplicationStatus

/** Lead statuses that mean conversation has started */
const CONVERSATION_STATUSES: LeadStatus[] = [L.CONTACTED, L.QUALIFIED, L.NURTURE, L.APPLICATION_STARTED, L.CONVERTED]
/** Lead statuses that mean qualified beyond first contact */
const QUALIFIED_STATUSES: LeadStatus[] = [L.QUALIFIED, L.NURTURE, L.APPLICATION_STARTED, L.CONVERTED]
/** Statuses representing "admission decision has been made" */
const DECISION_STATUSES: ApplicationStatus[] = [A.APPROVED, A.WAITLISTED, A.REJECTED, A.OFFER_SENT, A.OFFER_ACCEPTED, A.ENROLLED, A.ADMITTED]
/** Statuses from offer stage onwards */
const OFFER_STATUSES: ApplicationStatus[] = [A.OFFER_SENT, A.OFFER_ACCEPTED, A.ENROLLED, A.ADMITTED]
/** Statuses from parent acceptance onwards */
const ACCEPTANCE_STATUSES: ApplicationStatus[] = [A.OFFER_ACCEPTED, A.ENROLLED, A.ADMITTED]
/** Terminal success */
const ENROLLED_STATUSES: ApplicationStatus[] = [A.ENROLLED, A.ADMITTED]
/** Meeting stage reached (child & parent interaction) */
const MEETING_STATUSES: ApplicationStatus[] = [A.COUNSELLING, A.COUNSELLING_SCHEDULED, A.COUNSELLING_COMPLETED, A.UNDER_REVIEW, A.PENDING_APPROVAL, ...DECISION_STATUSES]
/** Active (non-terminal) application statuses for aging analysis */
const ACTIVE_PIPELINE_STATUSES: ApplicationStatus[] = [A.SUBMITTED, A.DOCUMENT_PENDING, A.DOCUMENT_REVIEW, A.VERIFIED, A.COUNSELLING, A.COUNSELLING_SCHEDULED, A.COUNSELLING_COMPLETED, A.UNDER_REVIEW, A.PENDING_APPROVAL, A.APPROVED, A.OFFER_SENT, A.OFFER_ACCEPTED, A.WAITLISTED]
/** Forward-looking pipeline statuses for capacity forecast */
const FORECAST_PIPELINE_STATUSES: ApplicationStatus[] = ACTIVE_PIPELINE_STATUSES.filter((s) => s !== A.WAITLISTED)
/** Application-started lead statuses */
const APPLICATION_STARTED_LEAD_STATUSES: LeadStatus[] = [L.CONVERTED, L.APPLICATION_STARTED]
/** Terminal lead statuses (no more follow-up needed) */
const TERMINAL_LEAD_STATUSES: LeadStatus[] = [L.CONVERTED, L.LOST, L.DUPLICATE]

// ── Helpers ──────────────────────────────────────────────────────────────────

function pct(part: number, whole: number): number {
  if (!whole) return 0
  return Math.round((part / whole) * 1000) / 10
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${names[m - 1]} ${String(y).slice(2)}`
}

/** Last 12 month keys ending with the current month */
function last12MonthKeys(): string[] {
  const keys: string[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(monthKey(d))
  }
  return keys
}

// ── Service ──────────────────────────────────────────────────────────────────

export class AdmissionsAnalyticsService {
  /**
   * Aggregates the full admissions analytics payload for a tenant.
   * All figures are computed server-side from live data.
   */
  static async getAnalytics(tenantId: string, filters: AnalyticsFilters = {}): Promise<AdmissionsAnalytics> {
    const to = filters.to ?? new Date()
    const from = filters.from ?? new Date(to.getFullYear(), to.getMonth() - 11, 1)
    const branchId = filters.branchId || undefined
    const programType = (filters.programType as ProgramType) || undefined

    // Base lead/application where clauses (tenant + range + optional scope)
    const leadWhere = {
      tenantId,
      deletedAt: null,
      createdAt: { gte: from, lte: to },
      ...(branchId ? { branchId } : {}),
      ...(programType ? { interestedProgram: programType } : {}),
    }
    const appWhere = {
      tenantId,
      deletedAt: null,
      createdAt: { gte: from, lte: to },
      ...(branchId ? { branchId } : {}),
      ...(programType ? { programType } : {}),
    }

    // Fire independent aggregations concurrently for performance
    const [
      leadStatusGroups,
      leadSourceGroups,
      leadSourceStatusGroups,
      rangeLeads,
      appStatusRows,
      visitLeadIds,
      docAppIds,
      appPlacementCount,
      convertedLeads,
      appByLead,
      counsellorGroups,
      counsellorUsers,
      dueFollowUpGroups,
      activeApps,
      offerGroups,
      declinedOffers,
      acceptedOffers,
      classrooms,
      forecastGroups,
      waitlistGroups,
      enrolledStudents,
      enquiryFollowUps,
      visitFollowUps,
      lostAudits,
    ] = await Promise.all([
      // 1. Lead status distribution (in range)
      db.lead.groupBy({ by: ['status'], where: leadWhere, _count: { _all: true } }),
      // 2. Leads grouped by source
      db.lead.groupBy({ by: ['source'], where: leadWhere, _count: { _all: true } }),
      // 3. Leads grouped by source × status (application-started / converted per source)
      db.lead.groupBy({ by: ['source', 'status'], where: leadWhere, _count: { _all: true } }),
      // 4. Range leads — ids + timestamps (month trends, visit scoping, response time)
      db.lead.findMany({ where: leadWhere, select: { id: true, createdAt: true } }),
      // 5. Application status distribution (in range)
      db.admissionApplication.groupBy({ by: ['status'], where: appWhere, _count: { _all: true } }),
      // 6. Distinct lead ids with a completed school visit
      db.followUp.findMany({
        where: { tenantId, sourceType: 'SchoolVisit', sourceId: { not: null }, status: { in: ['RESOLVED', 'CLOSED'] } },
        select: { sourceId: true },
        distinct: ['sourceId'],
      }),
      // 7. Distinct application ids having at least one document (range-scoped)
      db.applicationDocument.findMany({
        where: { application: appWhere },
        select: { applicationId: true },
        distinct: ['applicationId'],
      }),
      // 8. Placed applications (classroom assigned) among acceptance-stage ones
      db.admissionApplication.count({
        where: { ...appWhere, status: { in: ACCEPTANCE_STATUSES }, classroomId: { not: null } },
      }),
      // 9. Converted leads with source + link to application (ROI timing)
      db.lead.findMany({
        where: { ...leadWhere, status: 'CONVERTED' },
        select: { id: true, source: true, createdAt: true, convertedApplicationId: true },
      }),
      // 10. Minimal application map for lead → application joins
      db.admissionApplication.findMany({
        where: { tenantId, deletedAt: null, leadId: { not: null } },
        select: { id: true, leadId: true, status: true, createdAt: true },
      }),
      // 11. Leads grouped by assigned counsellor
      db.lead.groupBy({
        by: ['assignedToId'],
        where: { ...leadWhere, assignedToId: { not: null } },
        _count: { _all: true },
      }),
      // 12. Counsellor user names
      db.user.findMany({
        where: { memberships: { some: { tenantId } } },
        select: { id: true, fullName: true },
      }),
      // 13. Overdue follow-ups grouped by lead (today or earlier, still open)
      db.followUp.groupBy({
        by: ['sourceId'],
        where: {
          tenantId,
          sourceType: { in: ['EnquiryFollowUp', 'SchoolVisit'] },
          status: { in: ['OPEN', 'ACKNOWLEDGED', 'WAITING'] },
          OR: [{ dueAt: { lte: new Date() } }, { dueAt: null }],
        },
        _count: { _all: true },
      }),
      // 14. Active pipeline applications (aging analysis, oldest first)
      db.admissionApplication.findMany({
        where: { ...appWhere, status: { in: ACTIVE_PIPELINE_STATUSES } },
        select: { id: true, applicationNumber: true, childFirstName: true, childLastName: true, programType: true, status: true, updatedAt: true },
        orderBy: { updatedAt: 'asc' },
        take: 200,
      }),
      // 15. Offers grouped by status
      db.admissionOffer.groupBy({
        by: ['status'],
        where: { tenantId, application: { tenantId, deletedAt: null } },
        _count: { _all: true },
      }),
      // 16. Declined offers with reasons
      db.admissionOffer.findMany({
        where: { tenantId, status: 'DECLINED', declineReason: { not: null } },
        select: { declineReason: true },
      }),
      // 17. Accepted offers with timing
      db.admissionOffer.findMany({
        where: { tenantId, status: 'ACCEPTED', issuedAt: { not: null }, acceptedAt: { not: null } },
        select: { issuedAt: true, acceptedAt: true },
      }),
      // 18. Active classrooms with live occupancy (Students module connectivity)
      db.classroom.findMany({
        where: { tenantId, isActive: true, ...(branchId ? { branchId } : {}), ...(programType ? { programType } : {}) },
        select: {
          id: true,
          programType: true,
          capacity: true,
          _count: { select: { students: { where: { status: 'ACTIVE', deletedAt: null } } } },
        },
      }),
      // 19. Forward-looking pipeline grouped by program (session-wide, not range-bound)
      db.admissionApplication.groupBy({
        by: ['programType'],
        where: {
          tenantId,
          deletedAt: null,
          status: { in: FORECAST_PIPELINE_STATUSES },
          ...(branchId ? { branchId } : {}),
          ...(programType ? { programType } : {}),
        },
        _count: { _all: true },
      }),
      // 20. Waitlist depth grouped by program
      db.admissionApplication.groupBy({
        by: ['programType'],
        where: { tenantId, deletedAt: null, status: 'WAITLISTED', ...(branchId ? { branchId } : {}), ...(programType ? { programType } : {}) },
        _count: { _all: true },
      }),
      // 21. Real enrollments (Students module admission dates, last 12 months)
      db.student.findMany({
        where: {
          tenantId,
          deletedAt: null,
          admissionDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1) },
          ...(branchId ? { branchId } : {}),
          ...(programType ? { currentClassroom: { programType } } : {}),
        },
        select: { admissionDate: true },
      }),
      // 22. First-response follow-ups per lead (speed metric)
      db.followUp.findMany({
        where: { tenantId, sourceType: 'EnquiryFollowUp', sourceId: { not: null } },
        select: { sourceId: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      // 23. All school-visit follow-ups (scheduled vs completed vs missed)
      db.followUp.findMany({
        where: { tenantId, sourceType: 'SchoolVisit', sourceId: { not: null } },
        select: { sourceId: true, status: true, dueAt: true },
      }),
      // 24. Lost-reason audit trail (immutable)
      db.auditLog.findMany({
        where: { tenantId, entity: 'Lead', action: { contains: 'LOST' } },
        select: { newValues: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    ])

    // ── Index helpers ────────────────────────────────────────────────────────
    const leadStatusCount = (statuses: string[]): number =>
      leadStatusGroups.filter((r) => statuses.includes(r.status)).reduce((s, r) => s + r._count._all, 0)
    const appStatusCount = (statuses: string[]): number =>
      appStatusRows.filter((r) => statuses.includes(r.status)).reduce((s, r) => s + r._count._all, 0)

    const totalLeads = rangeLeads.length
    const totalApps = appStatusCount(appStatusRows.map((r) => r.status))
    const totalEnrolled = appStatusCount(ENROLLED_STATUSES)
    const rangeLeadIds = rangeLeads.map((l) => l.id)
    const rangeLeadIdSet = new Set(rangeLeadIds)
    // Visits are only meaningful when attached to a real lead (drops dangling/noise rows)
    const rangeVisits = visitFollowUps.filter((v) => v.sourceId && rangeLeadIdSet.has(v.sourceId))

    // ── 1. 12-Stage Funnel ──────────────────────────────────────────────────
    const programFitLeads = await db.lead.count({
      where: { ...leadWhere, childDob: { not: null }, status: { in: [...QUALIFIED_STATUSES, 'NEW', 'CONTACTED'] } },
    })

    const stageDefs: { key: string; label: string; count: number }[] = [
      { key: 'ENQUIRY', label: 'New Enquiry', count: totalLeads },
      { key: 'CONVERSATION', label: 'Parent Conversation', count: leadStatusCount(CONVERSATION_STATUSES) },
      { key: 'VISIT', label: 'School Visit Done', count: visitLeadIds.filter((v) => v.sourceId && rangeLeadIds.includes(v.sourceId)).length },
      { key: 'PROGRAM_FIT', label: 'Program / Age Fit', count: programFitLeads },
      { key: 'APPLICATION', label: 'Application Submitted', count: totalApps },
      { key: 'DOCUMENTS', label: 'Documents Submitted', count: docAppIds.length },
      { key: 'MEETING', label: 'Child & Parent Meeting', count: appStatusCount(MEETING_STATUSES) },
      { key: 'DECISION', label: 'Admission Decision', count: appStatusCount(DECISION_STATUSES) },
      { key: 'OFFER', label: 'Offer Sent', count: appStatusCount(OFFER_STATUSES) },
      { key: 'PARENT_ACCEPTANCE', label: 'Parent Accepted', count: appStatusCount(ACCEPTANCE_STATUSES) },
      { key: 'CLASSROOM_ALLOCATION', label: 'Classroom Placement', count: appPlacementCount },
      { key: 'FINAL_ENROLLMENT', label: 'Enrolled', count: totalEnrolled },
    ]

    const funnel: FunnelStage[] = stageDefs.map((s, i) => {
      const prev = i === 0 ? s.count : stageDefs[i - 1].count
      // Families can enter mid-funnel (e.g. direct application without prior enquiry),
      // so raw stage counts stay honest while the step conversion is capped at 100%.
      return {
        step: i + 1,
        key: s.key,
        label: s.label,
        count: s.count,
        dropFromPrevious: i === 0 ? 0 : Math.max(prev - s.count, 0),
        conversionFromPrevious: i === 0 ? 100 : Math.min(pct(s.count, prev), 100),
        conversionFromStart: pct(s.count, stageDefs[0].count || 1),
      }
    })

    // ── 2. Monthly Trends (enquiries from Leads, enrollments from Students) ─
    const keys = last12MonthKeys()
    const enquiryMap = new Map<string, number>(keys.map((k) => [k, 0]))
    for (const l of rangeLeads) {
      const k = monthKey(l.createdAt)
      if (enquiryMap.has(k)) enquiryMap.set(k, (enquiryMap.get(k) ?? 0) + 1)
    }
    const enrollMap = new Map<string, number>(keys.map((k) => [k, 0]))
    for (const s of enrolledStudents) {
      const k = monthKey(s.admissionDate)
      if (enrollMap.has(k)) enrollMap.set(k, (enrollMap.get(k) ?? 0) + 1)
    }
    const monthlyTrends: MonthTrendPoint[] = keys.map((k) => ({
      month: k,
      label: monthLabel(k),
      enquiries: enquiryMap.get(k) ?? 0,
      enrollments: enrollMap.get(k) ?? 0,
    }))

    // ── 3. Source ROI (per-source: leads → applications → enrolled) ────────
    const appByLeadId = new Map(appByLead.map((a) => [a.leadId as string, a]))
    const enrolledAppIds = new Set(appByLead.filter((a) => ENROLLED_STATUSES.includes(a.status)).map((a) => a.id))
    const sourceRoi: SourceRoiRow[] = []
    for (const src of CANONICAL_LEAD_SOURCES) {
      const group = leadSourceGroups.find((g) => g.source === (src as LeadSource))
      if (!group) continue
      const statusRows = leadSourceStatusGroups.filter((g) => g.source === (src as LeadSource))
      const applications = statusRows
        .filter((g) => APPLICATION_STARTED_LEAD_STATUSES.includes(g.status))
        .reduce((s, g) => s + g._count._all, 0)
      const srcConverted = convertedLeads.filter((c) => c.source === src)
      const enrolled = srcConverted.filter((c) => c.convertedApplicationId && enrolledAppIds.has(c.convertedApplicationId)).length
      const durations = srcConverted
        .map((c) => {
          const app = c.convertedApplicationId ? appByLeadId.get(c.id) : undefined
          return app ? (app.createdAt.getTime() - c.createdAt.getTime()) / DAY_MS : null
        })
        .filter((v): v is number => v !== null && v >= 0)
      sourceRoi.push({
        source: src,
        leads: group._count._all,
        applications,
        enrolled,
        conversionRate: pct(enrolled, group._count._all),
        avgDaysToConvert: durations.length
          ? Math.round((durations.reduce((s, v) => s + v, 0) / durations.length) * 10) / 10
          : null,
      })
    }

    // ── 4. Counsellor Leaderboard (single-pass aggregation, no N+1) ────────
    const counsellorLeads = await db.lead.findMany({
      where: { ...leadWhere, assignedToId: { not: null } },
      select: { assignedToId: true, status: true, nextFollowUpAt: true },
    })
    const counsellorBoard: CounsellorRow[] = counsellorGroups
      .filter((g): g is typeof g & { assignedToId: string } => Boolean(g.assignedToId))
      .map((g) => {
        const mine = counsellorLeads.filter((l) => l.assignedToId === g.assignedToId)
        const converted = mine.filter((l) => l.status === L.CONVERTED).length
        const due = mine.filter(
          (l) => l.nextFollowUpAt && new Date(l.nextFollowUpAt) <= new Date() && !TERMINAL_LEAD_STATUSES.includes(l.status)
        ).length
        const user = counsellorUsers.find((u) => u.id === g.assignedToId)
        return {
          userId: g.assignedToId,
          name: user?.fullName ?? 'Unknown',
          assigned: g._count._all,
          converted,
          followUpsDue: due,
          conversionRate: pct(converted, g._count._all),
        }
      })
      .sort((a, b) => b.converted - a.converted || b.assigned - a.assigned)

    // ── 5. Aging & Stuck Applications ───────────────────────────────────────
    const now = Date.now()
    const aging: AgingBucket[] = [
      { bucket: '<7 days', count: 0 },
      { bucket: '7-15 days', count: 0 },
      { bucket: '15-30 days', count: 0 },
      { bucket: '30+ days', count: 0 },
    ]
    const stuckApplications: StuckApplication[] = []
    for (const a of activeApps) {
      const days = Math.floor((now - a.updatedAt.getTime()) / DAY_MS)
      if (days < 7) aging[0].count++
      else if (days < 15) aging[1].count++
      else if (days < 30) aging[2].count++
      else aging[3].count++
      if (stuckApplications.length < 10) {
        stuckApplications.push({
          id: a.id,
          applicationNumber: a.applicationNumber,
          childName: [a.childFirstName, a.childLastName].filter(Boolean).join(' '),
          programType: a.programType,
          status: a.status,
          daysInStage: days,
        })
      }
    }
    stuckApplications.sort((a, b) => b.daysInStage - a.daysInStage)

    // ── 6. Offer Insights ───────────────────────────────────────────────────
    const offerCount = (st: string) => offerGroups.find((g) => g.status === st)?._count._all ?? 0
    const issued = offerCount('ISSUED')
    const accepted = offerCount('ACCEPTED')
    const declined = offerCount('DECLINED')
    const decided = accepted + declined
    const acceptHours = acceptedOffers
      .map((o) => (o.acceptedAt!.getTime() - o.issuedAt!.getTime()) / 3_600_000)
      .filter((v) => v >= 0)
    const declineReasonMap = new Map<string, number>()
    for (const o of declinedOffers) {
      const reason = (o.declineReason ?? 'OTHER').trim()
      declineReasonMap.set(reason, (declineReasonMap.get(reason) ?? 0) + 1)
    }
    const offerInsights: OfferInsights = {
      total: offerGroups.reduce((s, g) => s + g._count._all, 0),
      issued,
      accepted,
      declined,
      expired: offerCount('EXPIRED'),
      cancelled: offerCount('CANCELLED'),
      acceptanceRate: pct(accepted, decided),
      avgHoursToAccept: acceptHours.length
        ? Math.round((acceptHours.reduce((s, v) => s + v, 0) / acceptHours.length) * 10) / 10
        : null,
      declineReasons: [...declineReasonMap.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
    }

    // ── 7. Capacity Forecast (per program, classrooms × students × pipeline) ─
    const capByProgram = new Map<string, { sections: number; capacity: number; enrolled: number }>()
    for (const c of classrooms) {
      const entry = capByProgram.get(c.programType) ?? { sections: 0, capacity: 0, enrolled: 0 }
      entry.sections++
      entry.capacity += c.capacity
      entry.enrolled += c._count.students
      capByProgram.set(c.programType, entry)
    }
    const pipelineByProgram = new Map(forecastGroups.map((g) => [g.programType, g._count._all]))
    const waitlistByProgram = new Map(waitlistGroups.map((g) => [g.programType, g._count._all]))
    const allPrograms = new Set<string>([...capByProgram.keys(), ...pipelineByProgram.keys(), ...waitlistByProgram.keys()])
    const capacityForecast: ProgramCapacityRow[] = [...allPrograms]
      .map((pt) => {
        const cap = capByProgram.get(pt as ProgramType) ?? { sections: 0, capacity: 0, enrolled: 0 }
        const pipeline = pipelineByProgram.get(pt as ProgramType) ?? 0
        const waitlisted = waitlistByProgram.get(pt as ProgramType) ?? 0
        const availableSeats = Math.max(cap.capacity - cap.enrolled, 0)
        return {
          programType: pt,
          label: programLabel(pt),
          sections: cap.sections,
          capacity: cap.capacity,
          enrolled: cap.enrolled,
          availableSeats,
          pipelineActive: pipeline,
          waitlisted,
          projectedFillPercent: pct(cap.enrolled + Math.min(pipeline, availableSeats), cap.capacity || 1),
        }
      })
      .sort((a, b) => b.capacity - a.capacity)

    // ── 8. Speed Metrics ────────────────────────────────────────────────────
    const firstResponseByLead = new Map<string, Date>()
    for (const f of enquiryFollowUps) {
      if (!f.sourceId) continue
      const existing = firstResponseByLead.get(f.sourceId)
      if (!existing || f.createdAt < existing) firstResponseByLead.set(f.sourceId, f.createdAt)
    }
    const leadCreatedMap = new Map(rangeLeads.map((l) => [l.id, l.createdAt]))
    const responseHours: number[] = []
    for (const [leadId, firstAt] of firstResponseByLead) {
      const created = leadCreatedMap.get(leadId)
      if (!created) continue
      const hours = (firstAt.getTime() - created.getTime()) / 3_600_000
      if (hours >= 0 && hours < 24 * 30) responseHours.push(hours)
    }
    const visitsScheduled = rangeVisits.length
    const visitsCompleted = rangeVisits.filter((v) => ['RESOLVED', 'CLOSED', 'IN_PROGRESS'].includes(v.status)).length
    const visitsMissed = rangeVisits.filter(
      (v) => v.dueAt && new Date(v.dueAt) < new Date() && ['OPEN', 'ACKNOWLEDGED', 'WAITING'].includes(v.status)
    ).length
    const speedMetrics: SpeedMetrics = {
      avgFirstResponseHours: responseHours.length
        ? Math.round((responseHours.reduce((s, v) => s + v, 0) / responseHours.length) * 10) / 10
        : null,
      visitsScheduled,
      visitsCompleted,
      visitsMissed,
      visitNoShowRate: pct(visitsMissed, visitsCompleted + visitsMissed),
      followUpsDueToday: dueFollowUpGroups.reduce((s, f) => s + f._count._all, 0),
    }

    // ── 9. Lost Reasons (from immutable audit trail) ────────────────────────
    const lostReasonMap = new Map<string, number>()
    for (const log of lostAudits) {
      const nv = log.newValues as { lostReason?: string } | null
      const reason = nv?.lostReason?.trim()
      if (reason) lostReasonMap.set(reason, (lostReasonMap.get(reason) ?? 0) + 1)
    }
    const lostReasons: LostReasonRow[] = [...lostReasonMap.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      filters: { branchId, programType },
      funnel,
      monthlyTrends,
      sourceRoi,
      counsellorBoard,
      aging,
      stuckApplications,
      offerInsights,
      capacityForecast,
      speedMetrics,
      lostReasons,
      sources: [...CANONICAL_LEAD_SOURCES],
      totals: {
        leads: totalLeads,
        applications: totalApps,
        enrolled: totalEnrolled,
        leadToEnrollRate: pct(totalEnrolled, totalLeads),
      },
    }
  }
}
