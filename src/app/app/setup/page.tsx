'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  School, Building2, Palette, Blocks, DoorOpen, Clock, ShieldCheck, Users,
  CalendarRange, LayoutGrid, GraduationCap, BookOpen, CalendarDays, IndianRupee,
  ClipboardList, HeartHandshake, Sun, Cross, Megaphone, FileText, Upload,
  Rocket, CheckCircle2, AlertTriangle, Lock, ChevronRight, PlayCircle,
  ClipboardCheck, LayoutList, ArrowRight, History, Sparkles, Edit3, Plus,
  Sliders, Activity, Check, RefreshCw, Layers, ExternalLink, AlertCircle, Info,
} from 'lucide-react'
import {
  PageHead, Segmented, Skeleton, EmptyState, StatusBadge,
  SetupPhaseCard, SetupStepTile,
} from '@/components/preone'
import { Modal } from '@/components/preone/Modal'
import { useToast } from '@/components/preone/Toast'
import { PHASES, SETUP_STEPS, STEP_MAP, type StepKey } from '@/lib/setup/steps'

const ICONS: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  School, Building2, Palette, Blocks, DoorOpen, Clock, ShieldCheck, Users,
  CalendarRange, LayoutGrid, GraduationCap, BookOpen, CalendarDays, IndianRupee,
  ClipboardList, HeartHandshake, Sun, Cross, Megaphone, FileText, Upload,
  ClipboardCheck, ArrowRight,
}

interface StepRow {
  key: string
  label: string
  phase: string
  applicability: 'MANDATORY' | 'OPTIONAL' | 'RECOMMENDED'
  icon: string
  description: string
  status: 'PENDING' | 'COMPLETE' | 'BLOCKED' | 'SKIPPED'
  detail: string
  blockedReason: string | null
  missingDeps: { key: string; label: string }[]
  completedAt: string | null
  completedByName: string | null
  changedAfterCompletion: boolean
  driftState?: boolean
  lastCheckedAt: string
  locked: boolean
}

interface StatusPayload {
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'READY_FOR_REVIEW' | 'READY_FOR_GO_LIVE' | 'LIVE'
  progress: number
  startedAt: string | null
  goLiveAt: string | null
  steps: StepRow[]
  nextStepKey: string | null
  guidance: { level: 'info' | 'warning'; message: string; stepKey: string }[]
}

interface ValidationCategory {
  key: string
  label: string
  status: 'PASS' | 'WARNING' | 'BLOCKED'
  findings: { status: 'PASS' | 'WARNING' | 'BLOCKED'; message: string }[]
}

interface ValidationPayload {
  overall: 'PASS' | 'WARNING' | 'BLOCKED'
  categories: ValidationCategory[]
  setupStatus?: string
}

interface DepsPayload {
  summary: {
    school: { name: { name: string; code: string; city: string | null } | null }
    branches: number
    programs: number
    academicYears: number
    classes: number
    staff: number
    calendarEvents: number
    feePlans: number
    students: number
  }
  graph: {
    key: string
    label: string
    applicability: string
    status: string
    blockedBy: { key: string; label: string }[]
    deps: { key: string; label: string; status: string }[]
  }[]
}

type Dict = Record<string, any>

const STEP_STATUS_MAP: Record<string, { cls: string; label: string }> = {
  COMPLETE: { cls: 'b-success', label: 'Complete' },
  PENDING: { cls: 'b-info', label: 'Pending' },
  BLOCKED: { cls: 'b-danger', label: 'Blocked' },
  SKIPPED: { cls: 'b-neutral', label: 'Skipped' },
}

const LIFECYCLE_STATUS_MAP: Record<string, { cls: string; label: string }> = {
  NOT_STARTED: { cls: 'b-neutral', label: 'Not Started' },
  IN_PROGRESS: { cls: 'b-orange', label: 'In Progress' },
  BLOCKED: { cls: 'b-danger', label: 'Blocked' },
  READY_FOR_REVIEW: { cls: 'b-primary', label: 'Ready for Review' },
  READY_FOR_GO_LIVE: { cls: 'b-primary', label: 'Ready for Go-Live' },
  LIVE: { cls: 'b-success', label: 'Live' },
}

const CAT_STATUS_MAP: Record<string, { cls: string; label: string }> = {
  PASS: { cls: 'b-success', label: 'Pass' },
  WARNING: { cls: 'b-warning', label: 'Warning' },
  BLOCKED: { cls: 'b-danger', label: 'Blocked' },
}

export default function SetupPage() {
  const toast = useToast()
  const [status, setStatus] = useState<StatusPayload | null>(null)
  const [metroFilter, setMetroFilter] = useState<'ALL' | 'MANDATORY' | 'RECOMMENDED' | 'REMAINING'>('ALL')
  const [validation, setValidation] = useState<ValidationPayload | null>(null)
  const [validating, setValidating] = useState(false)
  const [validationOpen, setValidationOpen] = useState(false)
  const [deps, setDeps] = useState<DepsPayload | null>(null)
  const [depOpen, setDepOpen] = useState(false)
  const [goLiveOpen, setGoLiveOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  // Step filter in Tab 2
  const [phaseFilter, setPhaseFilter] = useState<string>('ALL')
  const [stepStatusFilter, setStepStatusFilter] = useState<string>('ALL')

  // Master Data
  const [profile, setProfile] = useState<Dict | null>(null)
  const [branches, setBranches] = useState<Dict[]>([])
  const [programs, setPrograms] = useState<Dict[]>([])
  const [years, setYears] = useState<Dict[]>([])
  const [classrooms, setClassrooms] = useState<Dict[]>([])
  const [operatingConfig, setOperatingConfig] = useState<Dict | null>(null)
  const [health, setHealth] = useState<Dict | null>(null)

  // Modals
  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<Dict | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/setup/status')
      const j = await res.json()
      if (j.success) {
        setStatus(j.data)
      } else if (res.status === 401 || j.error?.code === 'AUTH_001') {
        document.cookie = 'preone_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
        window.location.href = '/'
      }
    } catch {
      // ignore network errors on unmount
    }
  }, [])

  const loadHubData = useCallback(async () => {
    try {
      const [p, b, pr, y, c, o, h] = await Promise.all([
        fetch('/api/v1/setup/school-profile').then((r) => r.json()).catch(() => null),
        fetch('/api/v1/branches').then((r) => r.json()).catch(() => null),
        fetch('/api/v1/programs').then((r) => r.json()).catch(() => null),
        fetch('/api/v1/academic-years').then((r) => r.json()).catch(() => null),
        fetch('/api/v1/classrooms').then((r) => r.json()).catch(() => null),
        fetch('/api/v1/setup/config/OPERATING').then((r) => r.json()).catch(() => null),
        fetch('/api/v1/integrations/health').then((r) => r.json()).catch(() => null),
      ])
      if (p?.success) setProfile(p.data)
      if (b?.success) setBranches(b.data || [])
      if (pr?.success) setPrograms(pr.data || [])
      if (y?.success) setYears(y.data || [])
      if (c?.success) setClassrooms(c.data || [])
      if (o?.success) setOperatingConfig(o.data?.data || null)
      if (h?.success) setHealth(h.data || null)
    } catch {
      // ignore
    }
  }, [])

  const loadDeps = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/setup/dependencies')
      const j = await res.json()
      if (j.success) setDeps(j.data)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    load()
    loadHubData()
    loadDeps()
  }, [load, loadHubData, loadDeps])

  const refreshAll = useCallback(() => {
    load()
    loadHubData()
    loadDeps()
  }, [load, loadHubData, loadDeps])

  const runValidation = async () => {
    setValidating(true)
    try {
      const res = await fetch('/api/v1/setup/validate', { method: 'POST' })
      const j = await res.json()
      setValidating(false)
      if (j.success) {
        setValidation(j.data)
        setValidationOpen(true)
        toast.success('Validation complete', `Overall: ${j.data.overall}`)
        load()
      } else {
        toast.error('Validation failed', j.error?.message)
      }
    } catch (e: any) {
      setValidating(false)
      toast.error('Validation error', e?.message || 'Server error')
    }
  }

  const goLive = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/v1/setup/go-live', { method: 'POST' })
      const j = await res.json()
      setBusy(false)
      if (j.success) {
        toast.success('Preschool is LIVE', 'Operational dashboard is now primary')
        setGoLiveOpen(false)
        load()
      } else {
        toast.error('Go-live blocked', j.error?.message)
        if (j.error?.code === 'SETUP_001') {
          setGoLiveOpen(false)
          runValidation()
        }
      }
    } catch (e: any) {
      setBusy(false)
      toast.error('Go-live failed', e?.message || 'Server error')
    }
  }

  const nextStep = useMemo(() => status?.steps.find((s) => s.key === status.nextStepKey) ?? null, [status])
  const currentYear = useMemo(() => years.find((y) => y.isCurrent) ?? years[0] ?? null, [years])

  const mandatorySteps = useMemo(() => status?.steps.filter((s) => s.applicability === 'MANDATORY') ?? [], [status])
  const mandatoryCompleted = useMemo(() => mandatorySteps.filter((s) => s.status === 'COMPLETE' || s.status === 'SKIPPED').length, [mandatorySteps])
  const mandatoryLeft = useMemo(() => mandatorySteps.length - mandatoryCompleted, [mandatorySteps, mandatoryCompleted])
  const recommendedSteps = useMemo(
    () => status?.steps.filter((s) => s.applicability === 'RECOMMENDED') ?? [],
    [status]
  )
  const remainingSteps = useMemo(
    () => status?.steps.filter((s) => s.status !== 'COMPLETE' && s.status !== 'SKIPPED') ?? [],
    [status]
  )
  const remainingCount = remainingSteps.length

  const phaseCounts = useMemo(() => {
    const counts: Record<string, { total: number; completed: number }> = {
      FOUNDATION: { total: 0, completed: 0 },
      ACADEMIC_STRUCTURE: { total: 0, completed: 0 },
      BUSINESS_RULES: { total: 0, completed: 0 },
      OPERATIONS_READINESS: { total: 0, completed: 0 },
    }
    if (!status?.steps) return counts
    for (const s of status.steps) {
      if (counts[s.phase]) {
        counts[s.phase].total += 1
        if (s.status === 'COMPLETE' || s.status === 'SKIPPED') {
          counts[s.phase].completed += 1
        }
      }
    }
    return counts
  }, [status])

  const phaseSteps = useMemo(() => {
    const map: Record<string, StepRow[]> = {
      FOUNDATION: [],
      ACADEMIC_STRUCTURE: [],
      BUSINESS_RULES: [],
      OPERATIONS_READINESS: [],
    }
    if (!status?.steps) return map
    for (const s of status.steps) {
      if (map[s.phase]) {
        let match = true
        if (metroFilter === 'MANDATORY') match = s.applicability === 'MANDATORY'
        else if (metroFilter === 'RECOMMENDED') match = s.applicability === 'RECOMMENDED'
        else if (metroFilter === 'REMAINING') match = s.status !== 'COMPLETE' && s.status !== 'SKIPPED'
        if (match) {
          map[s.phase].push(s)
        }
      }
    }
    return map
  }, [status, metroFilter])

  const filteredSteps = useMemo(() => {
    if (!status?.steps) return []
    return status.steps.filter((s) => {
      const matchPhase = phaseFilter === 'ALL' || s.phase === phaseFilter
      const matchStatus = stepStatusFilter === 'ALL' || s.status === stepStatusFilter
      return matchPhase && matchStatus
    })
  }, [status, phaseFilter, stepStatusFilter])

  if (!status) {
    return (
      <div className="page-container">
        <PageHead
          eyebrow="PRESCHOOL SETUP & READINESS"
          title="Preschool Setup & Configuration"
        />
        <div className="table-workspace"><div style={{ padding: 24 }}><Skeleton h={240} /></div></div>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* ── 1. CANONICAL PAGE HEADER ── */}
      <PageHead
        eyebrow="PRESCHOOL SETUP & READINESS"
        title="Preschool Setup & Configuration"
        sub="Configure foundation, academic structure, daily operations, and business rules."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-outline" onClick={() => { setDepOpen(true); if (!deps) loadDeps() }}>
              <LayoutList size={14} /> Dependency Graph
            </button>
            <button className="btn btn-outline" onClick={runValidation} disabled={validating}>
              <ClipboardCheck size={14} /> {validating ? 'Verifying…' : 'Run Health Check'}
            </button>
            <button className="btn btn-outline" onClick={() => setGoLiveOpen(true)}>
              <Rocket size={14} /> Go-Live Checklist
            </button>
            {status.status !== 'LIVE' && mandatoryLeft === 0 && (
              <button className="btn btn-primary" onClick={() => setGoLiveOpen(true)}>
                <Rocket size={14} /> Launch Preschool (Go Live)
              </button>
            )}
            {nextStep && (
              <a className="btn btn-primary" href={nextStep.key === 'branding' ? '/app/setup/branding' : `/app/setup/${nextStep.key}`}>
                <PlayCircle size={14} /> Step Guide ({nextStep.label}) <ChevronRight size={14} />
              </a>
            )}
          </div>
        }
      />

      {/* ── 2. SETUP PHASES & STEPS (4 PHASE METRO CARDS) ── */}
      <div style={{ marginTop: 8 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            marginBottom: 16,
          }}
        >
          <Segmented
            value={metroFilter}
            onChange={(v) => setMetroFilter(v as typeof metroFilter)}
            options={[
              { key: 'ALL', label: `All (${status.steps.length})` },
              { key: 'MANDATORY', label: `Mandatory (${mandatorySteps.length})` },
              { key: 'RECOMMENDED', label: `Recommended (${recommendedSteps.length})` },
              { key: 'REMAINING', label: `Remaining (${remainingCount})` },
            ]}
          />
        </div>

        {/* 4 Phase Columns */}
        <div className="setup-phases-grid">
          {PHASES.map((phase, idx) => {
            const phaseKey = phase.key === 'FOUNDATION'
              ? 'foundation'
              : phase.key === 'ACADEMIC_STRUCTURE'
              ? 'academic'
              : phase.key === 'BUSINESS_RULES'
              ? 'business'
              : 'operations'
            const stepsInPhase = phaseSteps[phase.key] || []
            const counts = phaseCounts[phase.key] || { total: 0, completed: 0 }

            return (
              <SetupPhaseCard
                key={phase.key}
                phaseNumber={idx + 1}
                phaseKey={phaseKey}
                title={phase.label}
                description={phase.sub}
                completedCount={counts.completed}
                totalCount={counts.total}
              >
                {stepsInPhase.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No steps match this filter
                  </div>
                ) : (
                  stepsInPhase.map((s) => {
                    const Icon = ICONS[s.icon] ?? School
                    const isDrifted = s.driftState || (s.status === 'COMPLETE' && s.changedAfterCompletion)
                    const badge = isDrifted ? { cls: 'b-warning', label: 'Drifted' } : (STEP_STATUS_MAP[s.status] || STEP_STATUS_MAP.PENDING)
                    return (
                      <SetupStepTile
                        key={s.key}
                        href={s.key === 'branding' ? '/app/setup/branding' : `/app/setup/${s.key}`}
                        name={s.label}
                        status={s.status}
                        icon={<Icon size={16} />}
                        applicability={s.applicability}
                        statusBadge={
                          <span className={`badge ${badge.cls}`} style={{ fontSize: 10.5 }}>
                            {badge.label}
                          </span>
                        }
                        helper={
                          isDrifted
                            ? 'Configuration drifted — underlying data modified since completion'
                            : s.status === 'BLOCKED'
                              ? (s.blockedReason || 'Blocked by prerequisites')
                              : (s.detail || s.description)
                        }
                      />
                    )
                  })
                )}
              </SetupPhaseCard>
            )
          })}
        </div>
      </div>

      {/* ════════════════════ CANONICAL MODALS ════════════════════ */}

      {/* 0. VALIDATION HEALTH CHECK MODAL */}
      <Modal
        open={validationOpen}
        onClose={() => setValidationOpen(false)}
        title="Operational Readiness & Health Check"
        subtitle="Authoritative 15-category cross-module validation engine"
        icon={<ClipboardCheck size={22} />}
        wide
      >
        {!validation ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <ClipboardCheck size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
            <h4 style={{ margin: '0 0 6px', fontSize: 16 }}>No Validation Run Yet</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
              Run the full 15-category validation to verify master data integrity, cross-module links, and operational rules.
            </p>
            <button className="btn btn-primary" onClick={runValidation} disabled={validating}>
              <ClipboardCheck size={14} /> {validating ? 'Running Verification…' : 'Run Full Validation'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '60vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-subtle)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
              <div>
                <span className="cell-strong" style={{ fontSize: 14 }}>Overall System Readiness:</span>
                <span className={`badge ${CAT_STATUS_MAP[validation.overall]?.cls || 'b-neutral'}`} style={{ marginLeft: 8 }}>
                  {validation.overall}
                </span>
              </div>
              <button className="btn btn-outline btn-sm" onClick={runValidation} disabled={validating}>
                <RefreshCw size={13} /> Re-verify
              </button>
            </div>
            {validation.categories.map((c) => (
              <div key={c.key} style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 14px', background: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="cell-strong">{c.label}</span>
                  <span className={`badge ${CAT_STATUS_MAP[c.status]?.cls || 'b-neutral'}`}>{c.status}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {c.findings.map((f, fi) => (
                    <div key={fi} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5 }}>
                      <span style={{ color: f.status === 'PASS' ? 'var(--success)' : f.status === 'WARNING' ? 'var(--warning)' : 'var(--danger)', flexShrink: 0 }}>
                        {f.status === 'PASS' ? '✓' : f.status === 'WARNING' ? '⚠' : '✕'}
                      </span>
                      <span style={{ color: f.status === 'PASS' ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{f.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* 1. EDIT SCHOOL PROFILE MODAL */}
      {activeModal === 'profile' && profile && (
        <Modal open onClose={() => setActiveModal(null)} title="Edit School Profile & Identity" icon={<School size={22} />} iconClass="ic-violet" wide>
          <form onSubmit={async (e) => {
            e.preventDefault(); setBusy(true)
            const fd = Object.fromEntries(new FormData(e.currentTarget).entries())
            const res = await fetch('/api/v1/setup/school-profile', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(fd),
            }).then((r) => r.json())
            setBusy(false)
            if (res.success) {
              toast.success('School profile updated')
              setActiveModal(null)
              refreshAll()
            } else {
              toast.error('Update failed', res.error?.message)
            }
          }}>
            <div className="form-grid">
              <div className="field"><label>Preschool Name <span className="req">*</span></label><input className="input" name="name" defaultValue={profile.name} required /></div>
              <div className="field"><label>School Code</label><input className="input" value={profile.code} disabled /></div>
              <div className="field"><label>Official Email <span className="req">*</span></label><input className="input" name="email" type="email" defaultValue={profile.email} required /></div>
              <div className="field"><label>Primary Phone <span className="req">*</span></label><input className="input" name="phone" defaultValue={profile.phone} required /></div>
              <div className="field"><label>City <span className="req">*</span></label><input className="input" name="city" defaultValue={profile.city} required /></div>
              <div className="field"><label>State</label><input className="input" name="state" defaultValue={profile.state || ''} /></div>
              <div className="field"><label>Pincode</label><input className="input" name="pincode" defaultValue={profile.pincode || ''} /></div>
              <div className="field"><label>Timezone</label><input className="input" name="timezone" defaultValue={profile.timezone || 'Asia/Kolkata'} /></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Campus Address</label><textarea className="textarea" rows={2} name="address" defaultValue={profile.address || ''} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setActiveModal(null)}>Cancel</button>
              <button type="submit" className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>Save Changes</button>
            </div>
          </form>
        </Modal>
      )}

      {/* 2. ADD CAMPUS MODAL */}
      {activeModal === 'newBranch' && (
        <Modal open onClose={() => setActiveModal(null)} title="Add Campus Branch" icon={<Building2 size={22} />} iconClass="ic-blue">
          <form onSubmit={async (e) => {
            e.preventDefault(); setBusy(true)
            const fd = Object.fromEntries(new FormData(e.currentTarget).entries())
            const res = await fetch('/api/v1/branches', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(fd),
            }).then((r) => r.json())
            setBusy(false)
            if (res.success) {
              toast.success('Branch added', res.data.name)
              setActiveModal(null)
              refreshAll()
            } else {
              toast.error('Failed to create branch', res.error?.message)
            }
          }}>
            <div className="form-grid">
              <div className="field"><label>Branch Name <span className="req">*</span></label><input className="input" name="name" required placeholder="e.g. Koramangala Campus" /></div>
              <div className="field"><label>Code <span className="req">*</span></label><input className="input" name="code" required placeholder="KRM" /></div>
              <div className="field"><label>City</label><input className="input" name="city" placeholder="Bengaluru" /></div>
              <div className="field"><label>Phone</label><input className="input" name="phone" /></div>
              <div className="field"><label>Opens at</label><input className="input" name="timingOpen" type="time" defaultValue="08:30" /></div>
              <div className="field"><label>Closes at</label><input className="input" name="timingClose" type="time" defaultValue="16:00" /></div>
              <div className="field"><label>Seat Capacity</label><input className="input" name="capacity" type="number" placeholder="60" /></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Address</label><input className="input" name="address" /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setActiveModal(null)}>Cancel</button>
              <button type="submit" className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>Create Branch</button>
            </div>
          </form>
        </Modal>
      )}

      {/* 3. EDIT CAMPUS MODAL */}
      {activeModal === 'editBranch' && editingItem && (
        <Modal open onClose={() => setActiveModal(null)} title={`Edit Branch — ${editingItem.name}`} icon={<Building2 size={22} />} iconClass="ic-blue">
          <form onSubmit={async (e) => {
            e.preventDefault(); setBusy(true)
            const fd = Object.fromEntries(new FormData(e.currentTarget).entries())
            const res = await fetch(`/api/v1/branches/${editingItem.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: fd.name,
                city: fd.city || null,
                phone: fd.phone || null,
                timingOpen: fd.timingOpen,
                timingClose: fd.timingClose,
                capacity: fd.capacity ? Number(fd.capacity) : null,
                address: fd.address || null,
                isActive: fd.isActive === 'on',
              }),
            }).then((r) => r.json())
            setBusy(false)
            if (res.success) {
              toast.success('Branch updated')
              setActiveModal(null)
              refreshAll()
            } else {
              toast.error('Update failed', res.error?.message)
            }
          }}>
            <div className="form-grid">
              <div className="field"><label>Branch Name <span className="req">*</span></label><input className="input" name="name" defaultValue={editingItem.name} required /></div>
              <div className="field"><label>Code</label><input className="input" value={editingItem.code} disabled /></div>
              <div className="field"><label>City</label><input className="input" name="city" defaultValue={editingItem.city || ''} /></div>
              <div className="field"><label>Phone</label><input className="input" name="phone" defaultValue={editingItem.phone || ''} /></div>
              <div className="field"><label>Opens at</label><input className="input" name="timingOpen" type="time" defaultValue={editingItem.timingOpen || '08:30'} /></div>
              <div className="field"><label>Closes at</label><input className="input" name="timingClose" type="time" defaultValue={editingItem.timingClose || '16:00'} /></div>
              <div className="field"><label>Capacity</label><input className="input" name="capacity" type="number" defaultValue={editingItem.capacity || ''} /></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Address</label><input className="input" name="address" defaultValue={editingItem.address || ''} /></div>
              <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" name="isActive" defaultChecked={editingItem.isActive !== false} />
                  <span>Active Branch</span>
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setActiveModal(null)}>Cancel</button>
              <button type="submit" className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>Save Changes</button>
            </div>
          </form>
        </Modal>
      )}

      {/* 4. ADD PROGRAM MODAL */}
      {activeModal === 'newProgram' && (
        <Modal open onClose={() => setActiveModal(null)} title="Add Program" icon={<Blocks size={22} />} iconClass="ic-violet">
          <form onSubmit={async (e) => {
            e.preventDefault(); setBusy(true)
            const fd = Object.fromEntries(new FormData(e.currentTarget).entries())
            const res = await fetch('/api/v1/programs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(fd),
            }).then((r) => r.json())
            setBusy(false)
            if (res.success) {
              toast.success('Program added', res.data.name)
              setActiveModal(null)
              refreshAll()
            } else {
              toast.error('Failed to create program', res.error?.message)
            }
          }}>
            <div className="form-grid">
              <div className="field"><label>Program Name <span className="req">*</span></label><input className="input" name="name" required placeholder="e.g. Toddler Playgroup" /></div>
              <div className="field"><label>Code <span className="req">*</span></label><input className="input" name="code" required placeholder="PLAY" /></div>
              <div className="field"><label>System Program Type <span className="req">*</span></label>
                <select className="select" name="programType" required>
                  {['PLAYGROUP', 'NURSERY', 'LKG', 'UKG', 'DAYCARE'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="field"><label>Capacity (seats) <span className="req">*</span></label><input className="input" name="capacity" type="number" defaultValue={20} min="1" required /></div>
              <div className="field"><label>Min Age (months)</label><input className="input" name="ageMinMonths" type="number" placeholder="24" /></div>
              <div className="field"><label>Max Age (months)</label><input className="input" name="ageMaxMonths" type="number" placeholder="36" /></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Description</label><input className="input" name="description" placeholder="Sensory and motor early play" /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setActiveModal(null)}>Cancel</button>
              <button type="submit" className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>Create Program</button>
            </div>
          </form>
        </Modal>
      )}

      {/* 5. EDIT PROGRAM MODAL */}
      {activeModal === 'editProgram' && editingItem && (
        <Modal open onClose={() => setActiveModal(null)} title={`Edit Program — ${editingItem.name}`} icon={<Blocks size={22} />} iconClass="ic-violet">
          <form onSubmit={async (e) => {
            e.preventDefault(); setBusy(true)
            const fd = Object.fromEntries(new FormData(e.currentTarget).entries())
            const res = await fetch(`/api/v1/programs/${editingItem.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: fd.name,
                ageMinMonths: fd.ageMinMonths ? Number(fd.ageMinMonths) : null,
                ageMaxMonths: fd.ageMaxMonths ? Number(fd.ageMaxMonths) : null,
                capacity: Number(fd.capacity || 20),
                description: fd.description || null,
                isActive: fd.isActive === 'on',
              }),
            }).then((r) => r.json())
            setBusy(false)
            if (res.success) {
              toast.success('Program updated')
              setActiveModal(null)
              refreshAll()
            } else {
              toast.error('Update failed', res.error?.message)
            }
          }}>
            <div className="form-grid">
              <div className="field"><label>Program Name <span className="req">*</span></label><input className="input" name="name" defaultValue={editingItem.name} required /></div>
              <div className="field"><label>Code</label><input className="input" value={editingItem.code} disabled /></div>
              <div className="field"><label>Capacity (seats) <span className="req">*</span></label><input className="input" name="capacity" type="number" defaultValue={editingItem.capacity} min="1" required /></div>
              <div className="field"><label>Min Age (months)</label><input className="input" name="ageMinMonths" type="number" defaultValue={editingItem.ageMinMonths || ''} /></div>
              <div className="field"><label>Max Age (months)</label><input className="input" name="ageMaxMonths" type="number" defaultValue={editingItem.ageMaxMonths || ''} /></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Description</label><input className="input" name="description" defaultValue={editingItem.description || ''} /></div>
              <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" name="isActive" defaultChecked={editingItem.isActive !== false} />
                  <span>Accepting Admissions (Active)</span>
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setActiveModal(null)}>Cancel</button>
              <button type="submit" className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>Save Changes</button>
            </div>
          </form>
        </Modal>
      )}

      {/* 6. ADD ACADEMIC YEAR MODAL */}
      {activeModal === 'newYear' && (
        <Modal open onClose={() => setActiveModal(null)} title="Create Academic Year" icon={<CalendarRange size={22} />} iconClass="ic-green">
          <form onSubmit={async (e) => {
            e.preventDefault(); setBusy(true)
            const fd = Object.fromEntries(new FormData(e.currentTarget).entries())
            const res = await fetch('/api/v1/academic-years', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(fd),
            }).then((r) => r.json())
            setBusy(false)
            if (res.success) {
              toast.success('Academic year created', res.data.name)
              setActiveModal(null)
              refreshAll()
            } else {
              toast.error('Failed to create year', res.error?.message)
            }
          }}>
            <div className="form-grid">
              <div className="field"><label>Year Name <span className="req">*</span></label><input className="input" name="name" required placeholder="2026-27" /></div>
              <div className="field"><label>Start Date <span className="req">*</span></label><input className="input" name="startDate" type="date" required /></div>
              <div className="field"><label>End Date <span className="req">*</span></label><input className="input" name="endDate" type="date" required /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setActiveModal(null)}>Cancel</button>
              <button type="submit" className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>Create Year</button>
            </div>
          </form>
        </Modal>
      )}

      {/* 7. EDIT ACADEMIC YEAR MODAL */}
      {activeModal === 'editYear' && editingItem && (
        <Modal open onClose={() => setActiveModal(null)} title={`Edit Academic Year — ${editingItem.name}`} icon={<CalendarRange size={22} />} iconClass="ic-green">
          <form onSubmit={async (e) => {
            e.preventDefault(); setBusy(true)
            const fd = Object.fromEntries(new FormData(e.currentTarget).entries())
            const payload: Dict = {
              name: fd.name,
              startDate: fd.startDate,
              endDate: fd.endDate,
            }
            if (fd.setStatusCurrent === 'on') payload.setStatusCurrent = true
            const res = await fetch(`/api/v1/academic-years/${editingItem.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            }).then((r) => r.json())
            setBusy(false)
            if (res.success) {
              toast.success('Academic year updated')
              setActiveModal(null)
              refreshAll()
            } else {
              toast.error('Update failed', res.error?.message)
            }
          }}>
            <div className="form-grid">
              <div className="field"><label>Year Name <span className="req">*</span></label><input className="input" name="name" defaultValue={editingItem.name} required /></div>
              <div className="field"><label>Start Date <span className="req">*</span></label><input className="input" name="startDate" type="date" defaultValue={editingItem.startDate ? new Date(editingItem.startDate).toISOString().split('T')[0] : ''} required /></div>
              <div className="field"><label>End Date <span className="req">*</span></label><input className="input" name="endDate" type="date" defaultValue={editingItem.endDate ? new Date(editingItem.endDate).toISOString().split('T')[0] : ''} required /></div>
              <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" name="setStatusCurrent" defaultChecked={editingItem.isCurrent === true} />
                  <span>Set as Current Operating Year</span>
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setActiveModal(null)}>Cancel</button>
              <button type="submit" className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>Save Changes</button>
            </div>
          </form>
        </Modal>
      )}

      {/* 8. ADD CLASSROOM MODAL */}
      {activeModal === 'newClass' && (
        <Modal open onClose={() => setActiveModal(null)} title="Add Classroom / Section" icon={<LayoutGrid size={22} />} iconClass="ic-orange">
          <form onSubmit={async (e) => {
            e.preventDefault(); setBusy(true)
            const fd = Object.fromEntries(new FormData(e.currentTarget).entries())
            const selectedProgram = programs.find((p) => p.id === fd.programId)
            const payload = {
              name: fd.name,
              programType: selectedProgram ? selectedProgram.programType : 'PLAYGROUP',
              programId: fd.programId || null,
              capacity: Number(fd.capacity || 20),
              branchId: fd.branchId || (branches[0]?.id ?? null),
            }
            const res = await fetch('/api/v1/classrooms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            }).then((r) => r.json())
            setBusy(false)
            if (res.success) {
              toast.success('Classroom created', res.data.name)
              setActiveModal(null)
              refreshAll()
            } else {
              toast.error('Failed to create classroom', res.error?.message)
            }
          }}>
            <div className="form-grid">
              <div className="field"><label>Classroom Name <span className="req">*</span></label><input className="input" name="name" required placeholder="e.g. Playgroup Blueberries" /></div>
              <div className="field"><label>Program <span className="req">*</span></label>
                <select className="select" name="programId" required>
                  <option value="">Select program…</option>
                  {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="field"><label>Branch Campus <span className="req">*</span></label>
                <select className="select" name="branchId" required defaultValue={branches[0]?.id || ''}>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="field"><label>Seat Capacity <span className="req">*</span></label><input className="input" name="capacity" type="number" defaultValue={20} min="1" required /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setActiveModal(null)}>Cancel</button>
              <button type="submit" className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>Create Classroom</button>
            </div>
          </form>
        </Modal>
      )}

      {/* 9. EDIT CLASSROOM MODAL */}
      {activeModal === 'editClass' && editingItem && (
        <Modal open onClose={() => setActiveModal(null)} title={`Edit Classroom — ${editingItem.name}`} icon={<LayoutGrid size={22} />} iconClass="ic-orange">
          <form onSubmit={async (e) => {
            e.preventDefault(); setBusy(true)
            const fd = Object.fromEntries(new FormData(e.currentTarget).entries())
            const res = await fetch(`/api/v1/classrooms/${editingItem.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: fd.name,
                capacity: Number(fd.capacity || 20),
                programId: fd.programId || null,
                primaryTeacherId: fd.primaryTeacherId || null,
              }),
            }).then((r) => r.json())
            setBusy(false)
            if (res.success) {
              toast.success('Classroom updated')
              setActiveModal(null)
              refreshAll()
            } else {
              toast.error('Update failed', res.error?.message)
            }
          }}>
            <div className="form-grid">
              <div className="field"><label>Class Name <span className="req">*</span></label><input className="input" name="name" defaultValue={editingItem.name} required /></div>
              <div className="field"><label>Code</label><input className="input" value={editingItem.code} disabled /></div>
              <div className="field"><label>Linked Program</label>
                <select className="select" name="programId" defaultValue={editingItem.programId || ''}>
                  <option value="">Select program…</option>
                  {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="field"><label>Capacity (seats) <span className="req">*</span></label>
                <input className="input" name="capacity" type="number" defaultValue={editingItem.capacity} min="1" required />
                <div className="helper">Currently enrolled: {editingItem.students ?? 0} children</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setActiveModal(null)}>Cancel</button>
              <button type="submit" className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>Save Changes</button>
            </div>
          </form>
        </Modal>
      )}

      {/* 10. DEPENDENCY GRAPH MODAL */}
      <Modal open={depOpen} onClose={() => setDepOpen(false)} title="Setup Dependency Graph" subtitle="What blocks what — the M00 prerequisite engine" icon={<LayoutList size={22} />} wide>
        {!deps ? <Skeleton h={300} /> : (
          <div style={{ display: 'grid', gap: 8, maxHeight: '55vh', overflowY: 'auto' }}>
            {deps.graph.map((g: any) => (
              <div key={g.key} style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 14px', background: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="cell-strong" style={{ fontSize: 13.5 }}>{g.label}</span>
                  <span className={`badge ${STEP_STATUS_MAP[g.status]?.cls ?? 'b-neutral'}`}>{g.status}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {g.deps.length === 0 ? 'Root step' : `Requires: ${g.deps.map((d: any) => d.label).join(', ')}`}
                  </span>
                </div>
                {g.blockedBy && g.blockedBy.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Lock size={12} />
                    <span>Needs {g.blockedBy.map((b: any) => b.label).join(' and ')} completed first</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* 11. GO-LIVE CONFIRMATION MODAL */}
      <Modal open={goLiveOpen} onClose={() => setGoLiveOpen(false)} title="Launch Preschool (Go Live)" icon={<Rocket size={22} />} iconClass="ic-violet">
        <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
          <p style={{ marginBottom: 12 }}>
            This officially transitions the preschool to <b>LIVE</b> in production and activates the full operational dashboard as the default landing environment.
          </p>
          <div style={{ padding: '12px 14px', background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 8, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Readiness Confirmation Checklist:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <div>✓ Mandatory Foundation & Academic Steps Verified</div>
              <div>✓ Classrooms, Programs & Fee Plans Active</div>
              <div>✓ Primary Teachers Assigned & Staff Branch Scoped</div>
              <div>✓ Operational Settings & Attendance Rules Ready</div>
            </div>
          </div>
          <p className="t-caption">
            Note: All master records, fee schedules, and academic settings remain 100% editable anytime after launch.
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button className="btn btn-ghost" onClick={() => setGoLiveOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={goLive} disabled={busy}>
            <Rocket size={15} /> {busy ? 'Launching…' : 'Confirm & Launch Preschool'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
