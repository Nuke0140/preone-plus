/**
 * M00 — Setup Engine (v2 Canonical 17-Area Architecture)
 *
 * The engine DERIVES step completion from real operational data
 * (one source of truth) and drives the persistent state machine
 * stored in SchoolSetup / SchoolSetupStep.
 *
 * Step lifecycle:  PENDING → BLOCKED(deps unmet) → COMPLETE(actor, snapshot)
 * Drift detection: COMPLETE + changedAfterCompletion=true (Point 2 resolved)
 * Tenant lifecycle: NOT_STARTED → IN_PROGRESS/BLOCKED → READY_FOR_REVIEW
 *                   → READY_FOR_GO_LIVE (validation) → LIVE (go-live)
 */
import { db } from '@/lib/db'
import { audit } from '@/lib/sequence'
import { SETUP_STEPS, STEP_MAP, isUnlocked, type StepKey, LEGACY_KEY_MAP } from './steps'

type StepStatus = 'PENDING' | 'COMPLETE' | 'BLOCKED' | 'SKIPPED'

interface CtxBranch { id: string; name: string; code: string; timingOpen: string; timingClose: string; capacity: number | null; isActive: boolean }
interface CtxProgram { id: string; code: string; name: string; programType: string; ageMinMonths: number | null; ageMaxMonths: number | null; capacity: number; isActive: boolean }
interface CtxClassroom { id: string; branchId: string; academicSessionId: string; programType: string; programId: string | null; capacity: number; primaryTeacherId: string | null; isActive: boolean }

export interface TenantContext {
  tenant: {
    id: string; name: string; code: string; email: string | null; phone: string | null
    city: string | null; state: string | null; address: string | null; website: string | null
    timezone: string; locale: string; logoUrl: string | null; principalSignatureUrl: string | null
  }
  branches: CtxBranch[]
  programs: CtxProgram[]
  classrooms: CtxClassroom[]
  facilities: { id: string; branchId: string; type: string; isActive: boolean }[]
  currentSession: { id: string; name: string; startDate: Date; endDate: Date; isCurrent: boolean } | null
  memberships: { id: string; userId: string; role: string; branchId: string | null; status: string }[]
  staffProfiles: { id: string; userId: string; branchId: string | null; employeeCode: string }[]
  calendarEvents: { id: string; type: string; date: Date }[]
  feePlans: { id: string; programType: string; isActive: boolean; totalAnnualCents: number }[]
  subjects: { id: string; code: string; name: string; subjectType: string; status: string }[]
  programSubjects: { id: string; programId: string; subjectId: string }[]
  classroomSubjects: { id: string; classroomId: string; subjectId: string; specialistTeacherId: string | null }[]
  curriculums: { id: string; name: string; framework: string; status: string; learningAreasCount: number }[]
  configs: Record<string, Record<string, unknown>>
  studentCount: number
}

/** Load everything the predicates need, scoped to the tenant. */
export async function loadContext(tenantId: string): Promise<TenantContext | null> {
  const tenant = await db.tenant.findFirst({ where: { id: tenantId, deletedAt: null } })
  if (!tenant) return null

  const [
    branches,
    programs,
    classrooms,
    facilities,
    sessions,
    memberships,
    staffProfiles,
    calendarEvents,
    feePlans,
    subjects,
    programSubjects,
    classroomSubjects,
    curriculums,
    configs,
    studentCount,
  ] = await Promise.all([
    db.branch.findMany({ where: { tenantId, deletedAt: null }, orderBy: { createdAt: 'asc' } }),
    db.program.findMany({ where: { tenantId, deletedAt: null }, orderBy: { createdAt: 'asc' } }),
    db.classroom.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } }),
    db.facility.findMany({ where: { tenantId, deletedAt: null } }),
    db.academicSession.findMany({ where: { tenantId }, orderBy: { startDate: 'desc' } }),
    db.tenantUser.findMany({ where: { tenantId, deletedAt: null } }),
    db.staffProfile.findMany({ where: { tenantId, deletedAt: null } }),
    db.calendarEvent.findMany({ where: { tenantId }, orderBy: { date: 'asc' } }),
    db.feePlan.findMany({ where: { tenantId } }),
    db.subject.findMany({ where: { tenantId, deletedAt: null } }),
    db.programSubject.findMany({ where: { tenantId } }),
    db.classroomSubject.findMany({ where: { tenantId } }),
    db.curriculum.findMany({
      where: { tenantId, deletedAt: null },
      include: { learningAreas: { where: { deletedAt: null } } },
    }),
    db.schoolConfig.findMany({ where: { tenantId } }),
    db.student.count({ where: { tenantId, deletedAt: null } }),
  ])

  const current = sessions.find((s) => s.isCurrent) ?? null
  return {
    tenant: {
      id: tenant.id, name: tenant.name, code: tenant.code,
      email: tenant.email, phone: tenant.phone, city: tenant.city, state: tenant.state,
      address: tenant.address, website: tenant.website,
      timezone: tenant.timezone, locale: tenant.locale, logoUrl: tenant.logoUrl,
      principalSignatureUrl: tenant.principalSignatureUrl,
    },
    branches: branches.map((b) => ({ id: b.id, name: b.name, code: b.code, timingOpen: b.timingOpen, timingClose: b.timingClose, capacity: b.capacity, isActive: b.isActive })),
    programs: programs.map((p) => ({ id: p.id, code: p.code, name: p.name, programType: p.programType, ageMinMonths: p.ageMinMonths, ageMaxMonths: p.ageMaxMonths, capacity: p.capacity, isActive: p.isActive })),
    classrooms: classrooms.map((c) => ({ id: c.id, branchId: c.branchId, academicSessionId: c.academicSessionId, programType: c.programType, programId: c.programId, capacity: c.capacity, primaryTeacherId: c.primaryTeacherId, isActive: c.isActive })),
    facilities: facilities.map((f) => ({ id: f.id, branchId: f.branchId, type: f.type, isActive: f.isActive })),
    currentSession: current ? { id: current.id, name: current.name, startDate: current.startDate, endDate: current.endDate, isCurrent: current.isCurrent } : null,
    memberships: memberships.map((m) => ({ id: m.id, userId: m.userId, role: m.role, branchId: m.branchId, status: m.status })),
    staffProfiles: staffProfiles.map((s) => ({ id: s.id, userId: s.userId, branchId: s.branchId, employeeCode: s.employeeCode })),
    calendarEvents: calendarEvents.map((e) => ({ id: e.id, type: e.type, date: e.date })),
    feePlans: feePlans.map((f) => ({ id: f.id, programType: f.programType, isActive: f.isActive, totalAnnualCents: f.totalAnnualCents })),
    subjects: subjects.map((s) => ({ id: s.id, code: s.code, name: s.name, subjectType: s.subjectType, status: s.status })),
    programSubjects: programSubjects.map((ps) => ({ id: ps.id, programId: ps.programId, subjectId: ps.subjectId })),
    classroomSubjects: classroomSubjects.map((cs) => ({ id: cs.id, classroomId: cs.classroomId, subjectId: cs.subjectId, specialistTeacherId: cs.specialistTeacherId })),
    curriculums: curriculums.map((c) => ({ id: c.id, name: c.name, framework: c.framework, status: c.status, learningAreasCount: c.learningAreas.length })),
    configs: Object.fromEntries(configs.map((c) => [c.domain, (c.data ?? {}) as Record<string, unknown>])),
    studentCount,
  }
}

// ── helpers ─────────────────────────────────────────────────────────
const activeBranches = (ctx: TenantContext) => ctx.branches.filter((b) => b.isActive)
const activePrograms = (ctx: TenantContext) => ctx.programs.filter((p) => p.isActive)
const activeClassrooms = (ctx: TenantContext) => ctx.classrooms.filter((c) => c.isActive)
const currentClassrooms = (ctx: TenantContext) =>
  ctx.currentSession ? activeClassrooms(ctx).filter((c) => c.academicSessionId === ctx.currentSession!.id) : []
const str = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const arr = (v: unknown): unknown[] => Array.isArray(v) ? v : []
const activeMemberships = (ctx: TenantContext) => ctx.memberships.filter((m) => m.status === 'ACTIVE')

export interface StepEvaluation {
  satisfied: boolean
  blocked: boolean
  reason?: string
  detail: string
  snapshot: Record<string, unknown>
  missingDeps: string[]
}

/** Pure predicate per step across the 17 canonical areas — derived ONLY from real data. */
export function evaluateStep(key: StepKey, ctx: TenantContext): StepEvaluation {
  const noDeps: string[] = []
  switch (key) {
    // ── Phase 1 — Foundation (4) ──────────────────────────────────────
    case 'school_profile': {
      const missing: string[] = []
      if (!ctx.tenant.name) missing.push('name')
      if (!ctx.tenant.code) missing.push('code')
      if (!ctx.tenant.email) missing.push('email')
      if (!ctx.tenant.phone) missing.push('phone')
      if (!ctx.tenant.city) missing.push('city')
      if (!ctx.tenant.address) missing.push('address')
      const ok = missing.length === 0
      return {
        satisfied: ok,
        blocked: false,
        detail: ok ? 'School legal identity and contact complete' : `Missing: ${missing.join(', ')}`,
        snapshot: {
          name: ctx.tenant.name,
          email: ctx.tenant.email,
          phone: ctx.tenant.phone,
          address: ctx.tenant.address,
          city: ctx.tenant.city,
          hasSignature: !!ctx.tenant.principalSignatureUrl,
        },
        missingDeps: noDeps,
      }
    }
    case 'branch': {
      const active = activeBranches(ctx)
      const n = active.length
      const validTimings = active.every((b) => b.timingOpen < b.timingClose)
      const rooms = ctx.facilities.filter((f) => f.isActive).length + activeClassrooms(ctx).length
      const ok = n >= 1 && validTimings && rooms >= 1
      return {
        satisfied: ok,
        blocked: false,
        detail: !ok
          ? n === 0
            ? 'No active branch configured'
            : !validTimings
              ? 'Branch closing time must be after opening time'
              : 'At least one classroom/facility room required'
          : `${n} branch(es), ${rooms} room(s) registered`,
        snapshot: { branches: n, rooms, validTimings },
        missingDeps: noDeps,
      }
    }
    case 'branding': {
      const bc = ctx.configs.BRANDING ?? {}
      const ok = !!ctx.tenant.logoUrl || Object.keys(bc).length > 0
      return {
        satisfied: ok,
        blocked: false,
        detail: ok ? 'Logo and portal branding configured' : 'School logo or theme colors not set yet (recommended)',
        snapshot: { logo: !!ctx.tenant.logoUrl, config: Object.keys(bc).length },
        missingDeps: noDeps,
      }
    }
    case 'roles': {
      // M01 canonical check: at least 2 active accounts, with an active OWNER
      const n = activeMemberships(ctx).length
      const hasOwner = ctx.memberships.some((m) => m.role === 'OWNER' && m.status === 'ACTIVE')
      const hasStaff = ctx.memberships.some(
        (m) => ['PRINCIPAL', 'TEACHER', 'ACCOUNTS', 'RECEPTIONIST', 'STAFF'].includes(m.role) && m.status === 'ACTIVE'
      )
      const ok = hasOwner && hasStaff && n >= 2
      return {
        satisfied: ok,
        blocked: false,
        detail: ok
          ? `${n} operating user account(s) ready`
          : !hasOwner
            ? 'Active Owner account required'
            : 'At least one operating staff account required (Principal, Teacher, Accounts, or Receptionist)',
        snapshot: { memberships: n, hasOwner, hasStaff },
        missingDeps: noDeps,
      }
    }

    // ── Phase 2 — Academic Structure (5) ──────────────────────────────
    case 'academic_year': {
      const s = ctx.currentSession
      const valid = !!s && s.startDate < s.endDate
      return {
        satisfied: valid,
        blocked: false,
        detail: s
          ? valid
            ? `Current year: ${s.name}`
            : 'Current academic year has an invalid date range'
          : 'No academic year marked current',
        snapshot: { session: s?.name ?? null, valid },
        missingDeps: noDeps,
      }
    }
    case 'curriculum': {
      const cu = ctx.configs.CURRICULUM ?? {}
      const areas = arr(cu.learningAreas)
      const activeCurr = ctx.curriculums.filter((c) => c.status === 'ACTIVE')
      const totalAreas = areas.length + activeCurr.reduce((sum, c) => sum + c.learningAreasCount, 0)
      const ok = totalAreas >= 1 || activeCurr.length >= 1
      return {
        satisfied: ok,
        blocked: false,
        detail: ok ? `${totalAreas} learning area(s) configured` : 'Curriculum framework or learning areas not configured',
        snapshot: { learningAreas: totalAreas, frameworks: activeCurr.length },
        missingDeps: noDeps,
      }
    }
    case 'programs': {
      const active = activePrograms(ctx)
      const n = active.length
      const ok = n >= 1 && active.every((p) => p.capacity > 0)
      return {
        satisfied: ok,
        blocked: false,
        detail: n === 0
          ? 'No active programs configured'
          : ok
            ? `${n} active program(s) configured`
            : 'Some programs have zero or invalid capacity',
        snapshot: { programs: n },
        missingDeps: noDeps,
      }
    }
    case 'classroom': {
      const cur = currentClassrooms(ctx)
      const linked = cur.filter((c) => c.programId != null && c.capacity > 0)
      const unassigned = cur.filter((c) => c.primaryTeacherId == null).length
      const ok = linked.length >= 1 && unassigned === 0
      return {
        satisfied: ok,
        blocked: false,
        detail: linked.length === 0
          ? 'No classroom section linked to a program for current year'
          : unassigned > 0
            ? `${unassigned} class(es) without an assigned primary teacher`
            : `${linked.length} classroom(s) ready with teachers assigned`,
        snapshot: { classrooms: cur.length, linked: linked.length, unassigned },
        missingDeps: noDeps,
      }
    }
    case 'subject': {
      const activeSubs = ctx.subjects.filter((s) => s.status === 'ACTIVE')
      const mapped = ctx.programSubjects.length
      const ok = activeSubs.length >= 1 && mapped >= 1
      return {
        satisfied: ok,
        blocked: false,
        detail: activeSubs.length === 0
          ? 'No academic subjects or activities created'
          : mapped === 0
            ? 'Subjects must be mapped to at least one preschool program'
            : `${activeSubs.length} subject(s) active across ${mapped} program mapping(s)`,
        snapshot: { subjects: activeSubs.length, programMappings: mapped },
        missingDeps: noDeps,
      }
    }

    // ── Phase 3 — Operations (4) ──────────────────────────────────────
    case 'mood_environment': {
      const mc = ctx.configs.MOOD_ENVIRONMENT ?? {}
      const moods = arr(mc.enabledMoods)
      const ok = moods.length >= 1 || Object.keys(mc).length > 0
      return {
        satisfied: ok,
        blocked: false,
        detail: ok ? `${moods.length} mood state(s) configured` : 'Mood & environment parameters not configured (recommended)',
        snapshot: { moods: moods.length },
        missingDeps: noDeps,
      }
    }
    case 'health_settings': {
      const hc = ctx.configs.HEALTH_SAFETY ?? {}
      const allergy = arr(hc.allergyCategories)
      const incident = arr(hc.incidentCategories)
      const contacts = arr(hc.emergencyContacts)
      const ok = allergy.length >= 1 && incident.length >= 1 && contacts.length >= 1
      return {
        satisfied: ok,
        blocked: false,
        detail: ok
          ? 'Allergy, incident triage and emergency contacts ready'
          : 'Allergy categories, incident categories or emergency contacts missing',
        snapshot: { allergy: allergy.length, incident: incident.length, contacts: contacts.length },
        missingDeps: noDeps,
      }
    }
    case 'daily_operations': {
      const dc = ctx.configs.DAILY_OPERATIONS ?? {}
      const oc = ctx.configs.OPERATING ?? {}
      const recs = arr(dc.recordTypes)
      const workingDays = arr(oc.workingDays)
      const ok = dc.attendanceEnabled === true && recs.length >= 1 && workingDays.length >= 1
      return {
        satisfied: ok,
        blocked: false,
        detail: ok
          ? `Attendance enabled, ${recs.length} record type(s), ${workingDays.length} working day(s)`
          : 'Attendance, daily care record types or working days not configured',
        snapshot: { attendance: dc.attendanceEnabled === true, recordTypes: recs.length, workingDays: workingDays.length },
        missingDeps: noDeps,
      }
    }
    case 'observation': {
      const cu = ctx.configs.CURRICULUM ?? {}
      const methods = arr(cu.assessmentMethods)
      const hasStructure = str(cu.observationStructure) || methods.length >= 1
      return {
        satisfied: hasStructure,
        blocked: false,
        detail: hasStructure ? 'Observation triage and assessment methods configured' : 'Early learning observation framework not configured',
        snapshot: { assessmentMethods: methods.length },
        missingDeps: noDeps,
      }
    }

    // ── Phase 4 — Business Rules (4) ──────────────────────────────────
    case 'fees_setup': {
      const progs = activePrograms(ctx)
      const covered = progs.filter((p) => ctx.feePlans.some((f) => f.isActive && f.programType === p.programType))
      const ok = progs.length >= 1 && covered.length === progs.length
      return {
        satisfied: ok,
        blocked: false,
        detail: progs.length === 0
          ? 'No programs to bill yet'
          : ok
            ? 'Active fee plans configured for every program'
            : `${progs.length - covered.length} program(s) without an active fee plan`,
        snapshot: { programs: progs.length, covered: covered.length },
        missingDeps: noDeps,
      }
    }
    case 'templates': {
      const tc = ctx.configs.DOCUMENT_TEMPLATES ?? {}
      const templates = arr(tc.templates)
      const ok = templates.length >= 1
      return {
        satisfied: ok,
        blocked: false,
        detail: ok ? `${templates.length} document template(s) registered` : 'No document templates registered (recommended)',
        snapshot: { templates: templates.length },
        missingDeps: noDeps,
      }
    }
    case 'communication': {
      const cc = ctx.configs.COMMUNICATION ?? {}
      const channels = arr(cc.channels)
      const events = arr(cc.notificationEvents)
      const ok = channels.length >= 1 && events.length >= 1
      return {
        satisfied: ok,
        blocked: false,
        detail: ok ? `${channels.length} delivery channel(s), ${events.length} event trigger(s)` : 'Channels or event triggers not configured',
        snapshot: { channels: channels.length, events: events.length },
        missingDeps: noDeps,
      }
    }
    case 'promotion': {
      const pc = ctx.configs.PROMOTION ?? {}
      const ok = Object.keys(pc).length > 0 || activePrograms(ctx).length >= 1
      return {
        satisfied: ok,
        blocked: false,
        detail: ok ? 'Promotion progression rules configured' : 'Progression mapping not set (recommended)',
        snapshot: { configured: Object.keys(pc).length > 0 },
        missingDeps: noDeps,
      }
    }

    default:
      return { satisfied: false, blocked: false, detail: 'Unknown setup area', snapshot: {}, missingDeps: noDeps }
  }
}

// ── persistence ─────────────────────────────────────────────────────

/** Lazy-init & migration: guarantee SchoolSetup + canonical 17 step rows exist. */
export async function ensureSetupRows(tenantId: string): Promise<void> {
  const tenantExists = await db.tenant.findFirst({ where: { id: tenantId, deletedAt: null } })
  if (!tenantExists) return

  await db.schoolSetup.upsert({
    where: { tenantId },
    create: { tenantId, status: 'NOT_STARTED' },
    update: {},
  })

  // Migrate any legacy step keys in database
  for (const [oldKey, newKey] of Object.entries(LEGACY_KEY_MAP)) {
    const oldRow = await db.schoolSetupStep.findUnique({
      where: { tenantId_stepKey: { tenantId, stepKey: oldKey } },
    })
    if (oldRow) {
      const existingNew = await db.schoolSetupStep.findUnique({
        where: { tenantId_stepKey: { tenantId, stepKey: newKey } },
      })
      if (!existingNew) {
        await db.schoolSetupStep.update({
          where: { id: oldRow.id },
          data: { stepKey: newKey },
        })
      } else {
        await db.schoolSetupStep.delete({ where: { id: oldRow.id } })
      }
    }
  }

  // Ensure all 17 canonical steps exist
  const existing = await db.schoolSetupStep.findMany({ where: { tenantId } })
  const have = new Set(existing.map((s) => s.stepKey))
  const toCreate = SETUP_STEPS.filter((s) => !have.has(s.key))
  if (toCreate.length) {
    await db.schoolSetupStep.createMany({
      data: toCreate.map((s) => ({ tenantId, stepKey: s.key, applicability: s.applicability })),
    })
  }

  // Prune any non-canonical legacy step keys remaining
  const validKeys = new Set(SETUP_STEPS.map((s) => s.key as string))
  const obsolete = existing.filter((r) => !validKeys.has(r.stepKey))
  if (obsolete.length > 0) {
    await db.schoolSetupStep.deleteMany({
      where: { id: { in: obsolete.map((r) => r.id) } },
    })
  }
}

export interface SetupStatusPayload {
  status: string
  progress: number
  startedAt: Date | null
  goLiveAt: Date | null
  steps: {
    key: string; label: string; phase: string; applicability: string; icon: string
    description: string; status: StepStatus; detail: string
    blockedReason: string | null; missingDeps: { key: string; label: string }[]
    completedAt: Date | null; completedByName: string | null
    changedAfterCompletion: boolean; driftState: boolean; lastCheckedAt: Date
    locked: boolean
  }[]
  nextStepKey: string | null
  guidance: { level: 'info' | 'warning'; message: string; stepKey: string }[]
}

/**
 * Re-evaluate every step against live data, persist transitions,
 * advance the tenant state machine, and return the dashboard payload.
 */
export async function syncSetup(
  tenantId: string,
  actor?: { id: string; name: string } | null
): Promise<SetupStatusPayload | null> {
  await ensureSetupRows(tenantId)
  const ctx = await loadContext(tenantId)
  if (!ctx) return null

  const rows = await db.schoolSetupStep.findMany({ where: { tenantId } })
  const statusByKey: Record<string, StepStatus> = Object.fromEntries(rows.map((r) => [r.stepKey, r.status as StepStatus]))

  const autoCompletes: string[] = []
  const autoOpens: string[] = []

  // pass 1 — evaluate deps then predicates
  for (const def of SETUP_STEPS) {
    const row = rows.find((r) => r.stepKey === def.key)
    if (!row) continue
    if (row.status === 'SKIPPED') {
      await db.schoolSetupStep.update({ where: { id: row.id }, data: { lastCheckedAt: new Date() } })
      continue
    }

    const missingDeps = def.deps.filter((d) => {
      const s = statusByKey[d]
      return s !== 'COMPLETE' && s !== 'SKIPPED'
    })
    const ev = evaluateStep(def.key, ctx)

    if (missingDeps.length > 0) {
      const reason = `Requires ${missingDeps.map((d) => STEP_MAP[d]?.label || d).join(' and ')} to be completed first.`
      if (row.status !== 'BLOCKED' || row.blockedReason !== reason) {
        await db.schoolSetupStep.update({
          where: { id: row.id },
          data: {
            status: 'BLOCKED',
            blockedReason: reason,
            lastCheckedAt: new Date(),
            changedAfterCompletion: row.status === 'COMPLETE' ? true : row.changedAfterCompletion,
          },
        })
        if (row.status === 'COMPLETE') autoOpens.push(def.key)
      }
      statusByKey[def.key] = 'BLOCKED'
      continue
    }

    if (ev.satisfied) {
      if (row.status !== 'COMPLETE') {
        await db.schoolSetupStep.update({
          where: { id: row.id },
          data: {
            status: 'COMPLETE',
            blockedReason: null,
            completedAt: row.completedAt ?? new Date(),
            completedById: row.completedById ?? actor?.id ?? 'system',
            completedByName: row.completedByName ?? actor?.name ?? 'system (auto-evaluated)',
            dataSnapshot: ev.snapshot as any,
            lastCheckedAt: new Date(),
            changedAfterCompletion: false,
          },
        })
        statusByKey[def.key] = 'COMPLETE'
        autoCompletes.push(def.key)
      } else {
        const changed = JSON.stringify(row.dataSnapshot ?? {}) !== JSON.stringify(ev.snapshot)
        if (changed || row.changedAfterCompletion) {
          await db.schoolSetupStep.update({
            where: { id: row.id },
            data: {
              dataSnapshot: ev.snapshot as any,
              changedAfterCompletion: changed ? true : row.changedAfterCompletion,
              lastCheckedAt: new Date(),
            },
          })
        } else {
          await db.schoolSetupStep.update({ where: { id: row.id }, data: { lastCheckedAt: new Date() } })
        }
      }
    } else {
      if (row.status === 'COMPLETE') {
        // Step was COMPLETE but underlying data drifted!
        await db.schoolSetupStep.update({
          where: { id: row.id },
          data: { status: 'PENDING', changedAfterCompletion: true, lastCheckedAt: new Date() },
        })
        statusByKey[def.key] = 'PENDING'
        autoOpens.push(def.key)
      } else if (row.status !== 'PENDING' || row.blockedReason != null) {
        await db.schoolSetupStep.update({
          where: { id: row.id },
          data: { status: 'PENDING', blockedReason: null, lastCheckedAt: new Date() },
        })
        statusByKey[def.key] = 'PENDING'
      }
    }
  }

  if (autoCompletes.length || autoOpens.length) {
    await audit({
      tenantId, actorId: actor?.id ?? null, actorName: actor?.name ?? 'system',
      action: 'SETUP_SYNC', entity: 'SchoolSetupStep', entityId: tenantId,
      summary: `Auto-evaluation: completed [${autoCompletes.join(', ') || '—'}], reopened [${autoOpens.join(', ') || '—'}]`,
    })
  }

  // pass 2 — tenant state machine + progress
  const freshRows = await db.schoolSetupStep.findMany({ where: { tenantId } })
  const mandatory = freshRows.filter((r) => r.applicability === 'MANDATORY')
  const mandatoryDone = mandatory.filter((r) => r.status === 'COMPLETE' || r.status === 'SKIPPED').length
  const anyBlocked = mandatory.some((r) => r.status === 'BLOCKED')
  const doneCount = freshRows.filter((r) => r.status === 'COMPLETE' || r.status === 'SKIPPED').length
  const progress = freshRows.length ? Math.round((doneCount / freshRows.length) * 100) : 0

  const setup = await db.schoolSetup.findUnique({ where: { tenantId } })
  let status = setup!.status
  if (status !== 'LIVE') {
    if (mandatoryDone === mandatory.length && mandatory.length > 0) {
      if (anyBlocked) status = 'BLOCKED'
      else if (status === 'NOT_STARTED' || status === 'IN_PROGRESS' || status === 'BLOCKED') status = 'READY_FOR_REVIEW'
    } else {
      status = anyBlocked ? 'BLOCKED' : doneCount > 0 ? 'IN_PROGRESS' : 'NOT_STARTED'
    }
    if (status !== setup!.status) {
      await db.schoolSetup.update({ where: { tenantId }, data: { status, startedAt: setup!.startedAt ?? new Date() } })
    }
  }

  // next action + guidance
  const unlockedPending = SETUP_STEPS.filter((d) => {
    const s = freshRows.find((r) => r.stepKey === d.key)
    return s && (s.status === 'PENDING' || s.status === 'BLOCKED') && isUnlocked(d, (k) => (freshRows.find((r) => r.stepKey === k)?.status as StepStatus) ?? 'BLOCKED')
  })
  const nextStepKey = unlockedPending[0]?.key ?? null

  const guidance: { level: 'info' | 'warning'; message: string; stepKey: string }[] = []
  for (const r of freshRows) {
    if (r.status === 'BLOCKED' && r.blockedReason) {
      guidance.push({ level: 'warning', message: r.blockedReason, stepKey: r.stepKey })
    } else if (r.status === 'COMPLETE' && r.changedAfterCompletion) {
      guidance.push({ level: 'warning', message: 'Configuration has changed since completion — review recommended.', stepKey: r.stepKey })
    }
  }

  return {
    status,
    progress,
    startedAt: setup!.startedAt,
    goLiveAt: setup!.goLiveAt,
    steps: SETUP_STEPS.map((def) => {
      const row = freshRows.find((r) => r.stepKey === def.key)
      const ev = evaluateStep(def.key, ctx)
      const missingDeps = def.deps
        .filter((d) => {
          const s = freshRows.find((r) => r.stepKey === d)?.status
          return s !== 'COMPLETE' && s !== 'SKIPPED'
        })
        .map((d) => ({ key: d, label: STEP_MAP[d]?.label ?? d }))

      const rowStatus = (row?.status as StepStatus) ?? 'BLOCKED'
      const changedAfter = row?.changedAfterCompletion ?? false
      return {
        key: def.key,
        label: def.label,
        phase: def.phase,
        applicability: def.applicability,
        icon: def.icon,
        description: def.description,
        status: rowStatus,
        detail: ev.detail,
        blockedReason: row?.blockedReason ?? null,
        missingDeps,
        completedAt: row?.completedAt ?? null,
        completedByName: row?.completedByName ?? null,
        changedAfterCompletion: changedAfter,
        driftState: rowStatus === 'COMPLETE' && changedAfter,
        lastCheckedAt: row?.lastCheckedAt ?? new Date(),
        locked: !isUnlocked(def, (k) => (freshRows.find((r) => r.stepKey === k)?.status as StepStatus) ?? 'BLOCKED'),
      }
    }),
    nextStepKey,
    guidance,
  }
}

/** Explicit Complete step action */
export async function completeStep(
  tenantId: string,
  key: string,
  actor: { id: string; name: string }
): Promise<{ ok: boolean; message: string; detail?: string }> {
  const def = STEP_MAP[key]
  if (!def) return { ok: false, message: `Unknown step: ${key}` }

  await ensureSetupRows(tenantId)
  const ctx = await loadContext(tenantId)
  if (!ctx) return { ok: false, message: 'Tenant not found' }

  const rows = await db.schoolSetupStep.findMany({ where: { tenantId } })
  const statusByKey: Record<string, StepStatus> = Object.fromEntries(rows.map((r) => [r.stepKey, r.status as StepStatus]))

  const missing = def.deps.filter((d) => statusByKey[d] !== 'COMPLETE' && statusByKey[d] !== 'SKIPPED')
  if (missing.length) {
    return { ok: false, message: `Prerequisites not met: ${missing.map((d) => STEP_MAP[d]?.label || d).join(', ')}` }
  }

  const ev = evaluateStep(def.key, ctx)
  if (!ev.satisfied) {
    return { ok: false, message: ev.detail || 'Requirements not satisfied by operational data' }
  }

  await db.schoolSetupStep.update({
    where: { tenantId_stepKey: { tenantId, stepKey: def.key } },
    data: {
      status: 'COMPLETE',
      blockedReason: null,
      completedAt: new Date(),
      completedById: actor.id,
      completedByName: actor.name,
      dataSnapshot: ev.snapshot as any,
      changedAfterCompletion: false,
      lastCheckedAt: new Date(),
    },
  })

  await audit({
    tenantId, actorId: actor.id, actorName: actor.name,
    action: 'SETUP_STEP_COMPLETED', entity: 'SchoolSetupStep', entityId: def.key,
    summary: `Completed step: ${def.label}`,
  })

  return { ok: true, message: `Completed ${def.label}` }
}

/** Explicit Skip step action (allowed only for OPTIONAL or RECOMMENDED) */
export async function skipStep(
  tenantId: string,
  key: string,
  actor: { id: string; name: string }
): Promise<{ ok: boolean; message: string }> {
  const def = STEP_MAP[key]
  if (!def) return { ok: false, message: `Unknown step: ${key}` }
  if (def.applicability === 'MANDATORY') {
    return { ok: false, message: `${def.label} is MANDATORY and cannot be skipped` }
  }

  await ensureSetupRows(tenantId)
  await db.schoolSetupStep.update({
    where: { tenantId_stepKey: { tenantId, stepKey: def.key } },
    data: { status: 'SKIPPED', lastCheckedAt: new Date() },
  })

  await audit({
    tenantId, actorId: actor.id, actorName: actor.name,
    action: 'SETUP_STEP_SKIPPED', entity: 'SchoolSetupStep', entityId: def.key,
    summary: `Skipped step: ${def.label}`,
  })

  return { ok: true, message: `Skipped ${def.label}` }
}

/** Reopen step action */
export async function reopenStep(
  tenantId: string,
  key: string,
  actor: { id: string; name: string }
): Promise<{ ok: boolean; message: string }> {
  const def = STEP_MAP[key]
  if (!def) return { ok: false, message: `Unknown step: ${key}` }

  await ensureSetupRows(tenantId)
  await db.schoolSetupStep.update({
    where: { tenantId_stepKey: { tenantId, stepKey: def.key } },
    data: { status: 'PENDING', changedAfterCompletion: true, lastCheckedAt: new Date() },
  })

  await audit({
    tenantId, actorId: actor.id, actorName: actor.name,
    action: 'SETUP_STEP_REOPENED', entity: 'SchoolSetupStep', entityId: def.key,
    summary: `Reopened step: ${def.label}`,
  })

  return { ok: true, message: `Reopened ${def.label}` }
}
