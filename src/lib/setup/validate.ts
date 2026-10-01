/**
 * M00 — Setup Validation Engine (v2 Canonical 17-Area Architecture)
 *
 * 15 categories, each PASS / WARNING / BLOCKED with findings.
 * A validation run is persisted in SchoolSetupValidationRun for audit.
 * Go-live is blocked when ANY category has a BLOCKED finding.
 *
 * Enforces Points 6, 7 & 8:
 *  - Calendar readiness validated against real operational records.
 *  - Admissions readiness validated against M03 requirements.
 *  - Student & Parent rules validated against pickup & consent requirements.
 *  - Academic structure validated including subjects and teacher assignments.
 */
import { db } from '@/lib/db'
import { loadContext, type TenantContext } from './engine'

export type FindingStatus = 'PASS' | 'WARNING' | 'BLOCKED'
export interface Finding { status: FindingStatus; message: string }
export interface ValidationCategory { key: string; label: string; status: FindingStatus; findings: Finding[] }
export interface ValidationResult { overall: 'PASS' | 'WARNING' | 'BLOCKED'; categories: ValidationCategory[] }

const A = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const S = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0

function cat(key: string, label: string, findings: Finding[]): ValidationCategory {
  const status: FindingStatus = findings.some((f) => f.status === 'BLOCKED')
    ? 'BLOCKED'
    : findings.some((f) => f.status === 'WARNING')
      ? 'WARNING'
      : 'PASS'
  return { key, label, status, findings: findings.length ? findings : [{ status: 'PASS', message: 'All checks passed' }] }
}

const B = (m: string): Finding => ({ status: 'BLOCKED', message: m })
const W = (m: string): Finding => ({ status: 'WARNING', message: m })

export async function runValidation(tenantId: string): Promise<ValidationResult | null> {
  const ctx = await loadContext(tenantId)
  if (!ctx) return null

  const cfg = ctx.configs
  const t = ctx.tenant
  const branches = ctx.branches.filter((b) => b.isActive)
  const programs = ctx.programs.filter((p) => p.isActive)
  const rooms = ctx.classrooms.filter((c) => c.isActive)
  const cur = ctx.currentSession
  const curRooms = cur ? rooms.filter((c) => c.academicSessionId === cur.id) : []
  const activeSubs = ctx.subjects.filter((s) => s.status === 'ACTIVE')

  const categories: ValidationCategory[] = [
    cat('identity', 'Identity (School Profile)', [
      !t.name || !t.code ? B('School name or code missing') : W(''),
      !t.email || !t.phone ? B('School email / contact number missing') : W(''),
      !t.city || !t.address ? W('City / address incomplete — appears on reports and documents') : W(''),
    ].filter((f) => f.message !== '')),

    cat('branch', 'Branch / Campus & Infrastructure', [
      branches.length === 0 ? B('No active branch exists') : W(''),
      branches.some((b) => b.timingOpen >= b.timingClose) ? B('A branch has closing time before opening time') : W(''),
      rooms.length === 0 ? B('No classroom rooms configured') : W(''),
      rooms.some((r) => r.capacity <= 0) ? B('A room has zero or invalid capacity') : W(''),
      ctx.facilities.filter((f) => f.isActive).length === 0 ? W('No play / nap / meal / medical areas registered (recommended)') : W(''),
    ].filter((f) => f.message !== '')),

    cat('users_rbac', 'Users & RBAC (M01 Identity)', [
      ctx.memberships.filter((m) => m.status === 'ACTIVE').length < 2 ? B('At least two operating accounts (owner + staff) are required') : W(''),
      !ctx.memberships.some((m) => m.role === 'OWNER' && m.status === 'ACTIVE') ? B('No active owner account') : W(''),
      !ctx.memberships.some((m) => ['PRINCIPAL', 'TEACHER', 'ACCOUNTS', 'RECEPTIONIST', 'STAFF'].includes(m.role) && m.status === 'ACTIVE')
        ? B('No operating staff account (Principal, Teacher, Accounts, or Receptionist)')
        : W(''),
    ].filter((f) => f.message !== '')),

    cat('academic', 'Academic Structure & Classrooms', [
      !cur ? B('No academic year is marked current') : W(''),
      cur && cur.startDate >= cur.endDate ? B('Academic year end date is not after start date') : W(''),
      cur && curRooms.length === 0 ? B('No active classes in the current academic year') : W(''),
      curRooms.some((c) => c.programId == null) ? W('Some classes are not linked to a program record') : W(''),
    ].filter((f) => f.message !== '')),

    cat('subject', 'Subjects & Activities', [
      activeSubs.length === 0 ? B('No active academic subjects or activities configured') : W(''),
      programs.length > 0 && ctx.programSubjects.length === 0 ? W('Subjects not mapped to programs yet') : W(''),
    ].filter((f) => f.message !== '')),

    cat('curriculum', 'Curriculum & Learning Areas', [
      A(cfg.CURRICULUM?.learningAreas).length === 0 && ctx.curriculums.length === 0
        ? B('No learning areas defined — observations and report cards need them')
        : W(''),
      A(cfg.CURRICULUM?.assessmentMethods).length === 0 ? W('No assessment methods configured (recommended)') : W(''),
    ].filter((f) => f.message !== '')),

    cat('calendar', 'School Calendar Readiness', [
      A(cfg.OPERATING?.workingDays).length === 0 ? B('Working days not configured') : W(''),
      cur && !ctx.calendarEvents.some((e) => e.date >= cur.startDate && e.date <= cur.endDate)
        ? W('No calendar events (holidays/terms) in the current academic year')
        : W(''),
    ].filter((f) => f.message !== '')),

    cat('admissions', 'Admissions Readiness', [
      !S(cfg.ADMISSION?.admissionOpenDate) ? W('Admission window not set — admissions module cannot open') : W(''),
      A(cfg.ADMISSION?.requiredDocuments).length === 0 ? W('No required documents configured for applications') : W(''),
      A(cfg.ADMISSION?.approvalStages).length === 0 ? W('Approval workflow stages not configured — default single-step will apply') : W(''),
      programs.length === 0 ? B('No programs — nothing to admit into') : W(''),
    ].filter((f) => f.message !== '')),

    cat('students_parents', 'Student & Parent Safeguards', [
      A(cfg.STUDENT_PARENT?.consentTypes).length === 0 ? B('No consent types defined — enrolment cannot collect consent') : W(''),
      cfg.STUDENT_PARENT?.pickupVerification === undefined && cfg.DAILY_OPERATIONS?.pickupVerification === undefined
        ? B('Authorised pickup verification rules missing')
        : W(''),
    ].filter((f) => f.message !== '')),

    cat('finance', 'Fees & Finance', [
      programs.length > 0 && programs.some((p) => !ctx.feePlans.some((f) => f.isActive && f.programType === p.programType))
        ? B(`No active fee plan exists for: ${programs.filter((p) => !ctx.feePlans.some((f) => f.isActive && f.programType === p.programType)).map((p) => p.name).join(', ')}`)
        : W(''),
      A(cfg.FINANCE?.paymentMethods).length === 0 ? W('Accepted payment methods not configured (defaults: Cash, UPI, Bank)') : W(''),
    ].filter((f) => f.message !== '')),

    cat('daily_operations', 'Daily Operations Readiness', [
      cfg.DAILY_OPERATIONS?.attendanceEnabled !== true ? B('Attendance is not enabled — core daily operation') : W(''),
      A(cfg.DAILY_OPERATIONS?.recordTypes).length === 0 ? W('No daily record types (meals/nap/bathroom/mood) selected') : W(''),
    ].filter((f) => f.message !== '')),

    cat('health_safety', 'Health & Safety Settings', [
      A(cfg.HEALTH_SAFETY?.allergyCategories).length === 0 ? W('No allergy categories configured') : W(''),
      A(cfg.HEALTH_SAFETY?.incidentCategories).length === 0 ? W('No incident categories configured') : W(''),
      A(cfg.HEALTH_SAFETY?.emergencyContacts).length === 0 ? B('No emergency contacts configured') : W(''),
    ].filter((f) => f.message !== '')),

    cat('communication', 'Communication Channels', [
      A(cfg.COMMUNICATION?.channels).length === 0 ? B('No communication channel enabled') : W(''),
      A(cfg.COMMUNICATION?.notificationEvents).length === 0 ? W('No notification events mapped (fee reminders, health alerts)') : W(''),
    ].filter((f) => f.message !== '')),

    cat('documents', 'Templates Registry', [
      A(cfg.DOCUMENT_TEMPLATES?.templates).length === 0 ? W('No document templates registered (recommended — receipts fall back to defaults)') : W(''),
    ].filter((f) => f.message !== '')),

    cat('data', 'Data Quality & Staffing', [
      curRooms.some((c) => c.primaryTeacherId == null) ? W(`${curRooms.filter((c) => c.primaryTeacherId == null).length} class(es) without a primary teacher`) : W(''),
      ctx.studentCount > 0 && ctx.studentCount === 0 ? W('') : W(''),
    ].filter((f) => f.message !== '')),
  ]

  const overall = categories.some((c) => c.status === 'BLOCKED')
    ? 'BLOCKED'
    : categories.some((c) => c.status === 'WARNING')
      ? 'WARNING'
      : 'PASS'

  return { overall, categories }
}

/** Run validation, persist it in SchoolSetupValidationRun, and advance the state machine. */
export async function validateAndRecord(
  tenantId: string,
  kind: 'SETUP_VALIDATION' | 'GO_LIVE_CHECK',
  actor: { id: string; name: string }
): Promise<ValidationResult | null> {
  const result = await runValidation(tenantId)
  if (!result) return null

  await db.schoolSetupValidationRun.create({
    data: {
      tenantId,
      kind,
      overall: result.overall,
      result: result as unknown as object,
      runById: actor.id,
      runByName: actor.name,
    },
  })

  const setup = await db.schoolSetup.findUnique({ where: { tenantId } })
  if (!setup) return result

  const data: { lastValidationAt: Date; status?: 'READY_FOR_GO_LIVE' | 'READY_FOR_REVIEW' } = { lastValidationAt: new Date() }
  if (setup.status !== 'LIVE') {
    if (result.overall !== 'BLOCKED') {
      if (setup.status === 'READY_FOR_REVIEW' || setup.status === 'IN_PROGRESS') {
        data.status = 'READY_FOR_GO_LIVE'
      }
    } else if (setup.status === 'READY_FOR_GO_LIVE') {
      data.status = 'READY_FOR_REVIEW'
    }
  }

  await db.schoolSetup.update({ where: { tenantId }, data })
  return result
}
