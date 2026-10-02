import { db } from '@/lib/db'
import { Role, SessionPayload, can } from '@/lib/auth'

export type SearchCategory =
  | 'students'
  | 'guardians'
  | 'staff'
  | 'admissions'
  | 'academics'
  | 'attendance'
  | 'operations'
  | 'finance'
  | 'hr'
  | 'transport'
  | 'inventory'
  | 'reports'
  | 'communication'
  | 'audit'
  | 'settings'

export interface SearchResultItem {
  id: string
  category: SearchCategory
  title: string
  subtitle?: string
  badge?: string
  badgeVariant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'
  actionUrl: string
  metadata?: Record<string, string | number | boolean | null | undefined>
  score: number
}

export interface GlobalSearchResponse {
  query: string
  total: number
  categoryCounts: Partial<Record<SearchCategory, number>>
  results: SearchResultItem[]
}

export interface SearchOptions {
  category?: SearchCategory | 'all'
  limit?: number
  offset?: number
  branchId?: string
}

interface ResolvedScope {
  tenantId: string | null
  branchId: string | null
  isPlatformAdmin: boolean
  isOwner: boolean
  isParent: boolean
  isTeacher: boolean
  parentStudentIds: string[]
  parentGuardianId: string | null
  teacherClassroomIds: string[]
  roles: Role[]
}

/**
 * Deterministic scoring function for ranking search results.
 * Priority:
 * 100 - Exact identifier match (admissionNo, invoiceNumber, employeeCode, vehicleNumber, etc.)
 * 90  - Exact title / name match
 * 85  - Starts-with identifier match
 * 75  - Starts-with title / name match
 * 60  - Word / token boundary match
 * 50  - Substring match in title
 * 25  - Metadata / subtitle match
 */
export function calculateRankScore(
  title: string,
  identifier: string | null | undefined,
  rawQuery: string,
  subtitle?: string
): number {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return 0

  const t = title.toLowerCase().trim()
  const ident = identifier ? identifier.toLowerCase().trim() : ''
  const sub = subtitle ? subtitle.toLowerCase().trim() : ''

  if (ident && ident === q) return 100
  if (t === q) return 90
  if (ident && ident.startsWith(q)) return 85
  if (t.startsWith(q)) return 75

  // Word boundary match
  const words = t.split(/\s+/)
  if (words.some((w) => w === q || w.startsWith(q))) return 60

  if (t.includes(q)) return 50
  if (ident && ident.includes(q)) return 40
  if (sub && sub.includes(q)) return 25

  return 10
}

/**
 * Resolves user context, permissions, relationships and isolation boundaries.
 * Strictly fail-closed: if required scope cannot be resolved, access is denied.
 */
export async function resolveSearchScope(session: SessionPayload): Promise<ResolvedScope> {
  const roles: Role[] = session.roles && session.roles.length > 0 ? session.roles : [session.role]
  const isPlatformAdmin = roles.includes('PLATFORM_ADMIN')
  const isOwner = roles.includes('OWNER')
  const isParent = roles.includes('PARENT')
  const isTeacher = roles.includes('TEACHER') && !isOwner && !roles.includes('PRINCIPAL')

  let parentStudentIds: string[] = []
  let parentGuardianId: string | null = null
  let teacherClassroomIds: string[] = []

  // Resolve Parent child linkages via Guardian -> StudentGuardian
  if (isParent && session.tenantId) {
    try {
      const guardian = await db.guardian.findFirst({
        where: {
          tenantId: session.tenantId,
          userId: session.uid,
          deletedAt: null,
        },
        select: {
          id: true,
          studentLinks: {
            select: { studentId: true },
          },
        },
      })

      if (guardian) {
        parentGuardianId = guardian.id
        parentStudentIds = guardian.studentLinks.map((l) => l.studentId)
      }
    } catch {
      // quiet fail-closed
    }
  }

  // Resolve Teacher assigned classrooms
  if (isTeacher && session.tenantId) {
    try {
      const classrooms = await db.classroom.findMany({
        where: {
          tenantId: session.tenantId,
          primaryTeacherId: session.uid,
          isActive: true,
        },
        select: { id: true },
      })
      teacherClassroomIds = classrooms.map((c) => c.id)
    } catch {
      // quiet fail-closed
    }
  }

  return {
    tenantId: session.tenantId,
    branchId: session.branchId || null,
    isPlatformAdmin,
    isOwner,
    isParent,
    isTeacher,
    parentStudentIds,
    parentGuardianId,
    teacherClassroomIds,
    roles,
  }
}

/**
 * Safe settings metadata provider - strictly non-sensitive labels and paths only.
 * NEVER returns secrets, API keys, passwords, database URLs, or tokens.
 */
const SAFE_SETTINGS_PAGES: Array<{ id: string; title: string; subtitle: string; actionUrl: string }> = [
  { id: 'set-gen', title: 'General School Settings', subtitle: 'School profile, branding, academic configuration', actionUrl: '/app/settings?tab=general' },
  { id: 'set-acad', title: 'Academic Sessions & Calendar', subtitle: 'Academic years, term schedules, sessions', actionUrl: '/app/settings?tab=academic' },
  { id: 'set-branch', title: 'Branch Management', subtitle: 'Multi-branch locations, facilities, branches', actionUrl: '/app/settings?tab=branches' },
  { id: 'set-roles', title: 'Roles & User Permissions', subtitle: 'RBAC access control, staff roles, permissions', actionUrl: '/app/settings?tab=roles' },
  { id: 'set-notif', title: 'Notification Preferences', subtitle: 'System announcements, email, SMS settings', actionUrl: '/app/settings?tab=notifications' },
  { id: 'set-fees', title: 'Fee Plan Configuration', subtitle: 'Fee structures, installment rules, heads', actionUrl: '/app/settings?tab=fees' },
  { id: 'set-trans', title: 'Transport Configuration', subtitle: 'Vehicle fleet settings, transport zones', actionUrl: '/app/settings?tab=transport' },
]

/**
 * Safe report definitions
 */
const SAFE_REPORTS_CATALOG: Array<{ id: string; title: string; subtitle: string; actionUrl: string }> = [
  { id: 'rep-enroll', title: 'Student Enrollment Report', subtitle: 'Admissions and enrollment analytics', actionUrl: '/app/reports?tab=enrollment' },
  { id: 'rep-att', title: 'Daily Attendance Report · Attendance Summary', subtitle: 'Student and staff daily attendance analytics and attendance summary', actionUrl: '/app/reports?tab=attendance' },
  { id: 'rep-fee', title: 'Fee Collection & Aging Report', subtitle: 'Invoices, payments, and receivables', actionUrl: '/app/reports?tab=finance' },
  { id: 'rep-trans', title: 'Transport Utilization Report', subtitle: 'Routes, vehicle capacity, and manifest', actionUrl: '/app/reports?tab=transport' },
  { id: 'rep-hr', title: 'Staff Workforce Summary', subtitle: 'Staff directory, designations, and headcount', actionUrl: '/app/reports?tab=hr' },
  { id: 'rep-inv', title: 'Inventory Stock Summary', subtitle: 'Asset and stock balances by branch', actionUrl: '/app/reports?tab=inventory' },
]

/**
 * Main Global Search Service.
 * Single entry point for cross-module discovery over canonical PreOne data.
 */
export class GlobalSearchService {
  /**
   * Performs an authorized, tenant-isolated, role-restricted search.
   */
  static async search(
    arg1: SessionPayload | string,
    arg2: SessionPayload | string,
    options: SearchOptions = {}
  ): Promise<GlobalSearchResponse> {
    let session: SessionPayload
    let rawQuery: string

    if (typeof arg1 === 'string') {
      rawQuery = arg1
      session = arg2 as SessionPayload
    } else {
      session = arg1
      rawQuery = arg2 as string
    }

    const q = (rawQuery || '').trim()
    if (!q || q.length === 0) {
      return { query: '', total: 0, categoryCounts: {}, results: [] }
    }

    // Limit query length to prevent regex/DOS attacks
    const query = q.slice(0, 100)

    const scope = await resolveSearchScope(session)

    // Platform admin without tenant: only platform/audit/settings
    if (scope.isPlatformAdmin && !scope.tenantId) {
      const results: SearchResultItem[] = []
      if (can(scope.roles, 'audit:read')) {
        results.push(...await this.searchAuditLogs(null, query, scope))
      }
      return this.formatResponse(query, results, options)
    }

    if (!scope.tenantId) {
      return { query, total: 0, categoryCounts: {}, results: [] }
    }

    // If options.branchId is specified, apply branch filtering
    if (options.branchId) {
      scope.branchId = options.branchId
    }

    const tenantId = scope.tenantId
    const targetCategory = options.category || 'all'

    const providers: Array<Promise<SearchResultItem[]>> = []

    // 1. Students
    if ((targetCategory === 'all' || targetCategory === 'students') &&
        (scope.isParent || can(scope.roles, 'students:read'))) {
      providers.push(this.searchStudents(tenantId, query, scope))
    }

    // 2. Guardians / Parents
    if ((targetCategory === 'all' || targetCategory === 'guardians') &&
        (scope.isParent || can(scope.roles, 'students:read') || can(scope.roles, 'users:read'))) {
      providers.push(this.searchGuardians(tenantId, query, scope))
    }

    // 3. Staff / Users (Parents strictly excluded)
    if (!scope.isParent && (targetCategory === 'all' || targetCategory === 'staff') &&
        (can(scope.roles, 'users:read') || can(scope.roles, 'hr:read'))) {
      providers.push(this.searchStaff(tenantId, query, scope))
    }

    // 4. Admissions / CRM (Parents strictly excluded)
    if (!scope.isParent && (targetCategory === 'all' || targetCategory === 'admissions') &&
        can(scope.roles, 'admissions:read')) {
      providers.push(this.searchAdmissions(tenantId, query, scope))
    }

    // 5. Academics / Classrooms (Parents strictly excluded)
    if (!scope.isParent && (targetCategory === 'all' || targetCategory === 'academics') &&
        can(scope.roles, 'academics:read')) {
      providers.push(this.searchAcademics(tenantId, query, scope))
    }

    // 6. Attendance
    if ((targetCategory === 'all' || targetCategory === 'attendance') &&
        (scope.isParent || can(scope.roles, 'attendance:read'))) {
      providers.push(this.searchAttendance(tenantId, query, scope))
    }

    // 7. Operations / Timeline
    if ((targetCategory === 'all' || targetCategory === 'operations') &&
        (scope.isParent || can(scope.roles, 'operations:read') || can(scope.roles, 'timeline:read'))) {
      providers.push(this.searchOperations(tenantId, query, scope))
    }

    // 8. Finance / Invoices / Receipts
    if ((targetCategory === 'all' || targetCategory === 'finance') &&
        (scope.isParent || can(scope.roles, 'finance:read'))) {
      providers.push(this.searchFinance(tenantId, query, scope))
    }

    // 9. HR / Workforce (Parents & Teachers strictly excluded)
    if (!scope.isParent && (targetCategory === 'all' || targetCategory === 'hr') &&
        can(scope.roles, 'hr:read')) {
      providers.push(this.searchHR(tenantId, query, scope))
    }

    // 10. Transport
    if ((targetCategory === 'all' || targetCategory === 'transport') &&
        (scope.isParent || can(scope.roles, 'transport:read'))) {
      providers.push(this.searchTransport(tenantId, query, scope))
    }

    // 11. Inventory (Parents strictly excluded)
    if (!scope.isParent && (targetCategory === 'all' || targetCategory === 'inventory') &&
        can(scope.roles, 'inventory:read')) {
      providers.push(this.searchInventory(tenantId, query, scope))
    }

    // 12. Reports
    if ((targetCategory === 'all' || targetCategory === 'reports') &&
        (scope.isParent || can(scope.roles, 'reports:read'))) {
      providers.push(this.searchReports(query, scope))
    }

    // 13. Communication / Announcements
    if ((targetCategory === 'all' || targetCategory === 'communication') &&
        (scope.isParent || can(scope.roles, 'communication:read'))) {
      providers.push(this.searchCommunication(tenantId, query, scope))
    }

    // 14. Privileged Audit Logs
    if ((targetCategory === 'all' || targetCategory === 'audit') &&
        can(scope.roles, 'audit:read')) {
      providers.push(this.searchAuditLogs(tenantId, query, scope))
    }

    // 15. Safe Settings Metadata (Parents strictly excluded)
    if (!scope.isParent && (targetCategory === 'all' || targetCategory === 'settings') &&
        can(scope.roles, 'settings:read')) {
      providers.push(this.searchSettings(query, scope))
    }

    // Execute provider queries safely in parallel
    const settled = await Promise.allSettled(providers)
    const allResults: SearchResultItem[] = []

    for (const res of settled) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        allResults.push(...res.value)
      }
    }

    return this.formatResponse(query, allResults, options)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DOMAIN PROVIDERS (Querying Canonical Models Only)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * 1. Students Provider
   */
  private static async searchStudents(
    tenantId: string,
    query: string,
    scope: ResolvedScope
  ): Promise<SearchResultItem[]> {
    // Parent isolation: strictly restrict to their own linked children
    if (scope.isParent) {
      if (scope.parentStudentIds.length === 0) return []
    }

    const where: any = {
      tenantId,
      deletedAt: null,
      OR: [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { admissionNo: { contains: query, mode: 'insensitive' } },
        { seatNumber: { contains: query, mode: 'insensitive' } },
      ],
    }

    if (scope.isParent) {
      where.id = { in: scope.parentStudentIds }
    } else if (scope.isTeacher) {
      where.currentClassroomId = { in: scope.teacherClassroomIds }
    } else if (scope.branchId) {
      where.branchId = scope.branchId
    }

    const students = await db.student.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNo: true,
        status: true,
        currentClassroom: { select: { name: true, code: true } },
      },
      take: 20,
    })

    return students.map((s) => {
      const fullName = `${s.firstName} ${s.lastName || ''}`.trim()
      const className = s.currentClassroom?.name ? ` · ${s.currentClassroom.name}` : ''
      const subtitle = `Adm #${s.admissionNo}${className}`
      return {
        id: s.id,
        category: 'students',
        title: fullName,
        subtitle,
        badge: s.status,
        badgeVariant: s.status === 'ACTIVE' ? 'success' : 'default',
        actionUrl: `/app/students?id=${s.id}`,
        metadata: { admissionNo: s.admissionNo, classroom: s.currentClassroom?.name },
        score: calculateRankScore(fullName, s.admissionNo, query, subtitle),
      }
    })
  }

  /**
   * 2. Guardians / Parents Provider
   */
  private static async searchGuardians(
    tenantId: string,
    query: string,
    scope: ResolvedScope
  ): Promise<SearchResultItem[]> {
    if (scope.isParent) {
      if (!scope.parentGuardianId) return []
    }

    const where: any = {
      tenantId,
      deletedAt: null,
      OR: [
        { fullName: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
      ],
    }

    if (scope.isParent) {
      where.id = scope.parentGuardianId
    }

    const guardians = await db.guardian.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        relationship: true,
        phone: true,
        studentLinks: {
          select: {
            student: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      take: 15,
    })

    return guardians.map((g) => {
      const linkedChildren = g.studentLinks.map((l) => `${l.student.firstName} ${l.student.lastName || ''}`.trim()).join(', ')
      // For privacy on general roles, mask phone slightly if needed
      const phoneDisplay = scope.isParent || can(scope.roles, 'users:write') ? g.phone : `${g.phone.slice(0, 4)}****${g.phone.slice(-2)}`
      const subtitle = `${g.relationship} ${linkedChildren ? `· Parent of ${linkedChildren}` : ''} (${phoneDisplay})`

      return {
        id: g.id,
        category: 'guardians',
        title: g.fullName,
        subtitle,
        badge: g.relationship,
        badgeVariant: 'purple',
        actionUrl: `/app/users`,
        metadata: { phone: phoneDisplay, relationship: g.relationship },
        score: calculateRankScore(g.fullName, g.phone, query, subtitle),
      }
    })
  }

  /**
   * 3. Staff / Users Provider
   */
  private static async searchStaff(
    tenantId: string,
    query: string,
    scope: ResolvedScope
  ): Promise<SearchResultItem[]> {
    const where: any = {
      tenantId,
      deletedAt: null,
      OR: [
        { employeeCode: { contains: query, mode: 'insensitive' } },
        { designation: { contains: query, mode: 'insensitive' } },
        { department: { contains: query, mode: 'insensitive' } },
        { user: { fullName: { contains: query, mode: 'insensitive' } } },
        { user: { email: { contains: query, mode: 'insensitive' } } },
      ],
    }

    if (scope.branchId) {
      where.AND = [
        {
          OR: [
            { branchId: scope.branchId },
            { branchId: null },
          ],
        },
      ]
    }

    const staffProfiles = await db.staffProfile.findMany({
      where,
      select: {
        id: true,
        employeeCode: true,
        designation: true,
        department: true,
        status: true,
        user: { select: { id: true, fullName: true, email: true } },
        branch: { select: { name: true } },
      },
      take: 15,
    })

    return staffProfiles.map((sp) => {
      const name = sp.user.fullName
      const sub = [sp.employeeCode, sp.designation, sp.department, sp.branch?.name].filter(Boolean).join(' · ')
      return {
        id: sp.id,
        category: 'staff',
        title: name,
        subtitle: sub,
        badge: sp.status,
        badgeVariant: sp.status === 'ACTIVE' ? 'success' : 'default',
        actionUrl: `/app/hr`,
        metadata: { employeeCode: sp.employeeCode, designation: sp.designation, email: sp.user.email },
        score: calculateRankScore(name, sp.employeeCode, query, sub),
      }
    })
  }

  /**
   * 4. Admissions / CRM Provider
   */
  private static async searchAdmissions(
    tenantId: string,
    query: string,
    scope: ResolvedScope
  ): Promise<SearchResultItem[]> {
    const where: any = {
      tenantId,
      deletedAt: null,
      OR: [
        { applicationNumber: { contains: query, mode: 'insensitive' } },
        { childFirstName: { contains: query, mode: 'insensitive' } },
        { childLastName: { contains: query, mode: 'insensitive' } },
        { parentName: { contains: query, mode: 'insensitive' } },
        { parentPhone: { contains: query, mode: 'insensitive' } },
      ],
    }

    if (scope.branchId) {
      where.branchId = scope.branchId
    }

    const [apps, leads] = await Promise.all([
      db.admissionApplication.findMany({
        where,
        select: {
          id: true,
          applicationNumber: true,
          childFirstName: true,
          childLastName: true,
          parentName: true,
          status: true,
        },
        take: 10,
      }),
      db.lead.findMany({
        where: {
          tenantId,
          deletedAt: null,
          OR: [
            { leadNumber: { contains: query, mode: 'insensitive' } },
            { parentName: { contains: query, mode: 'insensitive' } },
            { childName: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
          ],
          ...(scope.branchId ? { branchId: scope.branchId } : {}),
        },
        select: {
          id: true,
          leadNumber: true,
          parentName: true,
          childName: true,
          status: true,
        },
        take: 10,
      }),
    ])

    const results: SearchResultItem[] = []

    for (const a of apps) {
      const childFullName = `${a.childFirstName} ${a.childLastName || ''}`.trim()
      const title = `${childFullName} (App #${a.applicationNumber})`
      const sub = `Parent: ${a.parentName} · Status: ${a.status}`
      results.push({
        id: a.id,
        category: 'admissions',
        title,
        subtitle: sub,
        badge: a.status,
        badgeVariant: a.status === 'APPROVED' ? 'success' : 'info',
        actionUrl: `/app/admissions`,
        metadata: { applicationNumber: a.applicationNumber },
        score: calculateRankScore(childFullName, a.applicationNumber, query, sub),
      })
    }

    for (const l of leads) {
      const child = l.childName ? `Child: ${l.childName} · ` : ''
      const title = `Lead #${l.leadNumber} · ${l.parentName}`
      const sub = `${child}Status: ${l.status}`
      results.push({
        id: l.id,
        category: 'admissions',
        title,
        subtitle: sub,
        badge: l.status,
        badgeVariant: 'default',
        actionUrl: `/app/admissions`,
        metadata: { leadNumber: l.leadNumber },
        score: calculateRankScore(l.parentName, l.leadNumber, query, sub),
      })
    }

    return results
  }

  /**
   * 5. Academics / Classrooms Provider
   */
  private static async searchAcademics(
    tenantId: string,
    query: string,
    scope: ResolvedScope
  ): Promise<SearchResultItem[]> {
    const where: any = {
      tenantId,
      isActive: true,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { code: { contains: query, mode: 'insensitive' } },
      ],
    }

    if (scope.isTeacher) {
      where.id = { in: scope.teacherClassroomIds }
    } else if (scope.branchId) {
      where.branchId = scope.branchId
    }

    const classrooms = await db.classroom.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        capacity: true,
        programType: true,
        primaryTeacher: { select: { fullName: true } },
      },
      take: 15,
    })

    return classrooms.map((c) => {
      const teacher = c.primaryTeacher?.fullName ? ` · Teacher: ${c.primaryTeacher.fullName}` : ''
      const sub = `${c.code} · ${c.programType}${teacher}`
      return {
        id: c.id,
        category: 'academics',
        title: c.name,
        subtitle: sub,
        badge: c.programType,
        badgeVariant: 'purple',
        actionUrl: `/app/daily-diary`,
        metadata: { code: c.code, capacity: c.capacity },
        score: calculateRankScore(c.name, c.code, query, sub),
      }
    })
  }

  /**
   * 6. Attendance Provider
   */
  private static async searchAttendance(
    tenantId: string,
    query: string,
    scope: ResolvedScope
  ): Promise<SearchResultItem[]> {
    if (scope.isParent && scope.parentStudentIds.length === 0) return []

    const where: any = {
      tenantId,
      OR: [
        { student: { firstName: { contains: query, mode: 'insensitive' } } },
        { student: { lastName: { contains: query, mode: 'insensitive' } } },
        { student: { admissionNo: { contains: query, mode: 'insensitive' } } },
        { classroom: { name: { contains: query, mode: 'insensitive' } } },
        { notes: { contains: query, mode: 'insensitive' } },
      ],
    }

    if (scope.isParent) {
      where.studentId = { in: scope.parentStudentIds }
    } else if (scope.isTeacher) {
      where.classroomId = { in: scope.teacherClassroomIds }
    } else if (scope.branchId) {
      where.branchId = scope.branchId
    }

    const records = await db.attendance.findMany({
      where,
      select: {
        id: true,
        date: true,
        status: true,
        student: { select: { firstName: true, lastName: true, admissionNo: true } },
        classroom: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
      take: 12,
    })

    return records.map((att) => {
      const studentName = `${att.student.firstName} ${att.student.lastName || ''}`.trim()
      const d = new Date(att.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      const title = `${studentName} · Attendance (${d})`
      const sub = `Class: ${att.classroom.name} · Status: ${att.status}`
      return {
        id: att.id,
        category: 'attendance',
        title,
        subtitle: sub,
        badge: att.status,
        badgeVariant: att.status === 'PRESENT' ? 'success' : 'danger',
        actionUrl: `/app/daily-diary?tab=attendance`,
        metadata: { date: d, studentName },
        score: calculateRankScore(title, att.student.admissionNo, query, sub),
      }
    })
  }

  /**
   * 7. Operations / Timeline Provider
   */
  private static async searchOperations(
    tenantId: string,
    query: string,
    scope: ResolvedScope
  ): Promise<SearchResultItem[]> {
    if (scope.isParent && scope.parentStudentIds.length === 0) return []

    const where: any = {
      tenantId,
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { body: { contains: query, mode: 'insensitive' } },
        { student: { firstName: { contains: query, mode: 'insensitive' } } },
        { student: { lastName: { contains: query, mode: 'insensitive' } } },
      ],
    }

    if (scope.isParent) {
      where.studentId = { in: scope.parentStudentIds }
    } else if (scope.isTeacher) {
      where.student = { currentClassroomId: { in: scope.teacherClassroomIds } }
    }

    if (scope.branchId) {
      where.student = {
        ...(where.student || {}),
        branchId: scope.branchId,
      }
    }

    const entries = await db.timelineEntry.findMany({
      where,
      select: {
        id: true,
        title: true,
        type: true,
        createdAt: true,
        student: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
    })

    return entries.map((entry) => {
      const studentName = `${entry.student.firstName} ${entry.student.lastName || ''}`.trim()
      const d = new Date(entry.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      const sub = `Child: ${studentName} · Type: ${entry.type} · ${d}`
      return {
        id: entry.id,
        category: 'operations',
        title: entry.title,
        subtitle: sub,
        badge: entry.type,
        badgeVariant: 'info',
        actionUrl: `/app/operations`,
        metadata: { student: studentName, type: entry.type },
        score: calculateRankScore(entry.title, null, query, sub),
      }
    })
  }

  /**
   * 8. Finance / Invoices / Receipts Provider
   */
  private static async searchFinance(
    tenantId: string,
    query: string,
    scope: ResolvedScope
  ): Promise<SearchResultItem[]> {
    if (scope.isParent && scope.parentStudentIds.length === 0) return []

    const where: any = {
      tenantId,
      deletedAt: null,
      OR: [
        { invoiceNumber: { contains: query, mode: 'insensitive' } },
        { title: { contains: query, mode: 'insensitive' } },
        { student: { firstName: { contains: query, mode: 'insensitive' } } },
        { student: { lastName: { contains: query, mode: 'insensitive' } } },
        { student: { admissionNo: { contains: query, mode: 'insensitive' } } },
      ],
    }

    if (scope.isParent) {
      where.studentId = { in: scope.parentStudentIds }
    } else if (scope.branchId) {
      where.branchId = scope.branchId
    }

    const invoices = await db.invoice.findMany({
      where,
      select: {
        id: true,
        invoiceNumber: true,
        title: true,
        totalCents: true,
        balanceCents: true,
        status: true,
        student: { select: { firstName: true, lastName: true } },
      },
      take: 15,
    })

    return invoices.map((inv) => {
      const studentName = inv.student ? `${inv.student.firstName} ${inv.student.lastName || ''}`.trim() : 'School'
      const amountRupees = `₹${(inv.totalCents / 100).toLocaleString('en-IN')}`
      const balanceRupees = `₹${(inv.balanceCents / 100).toLocaleString('en-IN')}`
      const sub = `Student: ${studentName} · Total: ${amountRupees} · Due: ${balanceRupees}`
      return {
        id: inv.id,
        category: 'finance',
        title: `Invoice #${inv.invoiceNumber}`,
        subtitle: sub,
        badge: inv.status,
        badgeVariant: inv.status === 'PAID' ? 'success' : inv.status === 'OVERDUE' ? 'danger' : 'warning',
        actionUrl: `/app/finance`,
        metadata: { invoiceNumber: inv.invoiceNumber, total: amountRupees, status: inv.status },
        score: calculateRankScore(`Invoice #${inv.invoiceNumber}`, inv.invoiceNumber, query, sub),
      }
    })
  }

  /**
   * 9. HR / Workforce Provider
   */
  private static async searchHR(
    tenantId: string,
    query: string,
    scope: ResolvedScope
  ): Promise<SearchResultItem[]> {
    const where: any = {
      tenantId,
      deletedAt: null,
      OR: [
        { employeeCode: { contains: query, mode: 'insensitive' } },
        { designation: { contains: query, mode: 'insensitive' } },
        { department: { contains: query, mode: 'insensitive' } },
        { user: { fullName: { contains: query, mode: 'insensitive' } } },
      ],
    }

    if (scope.branchId) {
      where.AND = [
        {
          OR: [
            { branchId: scope.branchId },
            { branchId: null },
          ],
        },
      ]
    }

    const profiles = await db.staffProfile.findMany({
      where,
      select: {
        id: true,
        employeeCode: true,
        designation: true,
        department: true,
        employmentType: true,
        user: { select: { fullName: true } },
      },
      take: 10,
    })

    return profiles.map((p) => {
      const name = p.user.fullName
      const sub = `Code: ${p.employeeCode} · ${p.designation || 'Staff'} (${p.department || 'General'})`
      return {
        id: p.id,
        category: 'hr',
        title: name,
        subtitle: sub,
        badge: p.employmentType,
        badgeVariant: 'purple',
        actionUrl: `/app/hr`,
        metadata: { employeeCode: p.employeeCode, designation: p.designation },
        score: calculateRankScore(name, p.employeeCode, query, sub),
      }
    })
  }

  /**
   * 10. Transport Provider (Routes, Vehicles, Trips)
   */
  private static async searchTransport(
    tenantId: string,
    query: string,
    scope: ResolvedScope
  ): Promise<SearchResultItem[]> {
    const whereRoute: any = {
      tenantId,
      deletedAt: null,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { code: { contains: query, mode: 'insensitive' } },
      ],
    }

    const whereVehicles: any = {
      tenantId,
      deletedAt: null,
      OR: [
        { registrationNumber: { contains: query, mode: 'insensitive' } },
        { makeModel: { contains: query, mode: 'insensitive' } },
      ],
    }

    if (scope.isParent) {
      if (scope.parentStudentIds.length === 0) return []
      whereRoute.assignments = {
        some: { studentId: { in: scope.parentStudentIds } },
      }
      // Vehicles on assigned routes
      whereVehicles.routes = {
        some: {
          assignments: {
            some: { studentId: { in: scope.parentStudentIds } },
          },
        },
      }
    } else if (scope.branchId) {
      whereRoute.AND = [
        {
          OR: [
            { branchId: scope.branchId },
            { branchId: null },
          ],
        },
      ]
      whereVehicles.AND = [
        {
          OR: [
            { branchId: scope.branchId },
            { branchId: null },
          ],
        },
      ]
    }

    const [routes, vehicles] = await Promise.all([
      db.transportRoute.findMany({
        where: whereRoute,
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          vehicle: { select: { registrationNumber: true } },
        },
        take: 10,
      }),
      db.vehicle.findMany({
        where: whereVehicles,
        select: {
          id: true,
          registrationNumber: true,
          makeModel: true,
          vehicleType: true,
          status: true,
        },
        take: 10,
      }),
    ])

    const results: SearchResultItem[] = []

    for (const r of routes) {
      const veh = r.vehicle ? ` · Vehicle: ${r.vehicle.registrationNumber}` : ''
      const sub = `Route Code: ${r.code}${veh}`
      results.push({
        id: r.id,
        category: 'transport',
        title: r.name,
        subtitle: sub,
        badge: r.status,
        badgeVariant: r.status === 'ACTIVE' ? 'success' : 'default',
        actionUrl: `/app/transport`,
        metadata: { code: r.code },
        score: calculateRankScore(r.name, r.code, query, sub),
      })
    }

    for (const v of vehicles) {
      const sub = `${v.vehicleType} · ${v.makeModel || 'School Fleet'}`
      results.push({
        id: v.id,
        category: 'transport',
        title: `Vehicle ${v.registrationNumber}`,
        subtitle: sub,
        badge: v.status,
        badgeVariant: v.status === 'ACTIVE' ? 'success' : 'default',
        actionUrl: `/app/transport`,
        metadata: { reg: v.registrationNumber },
        score: calculateRankScore(`Vehicle ${v.registrationNumber}`, v.registrationNumber, query, sub),
      })
    }

    return results
  }

  /**
   * 11. Inventory Provider
   */
  private static async searchInventory(
    tenantId: string,
    query: string,
    _scope: ResolvedScope
  ): Promise<SearchResultItem[]> {
    const items = await db.inventoryItem.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { sku: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        category: { select: { name: true } },
      },
      take: 15,
    })

    return items.map((item) => {
      const sub = `SKU: ${item.sku} · Category: ${item.category?.name || 'General'}`
      return {
        id: item.id,
        category: 'inventory',
        title: item.name,
        subtitle: sub,
        badge: item.sku,
        badgeVariant: 'default',
        actionUrl: `/app/inventory`,
        metadata: { sku: item.sku },
        score: calculateRankScore(item.name, item.sku, query, sub),
      }
    })
  }

  /**
   * 12. Reports Provider (Safe metadata catalog)
   */
  private static async searchReports(
    query: string,
    _scope: ResolvedScope
  ): Promise<SearchResultItem[]> {
    const q = query.toLowerCase()
    const matched = SAFE_REPORTS_CATALOG.filter(
      (r) => r.title.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q)
    )

    return matched.map((r) => ({
      id: r.id,
      category: 'reports',
      title: r.title,
      subtitle: r.subtitle,
      badge: 'Report',
      badgeVariant: 'purple',
      actionUrl: r.actionUrl,
      score: calculateRankScore(r.title, null, query, r.subtitle),
    }))
  }

  /**
   * 13. Communication Provider (Announcements)
   */
  private static async searchCommunication(
    tenantId: string,
    query: string,
    scope: ResolvedScope
  ): Promise<SearchResultItem[]> {
    const where: any = {
      tenantId,
      status: 'PUBLISHED',
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { body: { contains: query, mode: 'insensitive' } },
      ],
    }

    if (scope.isParent) {
      where.audience = { in: ['SCHOOL_WIDE', 'ALL_PARENTS', 'BRANCH_PARENTS', 'CLASS_PARENTS'] }
    }

    const announcements = await db.announcement.findMany({
      where,
      select: {
        id: true,
        title: true,
        audience: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: 10,
    })

    return announcements.map((a) => {
      const d = a.publishedAt ? new Date(a.publishedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Draft'
      const sub = `Audience: ${a.audience} · ${d}`
      return {
        id: a.id,
        category: 'communication',
        title: a.title,
        subtitle: sub,
        badge: a.audience,
        badgeVariant: 'info',
        actionUrl: `/app/communication`,
        metadata: { audience: a.audience },
        score: calculateRankScore(a.title, null, query, sub),
      }
    })
  }

  /**
   * 14. Privileged Audit Logs Provider
   */
  private static async searchAuditLogs(
    tenantId: string | null,
    query: string,
    _scope: ResolvedScope
  ): Promise<SearchResultItem[]> {
    const where: any = {
      ...(tenantId ? { tenantId } : {}),
      OR: [
        { action: { contains: query, mode: 'insensitive' } },
        { entity: { contains: query, mode: 'insensitive' } },
        { actorName: { contains: query, mode: 'insensitive' } },
        { summary: { contains: query, mode: 'insensitive' } },
      ],
    }

    const logs = await db.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entity: true,
        actorName: true,
        summary: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return logs.map((log) => {
      const d = new Date(log.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      const sub = `${log.actorName} · ${log.summary || log.action} · ${d}`
      return {
        id: log.id,
        category: 'audit',
        title: `${log.action} on ${log.entity}`,
        subtitle: sub,
        badge: log.entity,
        badgeVariant: 'warning',
        actionUrl: `/app/audit`,
        metadata: { action: log.action, actor: log.actorName },
        score: calculateRankScore(`${log.action} on ${log.entity}`, log.action, query, sub),
      }
    })
  }

  /**
   * 15. Safe Settings Provider
   */
  private static async searchSettings(
    query: string,
    _scope: ResolvedScope
  ): Promise<SearchResultItem[]> {
    const q = query.toLowerCase()
    const matched = SAFE_SETTINGS_PAGES.filter(
      (s) => s.title.toLowerCase().includes(q) || s.subtitle.toLowerCase().includes(q)
    )

    return matched.map((s) => ({
      id: s.id,
      category: 'settings',
      title: s.title,
      subtitle: s.subtitle,
      badge: 'Setting',
      badgeVariant: 'default',
      actionUrl: s.actionUrl,
      score: calculateRankScore(s.title, null, query, s.subtitle),
    }))
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RESPONSE NORMALIZATION & RANKING
  // ──────────────────────────────────────────────────────────────────────────

  private static formatResponse(
    query: string,
    allResults: SearchResultItem[],
    options: SearchOptions
  ): GlobalSearchResponse {
    // 1. Calculate category counts
    const categoryCounts: Partial<Record<SearchCategory, number>> = {}
    for (const item of allResults) {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1
    }

    // 2. Filter by category if specified (and not 'all')
    let filtered = allResults
    if (options.category && options.category !== 'all') {
      filtered = allResults.filter((r) => r.category === options.category)
    }

    // 3. Sort deterministically by rank score DESC, then title ASC
    filtered.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.title.localeCompare(b.title)
    })

    // 4. Safe pagination
    const total = filtered.length
    const limit = Math.min(Math.max(options.limit || 20, 1), 50)
    const offset = Math.max(options.offset || 0, 0)
    const paginated = filtered.slice(offset, offset + limit)

    return {
      query,
      total,
      categoryCounts,
      results: paginated,
    }
  }
}
