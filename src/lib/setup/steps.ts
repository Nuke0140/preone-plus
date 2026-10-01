/**
 * M00 — Setup Step Registry (v2 Canonical 17-Area Architecture)
 *
 * Canonical definition of every Preschool Creation & Setup step:
 * applicability (MANDATORY / OPTIONAL / RECOMMENDED), dependency edges
 * (blocking), phase grouping and UI copy.
 *
 * Rules of the house:
 *  - Steps derive completion from REAL operational data — never from
 *    parallel "setup copies" of configuration.
 *  - Zero shadow tables: Existing PreOne entities are the source of truth
 *    (Tenant, Branch, AcademicSession, Program, Classroom, Subject, FeePlan, SchoolConfig).
 */

export type StepKey =
  // Phase 1 — Foundation (4)
  | 'school_profile'
  | 'branch'
  | 'branding'
  | 'roles'
  // Phase 2 — Academic Structure (5)
  | 'academic_year'
  | 'curriculum'
  | 'programs'
  | 'classroom'
  | 'subject'
  // Phase 3 — Operations (4)
  | 'mood_environment'
  | 'health_settings'
  | 'daily_operations'
  | 'observation'
  // Phase 4 — Business Rules (4)
  | 'fees_setup'
  | 'templates'
  | 'communication'
  | 'promotion'

export type Applicability = 'MANDATORY' | 'OPTIONAL' | 'RECOMMENDED'

export type StepPhase = 'FOUNDATION' | 'ACADEMIC_STRUCTURE' | 'OPERATIONS' | 'BUSINESS_RULES'

export interface StepDef {
  key: StepKey
  label: string
  phase: StepPhase
  applicability: Applicability
  /** blocking dependencies — all must be COMPLETE or SKIPPED before this step unlocks */
  deps: StepKey[]
  /** one-line explanation shown on the dashboard and step page */
  description: string
  /** lucide icon name (client maps string → component) */
  icon: string
}

export const SETUP_STEPS: StepDef[] = [
  // ── PHASE 1 — FOUNDATION ──────────────────────────────────────────────
  {
    key: 'school_profile',
    label: 'School Profile',
    phase: 'FOUNDATION',
    applicability: 'MANDATORY',
    deps: [],
    icon: 'School',
    description: 'Legal identity, address, contact details, timezone and authorized principal signature.',
  },
  {
    key: 'branch',
    label: 'Branch / Campus',
    phase: 'FOUNDATION',
    applicability: 'MANDATORY',
    deps: ['school_profile'],
    icon: 'Building2',
    description: 'At least one operating campus with address, operating timings and physical room infrastructure.',
  },
  {
    key: 'branding',
    label: 'Branding & Theme',
    phase: 'FOUNDATION',
    applicability: 'RECOMMENDED',
    deps: ['school_profile'],
    icon: 'Palette',
    description: 'School logo and brand colors applied across portals, receipts, report cards and communications.',
  },
  {
    key: 'roles',
    label: 'Roles & Permissions',
    phase: 'FOUNDATION',
    applicability: 'MANDATORY',
    deps: ['school_profile'],
    icon: 'ShieldCheck',
    description: 'Identity & access readiness: active school owner account plus at least one operating staff account.',
  },

  // ── PHASE 2 — ACADEMIC STRUCTURE ─────────────────────────────────────
  {
    key: 'academic_year',
    label: 'Academic Year',
    phase: 'ACADEMIC_STRUCTURE',
    applicability: 'MANDATORY',
    deps: ['branch'],
    icon: 'CalendarRange',
    description: 'Operating academic session (with start/end dates) that rosters, admissions, attendance and fees hang from.',
  },
  {
    key: 'curriculum',
    label: 'Curriculum Approach',
    phase: 'ACADEMIC_STRUCTURE',
    applicability: 'MANDATORY',
    deps: ['academic_year'],
    icon: 'BookOpen',
    description: 'Pedagogical methodology (EYFS, Montessori, Reggio Emilia, NEP 2020) and core developmental learning areas.',
  },
  {
    key: 'programs',
    label: 'Program',
    phase: 'ACADEMIC_STRUCTURE',
    applicability: 'MANDATORY',
    deps: ['school_profile'],
    icon: 'Blocks',
    description: 'Preschool programs offered (Playgroup, Nursery, Jr KG, Sr KG, Daycare) with age bands and capacities.',
  },
  {
    key: 'classroom',
    label: 'Classroom',
    phase: 'ACADEMIC_STRUCTURE',
    applicability: 'MANDATORY',
    deps: ['academic_year', 'programs', 'branch'],
    icon: 'LayoutGrid',
    description: 'Class-section units per program with capacity, assigned room, and designated primary teacher.',
  },
  {
    key: 'subject',
    label: 'Subject',
    phase: 'ACADEMIC_STRUCTURE',
    applicability: 'MANDATORY',
    deps: ['programs', 'curriculum'],
    icon: 'GraduationCap',
    description: 'Academic subjects and activity disciplines (Core, Optional, Activity) mapped to programs and classrooms.',
  },

  // ── PHASE 3 — OPERATIONS ──────────────────────────────────────────────
  {
    key: 'mood_environment',
    label: 'Mood & Environment',
    phase: 'OPERATIONS',
    applicability: 'RECOMMENDED',
    deps: ['classroom'],
    icon: 'Sun',
    description: 'Child wellbeing framework (Happy, Calm, Energetic, Cranky) and classroom environment tracking parameters.',
  },
  {
    key: 'health_settings',
    label: 'Health Settings',
    phase: 'OPERATIONS',
    applicability: 'MANDATORY',
    deps: ['school_profile'],
    icon: 'Cross',
    description: 'Daily health-check rules, allergy categories, medical incident triage, and emergency escalation paths.',
  },
  {
    key: 'daily_operations',
    label: 'Daily Operations',
    phase: 'OPERATIONS',
    applicability: 'MANDATORY',
    deps: ['branch', 'classroom'],
    icon: 'Clock',
    description: 'Attendance rules, arrival/pickup grace windows, working days, daily care record types, and authorized pickup verification.',
  },
  {
    key: 'observation',
    label: 'Observation',
    phase: 'OPERATIONS',
    applicability: 'MANDATORY',
    deps: ['curriculum'],
    icon: 'ClipboardCheck',
    description: 'Early learning observation categories, milestone evaluation methods, and pedagogical concern triage levels.',
  },

  // ── PHASE 4 — BUSINESS RULES ─────────────────────────────────────────
  {
    key: 'fees_setup',
    label: 'Fees Setup',
    phase: 'BUSINESS_RULES',
    applicability: 'MANDATORY',
    deps: ['programs', 'academic_year'],
    icon: 'IndianRupee',
    description: 'Active fee plans with integer paise terms, payment due day offsets, and fee structures per program.',
  },
  {
    key: 'templates',
    label: 'Templates',
    phase: 'BUSINESS_RULES',
    applicability: 'RECOMMENDED',
    deps: ['school_profile'],
    icon: 'FileText',
    description: 'Central registry of branded document templates: admission forms, receipts, consent forms, and certificates.',
  },
  {
    key: 'communication',
    label: 'Communication',
    phase: 'BUSINESS_RULES',
    applicability: 'MANDATORY',
    deps: ['school_profile'],
    icon: 'Megaphone',
    description: 'Active delivery channels (In-App, WhatsApp, SMS, Email), event trigger mappings, and parent summary dispatch rules.',
  },
  {
    key: 'promotion',
    label: 'Promotion',
    phase: 'BUSINESS_RULES',
    applicability: 'RECOMMENDED',
    deps: ['programs', 'academic_year'],
    icon: 'ArrowRight',
    description: 'Year-end academic progression rules, program grade mappings, and capacity checks preserving immutable allocation history.',
  },
]

export const STEP_MAP: Record<string, StepDef> = Object.fromEntries(
  SETUP_STEPS.map((s) => [s.key, s])
)

export const PHASES: { key: StepPhase; label: string; sub: string }[] = [
  { key: 'FOUNDATION', label: 'Foundation', sub: 'Who the school is and who operates it' },
  { key: 'ACADEMIC_STRUCTURE', label: 'Academic Structure', sub: 'Year, curriculum, programs, classrooms and subjects' },
  { key: 'OPERATIONS', label: 'Operations', sub: 'Daily routines, wellbeing, health settings and formative observation' },
  { key: 'BUSINESS_RULES', label: 'Business Rules', sub: 'Fees, templates, communication and academic promotion' },
]

export function isUnlocked(
  step: StepDef,
  statusOf: (key: StepKey) => 'PENDING' | 'COMPLETE' | 'BLOCKED' | 'SKIPPED'
): boolean {
  return step.deps.every((d) => {
    const s = statusOf(d)
    return s === 'COMPLETE' || s === 'SKIPPED'
  })
}

/** Legacy key alias map for backward compatibility */
export const LEGACY_KEY_MAP: Record<string, StepKey> = {
  classes_sections: 'classroom',
  teacher_assignment: 'classroom',
  infrastructure: 'branch',
  fees: 'fees_setup',
  documents: 'templates',
  health_safety: 'health_settings',
  operating_config: 'daily_operations',
  admission_config: 'daily_operations',
  student_parent: 'daily_operations',
}
