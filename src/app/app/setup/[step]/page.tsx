'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, CheckCircle2, AlertTriangle, Plus, Lock, RotateCcw, Save,
  UserPlus, CalendarPlus, Trash2, Building2, Upload, Users, Settings2,
  Blocks, CalendarDays, DoorOpen, GraduationCap, LayoutGrid, IndianRupee, Edit3, Edit, Power, Check, BookOpen,
} from 'lucide-react'
import { PageHead, Skeleton, EmptyState, StatusBadge } from '@/components/preone/ui'
import { Modal } from '@/components/preone/Modal'
import { useToast } from '@/components/preone/Toast'
import { CONFIG_FORMS, type FormField, type DomainForm } from '@/lib/setup/step-forms'
import { STEP_MAP } from '@/lib/setup/steps'
import { ROLE_META, type CanonicalRole } from '@/lib/roles'

const CANONICAL_SETUP_STAFF_ROLES: CanonicalRole[] = [
  'PRINCIPAL',
  'COORDINATOR',
  'TEACHER',
  'STAFF',
  'ACCOUNTS',
  'RECEPTIONIST',
  'DRIVER',
  'ATTENDANT',
]

interface StepRow {
  key: string; label: string; status: 'PENDING' | 'COMPLETE' | 'BLOCKED' | 'SKIPPED'
  applicability: string; detail: string; blockedReason: string | null
  missingDeps: { key: string; label: string }[]; locked: boolean
  completedByName: string | null; completedAt: string | null; changedAfterCompletion: boolean
}
interface StatusPayload { status: string; progress: number; steps: StepRow[]; nextStepKey: string | null }

type Dict = Record<string, unknown>

/** stepKey → SchoolConfig domain (names differ by design — steps are UX, domains are storage) */
const CONFIG_STEP_DOMAIN: Record<string, string> = {
  operating_config: 'OPERATING',
  admission_config: 'ADMISSION',
  student_parent: 'STUDENT_PARENT',
  daily_operations: 'DAILY_OPERATIONS',
  health_settings: 'HEALTH_SAFETY',
  health_safety: 'HEALTH_SAFETY',
  curriculum: 'CURRICULUM',
  communication: 'COMMUNICATION',
  templates: 'DOCUMENT_TEMPLATES',
  documents: 'DOCUMENT_TEMPLATES',
  branding: 'BRANDING',
  mood_environment: 'MOOD_ENVIRONMENT',
  promotion: 'PROMOTION',
}

/* ────────────────────────── generic field renderer ────────────────────────── */
function FieldInput({ f, value, onChange }: { f: FormField; value: unknown; onChange: (v: unknown) => void }) {
  if (f.type === 'checklist') {
    const selected = Array.isArray(value) ? (value as string[]) : []
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {(f.options ?? []).map((opt) => {
          const on = selected.includes(opt)
          return (
            <button
              type="button" key={opt}
              className={`badge ${on ? 'b-primary' : 'b-neutral'}`}
              style={{ cursor: 'pointer', padding: '5px 10px', border: '1px solid transparent' }}
              onClick={() => onChange(on ? selected.filter((x) => x !== opt) : [...selected, opt])}
            >{on ? '✓ ' : ''}{opt.replaceAll('_', ' ').toLowerCase()}</button>
          )
        })}
      </div>
    )
  }
  if (f.type === 'list') {
    return (
      <textarea
        className="textarea" rows={3} value={Array.isArray(value) ? (value as string[]).join('\n') : String(value ?? '')}
        onChange={(e) => onChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
        placeholder="One per line"
      />
    )
  }
  if (f.type === 'checkbox') {
    return (
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        Enabled
      </label>
    )
  }
  if (f.type === 'select') {
    return (
      <select className="select" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {(f.options ?? []).map((o) => <option key={o} value={o}>{o.replaceAll('_', ' ')}</option>)}
      </select>
    )
  }
  const typeMap: Record<string, string> = { text: 'text', number: 'number', date: 'date', time: 'time', color: 'color' }
  return (
    <input
      className="input" type={typeMap[f.type] ?? 'text'}
      value={String(value ?? '')} onChange={(e) => onChange(f.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
    />
  )
}

function ConfigForm({ form, data, setData }: { form: DomainForm; data: Dict; setData: (d: Dict) => void }) {
  const set = (k: string, v: unknown) => setData({ ...data, [k]: v })
  return (
    <div className="form-grid">
      {form.fields.map((f) => {
        const value = data[f.key] !== undefined ? data[f.key] : form.defaults[f.key]
        return (
          <div className="field" key={f.key} style={f.full ? { gridColumn: '1 / -1' } : undefined}>
            <label>{f.label} {f.required && <span className="req">*</span>}</label>
            <FieldInput f={f} value={value} onChange={(v) => set(f.key, v)} />
            {f.help && <div className="helper">{f.help}</div>}
          </div>
        )
      })}
    </div>
  )
}

type ApiFn = (url: string, method: string, body?: unknown) => Promise<any>
type ToastFn = { success: (t: string, s?: string) => void; error: (t: string, s?: string) => void; info: (t: string, s?: string) => void; warning: (t: string, s?: string) => void }

function TableToolbar({ title, count, onAdd, addLabel, icon }: { title: string; count: number; onAdd?: () => void; addLabel?: string; icon?: React.ReactNode }) {
  return (
    <div className="table-toolbar" style={{ marginBottom: 10 }}>
      <div className="card-title">{icon}{title} <span className="badge b-neutral">{count}</span></div>
      {onAdd && addLabel && <button className="btn btn-primary btn-sm" onClick={onAdd}><Plus size={14} /> {addLabel}</button>}
    </div>
  )
}

function FooterActions({ busy, onSaveDraft, onComplete, completeLabel = 'Save & Continue', showDraft = true }: {
  busy: boolean; onSaveDraft: () => void; onComplete: () => void; completeLabel?: string; showDraft?: boolean
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
      {showDraft && (
        <button className="btn btn-outline" onClick={onSaveDraft} disabled={busy}><Save size={15} /> Save as Draft</button>
      )}
      <button className="btn btn-primary" onClick={onComplete} disabled={busy}>
        <CheckCircle2 size={15} /> {busy ? 'Saving…' : completeLabel}
      </button>
    </div>
  )
}

/* ────────────────────────── main page ────────────────────────── */
export default function SetupStepPage() {
  const params = useParams<{ step: string }>()
  const router = useRouter()
  const toast = useToast()
  const stepKey = params.step
  const def = STEP_MAP[stepKey]

  const [status, setStatus] = useState<StatusPayload | null>(null)
  const [me, setMe] = useState<StepRow | null>(null)
  const [payload, setPayload] = useState<Dict | Dict[] | null>(null)
  const [configData, setConfigData] = useState<Dict | null>(null)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<Dict | null>(null)
  const [editType, setEditType] = useState<string | null>(null)
  const [importPreview, setImportPreview] = useState<Dict | null>(null)
  const [csv, setCsv] = useState('')

  const kind = useMemo(() => {
    if (!def) return 'unknown'
    if (def.key === 'school_profile') return 'profile'
    if (def.key === 'branding') return 'branding'
    if (CONFIG_STEP_DOMAIN[def.key]) return 'config'
    switch (def.key) {
      case 'branch': return 'branches'
      case 'programs': return 'programs'
      case 'roles': return 'roles'
      case 'academic_year': return 'years'
      case 'classroom': return 'classes'
      case 'classes_sections': return 'classes'
      case 'subject': return 'subjects'
      case 'fees_setup': return 'fees'
      case 'fees': return 'fees'
      case 'infrastructure': return 'infrastructure'
      case 'staff': return 'staff'
      case 'teacher_assignment': return 'teachers'
      case 'calendar': return 'calendar'
      case 'data_import': return 'import'
      default: return 'unknown'
    }
  }, [def])
  const configDomain = def ? (CONFIG_STEP_DOMAIN[def.key] ?? '') : ''

  const api: ApiFn = useCallback(async (url, method, body) => {
    return fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).then((r) => r.json())
  }, [])

  const loadStatus = useCallback(async () => {
    const j = await fetch('/api/v1/setup/status').then((r) => r.json())
    if (j.success) {
      setStatus(j.data)
      setMe(j.data.steps.find((s: StepRow) => s.key === stepKey) ?? null)
    }
  }, [stepKey])

  const loadBody = useCallback(async () => {
    const urls: Record<string, string> = {
      profile: '/api/v1/setup/school-profile',
      branches: '/api/v1/branches',
      programs: '/api/v1/programs',
      infrastructure: '/api/v1/classrooms',
      roles: '/api/v1/users',
      staff: '/api/v1/staff',
      years: '/api/v1/academic-years',
      classes: '/api/v1/classrooms',
      teachers: '/api/v1/classrooms',
      calendar: '/api/v1/calendar',
      fees: '/api/v1/programs',
      subjects: '/api/v1/subjects',
    }
    const url = kind === 'config' || kind === 'branding' ? `/api/v1/setup/config/${configDomain}` : urls[kind]
    if (!url) return
    const j = await fetch(url).then((r) => r.json())
    if (j.success) {
      if (kind === 'config' || kind === 'branding') {
        // seed the form with schema defaults so a first-time Save persists sensible values
        const formKey = kind === 'branding' ? 'BRANDING' : configDomain
        const defaults = CONFIG_FORMS[formKey]?.defaults ?? {}
        setConfigData({ ...defaults, ...((j.data.data as Dict) ?? {}) })
      } else setPayload(j.data as Dict[])
    }
  }, [kind, configDomain])


  useEffect(() => { Promise.resolve().then(loadStatus); Promise.resolve().then(loadBody) }, [loadStatus, loadBody])

  const refreshAll = useCallback(() => { loadStatus(); loadBody() }, [loadStatus, loadBody])

  const saveConfig = async (): Promise<boolean> => {
    if (kind === 'config') {
      const j = await api(`/api/v1/setup/config/${configDomain}`, 'PUT', configData ?? {})
      if (!j.success) { toast.error('Save failed', j.error?.message); return false }
      toast.success('Configuration saved')
      return true
    }
    if (kind === 'branding') {
      const logo = (configData?.logoUrl as string) ?? null
      const p1 = await api('/api/v1/setup/school-profile', 'PATCH', { logoUrl: logo })
      if (!p1.success) { toast.error('Logo save failed', p1.error?.message); return false }
      const { logoUrl, ...brand } = configData ?? {}
      const p2 = await api('/api/v1/setup/config/BRANDING', 'PUT', brand)
      if (!p2.success) { toast.error('Branding save failed', p2.error?.message); return false }
      toast.success('Branding saved')
      return true
    }
    if (kind === 'profile') {
      const j = await api('/api/v1/setup/school-profile', 'PATCH', payload ?? {})
      if (!j.success) { toast.error('Save failed', j.error?.message); return false }
      toast.success('School profile saved')
      return true
    }
    return true
  }

  const completeStep = async (thenNav = true) => {
    setSaving(true)
    const saved = await saveConfig()
    if (!saved) { setSaving(false); return }
    const j = await api(`/api/v1/setup/steps/${stepKey}`, 'POST', { action: 'complete' })
    setSaving(false)
    if (j.success) {
      toast.success('Step complete', j.data?.message)
      const fresh = await fetch('/api/v1/setup/status').then((r) => r.json())
      if (fresh.success) {
        const next = fresh.data.nextStepKey as string | null
        if (thenNav && next) router.push(next === 'branding' ? '/app/setup/branding' : `/app/setup/${next}`)
        else if (thenNav) router.push('/app/setup')
        else loadStatus()
      }
    } else {
      toast.error('Cannot complete yet', [j.error?.message, j.error?.details].filter(Boolean).join(' — '))
    }
  }

  const skipStep = async () => {
    const j = await api(`/api/v1/setup/steps/${stepKey}`, 'POST', { action: 'skip' })
    if (j.success) { toast.info('Step skipped', j.data?.message); router.push('/app/setup') }
    else toast.error('Cannot skip', j.error?.message)
  }

  const reopenStep = async () => {
    const j = await api(`/api/v1/setup/steps/${stepKey}`, 'POST', { action: 'reopen' })
    if (j.success) { toast.info('Reopened', 'Configure again, then mark complete'); loadStatus() }
    else toast.error('Cannot reopen', j.error?.message)
  }

  if (!def) {
    return <EmptyState icon={<AlertTriangle size={40} />} title="Unknown setup step" message={`No setup step "${stepKey}" exists.`} />
  }
  if (status === null) {
    return <><PageHead title={def.label} sub={def.description} /><div className="card"><div style={{ padding: 16 }}><Skeleton h={200} /></div></div></>
  }

  const isOptional = def.applicability !== 'MANDATORY'
  const statusBadgeCls: Record<string, string> = { COMPLETE: 'b-success', PENDING: 'b-info', BLOCKED: 'b-danger', SKIPPED: 'b-neutral' }
  const list = Array.isArray(payload) ? payload : []

  return (
    <>
      <PageHead
        title={def.label}
        sub={def.description}
        actions={
          <>
            <a className="btn btn-ghost" href="/app/setup"><ArrowLeft size={15} /> Back to Setup</a>
            {me?.status !== 'COMPLETE' && isOptional && me?.status !== 'SKIPPED' && (
              <button className="btn btn-outline" onClick={skipStep}>Skip for now</button>
            )}
            {me?.status === 'COMPLETE' ? (
              <button className="btn btn-outline" onClick={reopenStep}><RotateCcw size={15} /> Reopen</button>
            ) : me?.status !== 'SKIPPED' && !me?.locked && (
              <button className="btn btn-primary" onClick={() => completeStep(true)} disabled={saving}>
                <CheckCircle2 size={15} /> {saving ? 'Saving…' : 'Save & Continue'}
              </button>
            )}
          </>
        }
      />

      {/* status strip */}
      <div className="card" style={{ marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className={`badge ${statusBadgeCls[me?.status ?? 'PENDING']}`}>{me?.status}</span>
        {me?.applicability !== 'MANDATORY' && <span className="badge b-neutral">{me?.applicability}</span>}
        {me?.changedAfterCompletion && <span className="badge b-orange">edited after completion</span>}
        <span className="card-sub" style={{ flex: 1 }}>{me?.detail || def.description}</span>
        {me?.completedByName && <span className="t-caption">completed by {me.completedByName}</span>}
      </div>

      {/* blocked banner — why is this blocked? */}
      {(me?.locked || me?.status === 'BLOCKED') && me?.status !== 'COMPLETE' && (
        <div className="card" style={{ borderColor: 'var(--danger)', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Lock size={18} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>Why is this blocked?</div>
              <div style={{ fontSize: 13 }}>{me?.blockedReason ?? 'Complete the dependency steps first.'}</div>
              {(me?.missingDeps.length ?? 0) > 0 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {me!.missingDeps.map((d) => (
                    <a key={d.key} className="btn btn-sm btn-outline" href={`/app/setup/${d.key}`}>
                      ✗ {d.label} <span style={{ opacity: 0.6 }}>— fix configuration</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── BODY ── */}
      {(!me?.locked || me?.status === 'COMPLETE') && (
        <div className="card">
          <div style={{ padding: 16 }}>
            {(kind === 'config' || kind === 'branding') && CONFIG_FORMS[configDomain] && (
              <>
                <p className="card-sub" style={{ marginBottom: 14 }}>{CONFIG_FORMS[configDomain].intro}</p>
                {kind === 'branding' && (
                  <div className="form-grid" style={{ marginBottom: 6 }}>
                    <div className="field" style={{ gridColumn: '1 / -1' }}>
                      <label>School logo URL</label>
                      <input className="input" value={String(configData?.logoUrl ?? '')} onChange={(e) => setConfigData({ ...configData, logoUrl: e.target.value })} placeholder="https://…/logo.png" />
                      <div className="helper">Shown on login, portals, receipts, certificates and documents.</div>
                    </div>
                  </div>
                )}
                <ConfigForm form={CONFIG_FORMS[configDomain]} data={configData ?? {}} setData={setConfigData} />
                <FooterActions
                  busy={saving}
                  onSaveDraft={async () => { if (await saveConfig()) toast.info('Draft saved', 'You can continue later') }}
                  onComplete={() => completeStep(true)}
                />
              </>
            )}

            {kind === 'profile' && payload && !Array.isArray(payload) && (
              <>
                <div className="form-grid">
                  {[
                    { k: 'name', label: 'School name', req: true }, { k: 'email', label: 'Email', req: true, t: 'email' },
                    { k: 'phone', label: 'Contact number', req: true }, { k: 'website', label: 'Website' },
                    { k: 'city', label: 'City', req: true }, { k: 'state', label: 'State' },
                    { k: 'pincode', label: 'Postal code' }, { k: 'timezone', label: 'Timezone' },
                    { k: 'locale', label: 'Default language' },
                  ].map((f) => (
                    <div className="field" key={f.k}>
                      <label>{f.label} {f.req && <span className="req">*</span>}</label>
                      <input className="input" type={f.t ?? 'text'} value={String(payload[f.k] ?? '')} onChange={(e) => setPayload({ ...payload, [f.k]: e.target.value })} />
                    </div>
                  ))}
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label>Address</label>
                    <textarea className="textarea" rows={2} value={String(payload.address ?? '')} onChange={(e) => setPayload({ ...payload, address: e.target.value })} />
                  </div>
                </div>
                <p className="helper" style={{ marginTop: 8 }}>School identity propagates to branding, login, portals, communication, reports, certificates and documents.</p>
                <FooterActions
                  busy={saving}
                  onSaveDraft={async () => { if (await saveConfig()) toast.info('Draft saved') }}
                  onComplete={() => completeStep(true)}
                />
              </>
            )}

            {kind === 'branches' && (
              <>
                <TableToolbar title="Branches" count={list.length} onAdd={() => setModal('branch')} addLabel="Add Branch" />
                {list.length === 0 ? <EmptyState icon={<Building2 size={40} />} title="No branches configured yet" message="Add your first campus — classrooms, staff, students and operations all hang from a branch." /> : (
                  <div className="dtable-scroll"><table className="dtable">
                    <thead><tr><th>Branch</th><th>Timings</th><th>Capacity</th><th>Facilities</th><th>Staff</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>{list.map((b: any) => (
                      <tr key={String(b.id)}>
                        <td><span className="cell-strong">{b.name}</span><span className="cell-sub">{b.code} · {b.city ?? '—'}</span></td>
                        <td>{b.timingOpen || '08:30'}–{b.timingClose || '16:00'}</td>
                        <td>{b.capacity ? (b.capacity + ' seats') : 'Flexible'}</td>
                        <td>{String(b.facilities ?? 0)}</td>
                        <td>{String(b.staff ?? 0)}</td>
                        <td><StatusBadge status={b.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                        <td>
                          <button className="btn btn-sm btn-outline" onClick={() => { setEditItem(b); setEditType('branch'); }} title="Edit branch details">
                            <Edit3 size={13} /> Edit
                          </button>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                )}
              </>
            )}

            {kind === 'programs' && (
              <>
                <TableToolbar title="Programs" count={list.length} onAdd={() => setModal('program')} addLabel="Add Program" />
                {list.length === 0 ? <EmptyState icon={<Blocks size={40} />} title="No programs configured" message="Define the programs your preschool runs — Playgroup, Nursery, Jr KG, Sr KG, Daycare or fully custom programs." /> : (
                  <div className="dtable-scroll"><table className="dtable">
                    <thead><tr><th>Program</th><th>Age band</th><th>Capacity</th><th>Classes</th><th>Fee plan</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>{list.map((p: any) => (
                      <tr key={String(p.id)}>
                        <td><span className="cell-strong">{p.name}</span><span className="cell-sub">{p.code} · {String(p.programType).toLowerCase()}</span></td>
                        <td>{p.ageMinMonths != null && p.ageMaxMonths != null ? (p.ageMinMonths + '–' + p.ageMaxMonths + ' mo') : 'Flexible'}</td>
                        <td>{p.capacity ? (p.capacity + ' seats') : '—'}</td>
                        <td>{String(p.classrooms ?? 0)}</td>
                        <td>{p.hasFeePlan ? <span className="badge b-success">linked</span> : <span className="badge b-warning">none</span>}</td>
                        <td><StatusBadge status={p.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                        <td>
                          <button className="btn btn-sm btn-outline" onClick={() => { setEditItem(p); setEditType('program'); }} title="Edit program age and capacity">
                            <Edit3 size={13} /> Edit
                          </button>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                )}
              </>
            )}

            {kind === 'roles' && (
              <>
                <p className="card-sub" style={{ marginBottom: 14 }}>PreOne uses one RBAC system. Members below already carry platform-enforced roles — invite more staff in Settings → Staff.</p>
                <div className="dtable-scroll"><table className="dtable">
                  <thead><tr><th>Member</th><th>Role</th><th>Status</th></tr></thead>
                  <tbody>{list.map((u: any) => (
                    <tr key={String(u.id)}>
                      <td><span className="cell-strong">{u.name}</span><span className="cell-sub">{u.email}</span></td>
                      <td><span className="badge b-primary">{String(u.role).replaceAll('_', ' ')}</span></td>
                      <td><StatusBadge status={String(u.status)} /></td>
                    </tr>
                  ))}</tbody>
                </table></div>
                <p className="helper" style={{ marginTop: 10 }}>This step completes automatically once the owner plus at least one operator account exist.</p>
              </>
            )}

            {kind === 'years' && (
              <>
                <TableToolbar title="Academic years" count={list.length} onAdd={() => setModal('year')} addLabel="Create Academic Year" />
                {list.length === 0 ? <EmptyState icon={<CalendarPlus size={40} />} title="No academic year exists" message="Create the operating year — enrolment, attendance, fees and reports all hang from it. Historical years stay queryable forever." /> : (
                  <div className="dtable-scroll"><table className="dtable">
                    <thead><tr><th>Year</th><th>Range</th><th>Classes</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>{list.map((y: any) => (
                      <tr key={String(y.id)}>
                        <td><span className="cell-strong">{y.name}</span>{y.isCurrent && <span className="badge b-success" style={{ marginLeft: 6 }}>current</span>}</td>
                        <td>{new Date(String(y.startDate)).toLocaleDateString()} → {new Date(String(y.endDate)).toLocaleDateString()}</td>
                        <td>{String(y.classrooms ?? 0)}</td>
                        <td><StatusBadge status={String(y.status)} /></td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button className="btn btn-sm btn-outline" onClick={() => { setEditItem(y); setEditType('year'); }} title="Edit academic year dates">
                              <Edit3 size={13} /> Edit
                            </button>
                            {!y.isCurrent && (
                              <button className="btn btn-sm btn-outline" onClick={async () => {
                                const j = await api(`/api/v1/academic-years/${y.id}`, 'PATCH', { setStatusCurrent: true });
                                if (j.success) { toast.success('Current year set', String(y.name)); refreshAll() } else toast.error('Failed', j.error?.message)
                              }}>
                                Set current
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                )}
              </>
            )}

            {kind === 'calendar' && (
              <>
                <TableToolbar title="Calendar events" count={list.length} onAdd={() => setModal('event')} addLabel="Add Event" />
                {list.length === 0 ? <EmptyState icon={<CalendarDays size={40} />} title="No calendar events" message="Add holidays, vacations, parent meetings, assessment periods and special days — attendance understands them." /> : (
                  <div className="dtable-scroll"><table className="dtable">
                    <thead><tr><th>Date</th><th>Type</th><th>Title</th><th></th></tr></thead>
                    <tbody>{list.map((e: any) => (
                      <tr key={String(e.id)}>
                        <td>{new Date(String(e.date)).toLocaleDateString()}</td>
                        <td><span className="badge b-info">{String(e.type).replaceAll('_', ' ')}</span></td>
                        <td><span className="cell-strong">{e.title}</span><span className="cell-sub">{e.notes ?? ''}</span></td>
                        <td><button className="btn btn-sm btn-ghost" onClick={async () => { const j = await api(`/api/v1/calendar/${e.id}`, 'DELETE'); if (j.success) { toast.info('Removed'); refreshAll() } else toast.error('Failed', j.error?.message) }}><Trash2 size={13} /></button></td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                )}
              </>
            )}

            {kind === 'infrastructure' && <InfraSection rooms={list} onDone={refreshAll} onAddFacility={() => setModal('facility')} onEditFacility={(f) => { setEditItem(f); setEditType('facility'); }} onEditClass={(c) => { setEditItem(c); setEditType('class'); }} />}

            {kind === 'classes' && <ClassesSection rooms={list} onDone={refreshAll} onEditClass={(c) => { setEditItem(c); setEditType('class'); }} onAddClass={() => setModal('classroom')} />}

            {kind === 'subjects' && (
              <>
                <TableToolbar title="Subjects & Learning Areas" count={list.length} icon={<BookOpen size={14} style={{ marginRight: 6, verticalAlign: -2 }} />} onAdd={() => setModal('subject')} addLabel="Add Subject" />
                <p className="helper" style={{ marginBottom: 10 }}>Configure core and activity learning areas (e.g. Literacy, Numeracy, Motor Skills) and map them to programs.</p>
                {list.length === 0 ? (
                  <EmptyState icon={<BookOpen size={40} />} title="No subjects configured" message="Add early learning areas and subjects. These link to programs and classroom observations." />
                ) : (
                  <div className="dtable-scroll"><table className="dtable">
                    <thead><tr><th>Subject</th><th>Type</th><th>Programs Mapped</th><th>Classes</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>{list.map((s: any) => (
                      <tr key={String(s.id)}>
                        <td><span className="cell-strong">{s.name}</span><span className="cell-sub">{s.code}</span></td>
                        <td><span className={`badge ${s.type === 'CORE' ? 'b-primary' : s.type === 'OPTIONAL' ? 'b-info' : 'b-neutral'}`}>{s.type}</span></td>
                        <td>
                          {s.programSubjects && s.programSubjects.length > 0 ? (
                            <span className="badge b-success">{s.programSubjects.map((ps: any) => ps.program?.name ?? ps.programId).join(', ')}</span>
                          ) : (
                            <span className="badge b-warning">Unmapped</span>
                          )}
                        </td>
                        <td>{String(s.classroomCount ?? 0)}</td>
                        <td><StatusBadge status={s.active ? 'ACTIVE' : 'INACTIVE'} /></td>
                        <td>
                          <button className="btn btn-sm btn-outline" onClick={() => { setEditItem(s); setEditType('subject'); }} title="Edit subject">
                            <Edit3 size={13} /> Edit
                          </button>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                )}
              </>
            )}

            {kind === 'teachers' && <TeachersSection rooms={list} onDone={refreshAll} />}

            {kind === 'staff' && <StaffSection staff={list} onDone={refreshAll} onAdd={() => setModal('staff')} onEditStaff={(s) => { setEditItem(s); setEditType('staff'); }} />}

            {kind === 'fees' && (
              <>
                <p className="card-sub" style={{ marginBottom: 14 }}>Every active program needs an active fee plan — invoices can never be generated without valid fee configuration. Fee heads and plan items live in <a href="/app/settings" className="cell-link">Settings → Fees</a> (existing Finance domain).</p>
                <div className="dtable-scroll"><table className="dtable">
                  <thead><tr><th>Program</th><th>Fee plan</th><th>Classes</th></tr></thead>
                  <tbody>{list.map((p: any) => (
                    <tr key={String(p.id)}>
                      <td><span className="cell-strong">{p.name}</span><span className="cell-sub">{p.code}</span></td>
                      <td>{p.hasFeePlan ? <span className="badge b-success">active plan linked</span> : <span className="badge b-danger">no fee plan</span>}</td>
                      <td>{String(p.classrooms)}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
                <div style={{ marginTop: 14 }}>
                  <p className="card-sub" style={{ marginBottom: 8 }}>Accepted payment methods (Finance configuration):</p>
                  <QuickFinanceConfig onDone={refreshAll} api={api} toast={toast} />
                </div>
              </>
            )}

            {kind === 'import' && (
              <>
                <p className="card-sub" style={{ marginBottom: 12 }}>
                  CSV header: <code>firstName,lastName,dob,gender,admissionNo,guardianName,guardianPhone,relationship</code><br />
                  Rows are validated first — duplicates are flagged and never silently created. Preview → Import.
                </p>
                <textarea className="textarea" rows={6} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'firstName,lastName,dob,gender,admissionNo,guardianName,guardianPhone,relationship\nAarav,Sharma,2022-04-12,MALE,IMP-001,Priya Sharma,9876543210,MOTHER'} />
                <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                  <button className="btn btn-outline" onClick={async () => { const j = await api('/api/v1/setup/import/students', 'POST', { mode: 'preview', csv }); if (j.success) { setImportPreview(j.data); toast.info('Preview ready', j.data.message) } else toast.error('Preview failed', j.error?.message) }} disabled={!csv.trim()}>
                    <Upload size={15} /> Validate & Preview
                  </button>
                  {importPreview && Number(importPreview.valid) > 0 && (
                    <button className="btn btn-primary" onClick={async () => { const j = await api('/api/v1/setup/import/students', 'POST', { mode: 'commit', csv }); if (j.success) { toast.success('Import complete', j.data.message); setImportPreview(null); setCsv(''); loadStatus() } else toast.error('Import failed', j.error?.message) }}>
                      <Upload size={15} /> Import {String(importPreview.valid)} students
                    </button>
                  )}
                </div>
                {importPreview && (
                  <div style={{ marginTop: 12, maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
                    <table className="dtable"><thead><tr><th>Row</th><th>Child</th><th>Admission No</th><th>Guardian</th><th>Status</th></tr></thead>
                      <tbody>{(importPreview.rows as any[]).map((r: any) => (
                        <tr key={String(r.row)}>
                          <td>{String(r.row)}</td>
                          <td>{r.firstName} {r.lastName}</td>
                          <td>{r.admissionNo}</td>
                          <td>{r.guardian}</td>
                          <td>{r.status === 'READY' ? <span className="badge b-success">READY</span> : <span className="badge b-danger" title={(r.errors as string[])?.join('; ')}>ERROR</span>}</td>
                        </tr>
                      ))}</tbody></table>
                  </div>
                )}
              </>
            )}

            {kind === 'unknown' && <EmptyState icon={<Settings2 size={40} />} title="Nothing to configure" message="This step completes from your existing data — mark it complete below." />}

            {/* footer complete for non-form kinds */}
            {kind !== 'config' && kind !== 'branding' && kind !== 'profile' && me?.status !== 'COMPLETE' && me?.status !== 'SKIPPED' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
                <span className="helper" style={{ marginRight: 'auto' }}>Completion is verified against your real data — this records who completed the step and when.</span>
                <button className="btn btn-primary" onClick={() => completeStep(true)} disabled={saving}><CheckCircle2 size={15} /> Mark Step Complete</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODALS (rendered from parent with real api/toast) ── */}
      {modal === 'branch' && <BranchModal onClose={() => setModal(null)} onDone={refreshAll} api={api} toast={toast} />}
      {modal === 'program' && <ProgramModal onClose={() => setModal(null)} onDone={refreshAll} api={api} toast={toast} />}
      {modal === 'subject' && <SubjectModal onClose={() => setModal(null)} onDone={refreshAll} api={api} toast={toast} />}
      {modal === 'year' && <YearModal onClose={() => setModal(null)} onDone={refreshAll} api={api} toast={toast} />}
      {modal === 'event' && <EventModal onClose={() => setModal(null)} onDone={refreshAll} api={api} toast={toast} />}
      {modal === 'classroom' && <ClassroomModal onClose={() => setModal(null)} onDone={refreshAll} api={api} toast={toast} />}
      {modal === 'facility' && <FacilityModal onClose={() => setModal(null)} onDone={refreshAll} api={api} toast={toast} />}
      {modal === 'staff' && <StaffModal onClose={() => setModal(null)} onDone={refreshAll} api={api} toast={toast} />}

      {/* ── EDIT MODALS (In-Place Row-Level Editing) ── */}
      {editType === 'branch' && editItem && (
        <EditBranchModal item={editItem} onClose={() => { setEditType(null); setEditItem(null); }} onDone={refreshAll} api={api} toast={toast} />
      )}
      {editType === 'program' && editItem && (
        <EditProgramModal item={editItem} onClose={() => { setEditType(null); setEditItem(null); }} onDone={refreshAll} api={api} toast={toast} />
      )}
      {editType === 'subject' && editItem && (
        <EditSubjectModal item={editItem} onClose={() => { setEditType(null); setEditItem(null); }} onDone={refreshAll} api={api} toast={toast} />
      )}
      {editType === 'year' && editItem && (
        <EditYearModal item={editItem} onClose={() => { setEditType(null); setEditItem(null); }} onDone={refreshAll} api={api} toast={toast} />
      )}
      {editType === 'class' && editItem && (
        <EditClassModal item={editItem} onClose={() => { setEditType(null); setEditItem(null); }} onDone={refreshAll} api={api} toast={toast} />
      )}
      {editType === 'facility' && editItem && (
        <EditFacilityModal item={editItem} onClose={() => { setEditType(null); setEditItem(null); }} onDone={refreshAll} api={api} toast={toast} />
      )}
      {editType === 'staff' && editItem && (
        <EditStaffModal item={editItem} onClose={() => { setEditType(null); setEditItem(null); }} onDone={refreshAll} api={api} toast={toast} />
      )}
    </>
  )
}

/* ────────────────────────── section components ────────────────────────── */
function InfraSection({ rooms, onDone, onAddFacility, onEditFacility, onEditClass }: { rooms: Dict[]; onDone: () => void; onAddFacility: () => void; onEditFacility: (f: Dict) => void; onEditClass: (c: Dict) => void }) {
  const [facilities, setFacilities] = useState<Dict[] | null>(null)
  const loadF = useCallback(async () => { const j = await fetch('/api/v1/facilities').then((r) => r.json()); if (j.success) setFacilities(j.data) }, [])
  useEffect(() => { Promise.resolve().then(loadF) }, [loadF])
  return (
    <>
      <TableToolbar title="Rooms (classrooms)" count={rooms.length} icon={<LayoutGrid size={14} style={{ marginRight: 6, verticalAlign: -2 }} />} />
      <p className="helper" style={{ marginBottom: 10 }}>Rooms are managed in <a href="/app/settings" className="cell-link">Settings → Classes</a> — every active room counts toward this step; other areas are registered here.</p>
      <div className="dtable-scroll"><table className="dtable">
        <thead><tr><th>Room</th><th>Program</th><th>Capacity</th><th>Teacher</th><th>Students</th><th>Actions</th></tr></thead>
        <tbody>{rooms.map((c: any) => (
          <tr key={String(c.id)}>
            <td><span className="cell-strong">{c.name}</span><span className="cell-sub">{c.code}</span></td>
            <td>{c.programName ?? String(c.programType).toLowerCase()}</td>
            <td>{String(c.capacity)}</td>
            <td>{c.teacher ?? <span className="badge b-warning">unassigned</span>}</td>
            <td>{String(c.students)}</td>
            <td>
              <button className="btn btn-sm btn-outline" onClick={() => onEditClass(c)} title="Edit room capacity and teacher">
                <Edit3 size={13} /> Edit
              </button>
            </td>
          </tr>
        ))}</tbody>
      </table></div>
      <div className="table-toolbar" style={{ margin: '16px 0 10px' }}>
        <div className="card-title">Other facilities <span className="badge b-neutral">{facilities?.length ?? '…'}</span></div>
        <button className="btn btn-primary btn-sm" onClick={onAddFacility}><Plus size={14} /> Register Facility</button>
      </div>
      {facilities !== null && facilities.length === 0 ? (
        <EmptyState icon={<DoorOpen size={36} />} title="No play / nap / meal areas yet" message="Recommended: register activity, play, nap, meal areas, washrooms and a medical room for daily operations and safety." />
      ) : (
        <div className="dtable-scroll"><table className="dtable">
          <thead><tr><th>Facility</th><th>Type</th><th>Branch</th><th>Capacity</th><th>Actions</th></tr></thead>
          <tbody>{(facilities ?? []).map((f: any) => (
            <tr key={String(f.id)}>
              <td><span className="cell-strong">{f.name}</span><span className="cell-sub">{f.code}</span></td>
              <td><span className="badge b-info">{String(f.type).replaceAll('_', ' ')}</span></td>
              <td>{f.branchName}</td>
              <td>{f.capacity ?? '—'}</td>
              <td>
                <button className="btn btn-sm btn-outline" onClick={() => onEditFacility(f)} title="Edit facility details">
                  <Edit3 size={13} /> Edit
                </button>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  )
}

function ClassesSection({ rooms, onDone, onEditClass, onAddClass }: { rooms: Dict[]; onDone: () => void; onEditClass: (c: Dict) => void; onAddClass: () => void }) {
  const toast = useToast()
  const [programs, setPrograms] = useState<Dict[]>([])
  useEffect(() => { fetch('/api/v1/programs').then((r) => r.json()).then((j) => { if (j.success) setPrograms(j.data) }) }, [])
  const link = async (id: string, programId: string) => {
    const j = await fetch(`/api/v1/classrooms/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ programId: programId || null }) }).then((r) => r.json())
    if (j.success) { toast.success('Program linked'); onDone() } else toast.error('Failed', j.error?.message)
  }
  return (
    <>
      <TableToolbar title="Class-sections (current year)" count={rooms.length} icon={<LayoutGrid size={14} style={{ marginRight: 6, verticalAlign: -2 }} />} onAdd={onAddClass} addLabel="Add Classroom" />
      <p className="helper" style={{ marginBottom: 10 }}>New classes are added in <a href="/app/settings" className="cell-link">Settings → Classes</a>. Here you link each class-section to its program — capacity guards prevent over-allocation.</p>
      <div className="dtable-scroll"><table className="dtable">
        <thead><tr><th>Class</th><th>Linked program</th><th>Capacity</th><th>Teacher</th><th>Students</th><th>Link program</th><th>Actions</th></tr></thead>
        <tbody>{rooms.map((c: any) => (
          <tr key={String(c.id)}>
            <td><span className="cell-strong">{c.name}</span><span className="cell-sub">{c.code}</span></td>
            <td>{c.programName ?? <span className="badge b-warning">not linked</span>}</td>
            <td>{String(c.capacity)}</td>
            <td>{c.teacher ?? <span className="badge b-warning">unassigned</span>}</td>
            <td>{String(c.students)}</td>
            <td>
              <select className="select" style={{ maxWidth: 180 }} value={String(c.programId ?? '')} onChange={(e) => link(String(c.id), e.target.value)}>
                <option value="">— choose —</option>
                {programs.map((p: any) => <option key={String(p.id)} value={String(p.id)}>{p.name}</option>)}
              </select>
            </td>
            <td>
              <button className="btn btn-sm btn-outline" onClick={() => onEditClass(c)} title="Edit class settings">
                <Edit3 size={13} /> Edit
              </button>
            </td>
          </tr>
        ))}</tbody>
      </table></div>
      {rooms.length === 0 && <EmptyState icon={<LayoutGrid size={36} />} title="No classes for the current year" message="Add class-sections in Settings → Classes — each needs a program link and capacity." />}
    </>
  )
}

function TeachersSection({ rooms, onDone }: { rooms: Dict[]; onDone: () => void }) {
  const toast = useToast()
  const [members, setMembers] = useState<Dict[]>([])
  const [sel, setSel] = useState<Dict | null>(null)
  const [teacherId, setTeacherId] = useState('')
  useEffect(() => { fetch('/api/v1/users').then((r) => r.json()).then((j) => { if (j.success) setMembers(j.data) }) }, [])
  const unassigned = rooms.filter((c) => !c.primaryTeacherId).length
  const assign = async () => {
    if (!sel || !teacherId) return
    const j = await fetch(`/api/v1/classrooms/${sel.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ primaryTeacherId: teacherId }) }).then((r) => r.json())
    if (j.success) { toast.success('Teacher assigned', sel.name as string); setSel(null); onDone() } else toast.error('Failed', j.error?.message)
  }
  return (
    <>
      <TableToolbar title="Teacher assignment" count={rooms.length} icon={<GraduationCap size={14} style={{ marginRight: 6, verticalAlign: -2 }} />} addLabel={`${unassigned} without teacher`} />
      <div className="dtable-scroll"><table className="dtable">
        <thead><tr><th>Class</th><th>Primary teacher</th><th></th></tr></thead>
        <tbody>{rooms.map((c: any) => (
          <tr key={String(c.id)}>
            <td><span className="cell-strong">{c.name}</span><span className="cell-sub">{c.code}</span></td>
            <td>{c.teacher ?? <span className="badge b-warning">unassigned</span>}</td>
            <td><button className="btn btn-sm btn-outline" onClick={() => { setSel(c); setTeacherId('') }}><UserPlus size={13} /> Assign</button></td>
          </tr>
        ))}</tbody>
      </table></div>
      {rooms.length === 0 && <EmptyState icon={<GraduationCap size={36} />} title="No classes to staff yet" message="Classes & Sections must be configured before teachers can be assigned." />}
      {sel && (
        <Modal open onClose={() => setSel(null)} title={`Assign teacher — ${sel.name}`} icon={<GraduationCap size={22} />} iconClass="ic-blue">
          <div className="form-grid">
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Member <span className="req">*</span></label>
              <select className="select" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                <option value="">Select member…</option>
                {members.map((u: any) => <option key={String(u.userId)} value={String(u.userId)}>{u.name} ({String(u.role).replaceAll('_', ' ')})</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={() => setSel(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={assign} disabled={!teacherId}>Assign</button>
          </div>
        </Modal>
      )}
    </>
  )
}

function StaffSection({ staff, onDone, onAdd, onEditStaff }: { staff: Dict[]; onDone: () => void; onAdd: () => void; onEditStaff: (s: Dict) => void }) {
  const toast = useToast()
  const [branches, setBranches] = useState<Dict[]>([])
  useEffect(() => { fetch('/api/v1/branches').then((r) => r.json()).then((j) => { if (j.success) setBranches(j.data) }) }, [])
  const assign = async (id: string, branchId: string) => {
    const j = await fetch('/api/v1/staff', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, branchId: branchId || null }) }).then((r) => r.json())
    if (j.success) { toast.success(branchId ? 'Branch assigned' : 'Assignment cleared'); onDone() } else toast.error('Failed', j.error?.message)
  }
  return (
    <>
      <TableToolbar title="Staff foundation" count={staff.length} icon={<Users size={14} style={{ marginRight: 6, verticalAlign: -2 }} />} onAdd={onAdd} addLabel="Add Staff" />
      {staff.length === 0 ? <EmptyState icon={<Users size={40} />} title="No staff yet" message="Create staff employment profiles — identity comes from their PreOne account, employment data lives here." /> : (
        <div className="dtable-scroll"><table className="dtable">
          <thead><tr><th>Staff</th><th>Role</th><th>Branch</th><th>Employment</th><th>Classes</th><th>Assign branch</th><th>Actions</th></tr></thead>
          <tbody>{staff.map((s: any) => (
            <tr key={String(s.id)}>
              <td><span className="cell-strong">{s.name}</span><span className="cell-sub">{s.employeeCode} · {s.email}</span></td>
              <td><span className="badge b-primary">{String(s.role ?? '—').replaceAll('_', ' ')}</span></td>
              <td>{s.branchName ?? <span className="badge b-warning">unassigned</span>}</td>
              <td><span className="cell-sub">{String(s.employmentType).toLowerCase()} · joined {s.joiningDate ? new Date(String(s.joiningDate)).toLocaleDateString() : '—'}</span></td>
              <td>{String(s.classesAssigned)}</td>
              <td>
                <select className="select" style={{ maxWidth: 160 }} value={String(s.branchId ?? '')} onChange={(e) => assign(String(s.id), e.target.value)}>
                  <option value="">— none —</option>
                  {branches.map((b: any) => <option key={String(b.id)} value={String(b.id)}>{b.name}</option>)}
                </select>
              </td>
              <td>
                <button className="btn btn-sm btn-outline" onClick={() => onEditStaff(s)} title="Edit staff profile">
                  <Edit3 size={13} /> Edit
                </button>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  )
}

function QuickFinanceConfig({ onDone, api, toast }: { onDone: () => void; api: ApiFn; toast: ToastFn }) {
  const [methods, setMethods] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    fetch('/api/v1/setup/config/FINANCE').then((r) => r.json()).then((j) => {
      if (j.success) setMethods((j.data.data?.paymentMethods as string[]) ?? ['CASH', 'UPI', 'BANK_TRANSFER'])
      setLoaded(true)
    })
  }, [])
  if (!loaded) return <Skeleton h={40} />
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <IndianRupee size={14} style={{ color: 'var(--foreground-secondary)' }} />
      {['CASH', 'CHEQUE', 'CARD', 'UPI', 'NET_BANKING', 'BANK_TRANSFER'].map((m) => {
        const on = methods.includes(m)
        return <button key={m} className={`badge ${on ? 'b-primary' : 'b-neutral'}`} style={{ cursor: 'pointer', padding: '5px 10px' }} onClick={async () => {
          const next = on ? methods.filter((x) => x !== m) : [...methods, m]
          setMethods(next)
          const j = await api('/api/v1/setup/config/FINANCE', 'PUT', { paymentMethods: next })
          if (j.success) { toast.success('Payment methods updated'); onDone() } else toast.error('Failed', j.error?.message)
        }}>{on ? '✓ ' : ''}{m.replaceAll('_', ' ').toLowerCase()}</button>
      })}
    </div>
  )
}

/* ────────────────────────── modals ────────────────────────── */
function BranchModal({ onClose, onDone, api, toast }: { onClose: () => void; onDone: () => void; api: ApiFn; toast: ToastFn }) {
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true)
    const fd = Object.fromEntries(new FormData(e.currentTarget).entries())
    const j = await api('/api/v1/branches', 'POST', fd)
    setBusy(false)
    if (j.success) { toast.success('Branch created', String(j.data.name)); onDone() } else toast.error('Failed', j.error?.message)
  }
  return (
    <Modal open onClose={onClose} title="Add Branch / Campus" icon={<Building2 size={22} />} iconClass="ic-blue">
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label>Name <span className="req">*</span></label><input className="input" name="name" required /></div>
          <div className="field"><label>Code <span className="req">*</span></label><input className="input" name="code" required placeholder="MAIN2" /></div>
          <div className="field"><label>City</label><input className="input" name="city" /></div>
          <div className="field"><label>Phone</label><input className="input" name="phone" /></div>
          <div className="field"><label>Opens at</label><input className="input" name="timingOpen" type="time" defaultValue="08:30" /></div>
          <div className="field"><label>Closes at</label><input className="input" name="timingClose" type="time" defaultValue="16:00" /></div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Address</label><input className="input" name="address" /></div>
          <div className="field"><label>Capacity (seats)</label><input className="input" name="capacity" type="number" min="1" /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>Create Branch</button>
        </div>
      </form>
    </Modal>
  )
}

function ProgramModal({ onClose, onDone, api, toast }: { onClose: () => void; onDone: () => void; api: ApiFn; toast: ToastFn }) {
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true)
    const fd = Object.fromEntries(new FormData(e.currentTarget).entries())
    const j = await api('/api/v1/programs', 'POST', fd)
    setBusy(false)
    if (j.success) { toast.success('Program created', String(j.data.name)); onDone() } else toast.error('Failed', j.error?.message)
  }
  return (
    <Modal open onClose={onClose} title="Add Program" icon={<Blocks size={22} />} iconClass="ic-violet">
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label>Name <span className="req">*</span></label><input className="input" name="name" required placeholder="Jr KG" /></div>
          <div className="field"><label>Code <span className="req">*</span></label><input className="input" name="code" required placeholder="JKG" /></div>
          <div className="field"><label>System program type <span className="req">*</span></label>
            <select className="select" name="programType" required>
              {['PLAYGROUP', 'NURSERY', 'LKG', 'UKG', 'DAYCARE'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="helper">Links the program to fee plans and existing integrations — name and code stay fully custom.</div>
          </div>
          <div className="field"><label>Capacity <span className="req">*</span></label><input className="input" name="capacity" type="number" defaultValue={20} min="1" required /></div>
          <div className="field"><label>Min age (months)</label><input className="input" name="ageMinMonths" type="number" /></div>
          <div className="field"><label>Max age (months)</label><input className="input" name="ageMaxMonths" type="number" /></div>
          <div className="field"><label>Duration (months)</label><input className="input" name="durationMonths" type="number" placeholder="12" /></div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Description</label><input className="input" name="description" /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>Create Program</button>
        </div>
      </form>
    </Modal>
  )
}

function YearModal({ onClose, onDone, api, toast }: { onClose: () => void; onDone: () => void; api: ApiFn; toast: ToastFn }) {
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true)
    const fd = Object.fromEntries(new FormData(e.currentTarget).entries())
    const j = await api('/api/v1/academic-years', 'POST', fd)
    setBusy(false)
    if (j.success) { toast.success('Academic year created', String(j.data.name)); onDone() } else toast.error('Failed', j.error?.message)
  }
  return (
    <Modal open onClose={onClose} title="Create Academic Year" icon={<CalendarPlus size={22} />} iconClass="ic-green">
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label>Name <span className="req">*</span></label><input className="input" name="name" required placeholder="2026-27" /></div>
          <div className="field"><label>Start date <span className="req">*</span></label><input className="input" name="startDate" type="date" required /></div>
          <div className="field"><label>End date <span className="req">*</span></label><input className="input" name="endDate" type="date" required /></div>
        </div>
        <p className="helper">The first academic year is automatically marked current. Terms can be added in Operating Configuration.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>Create Year</button>
        </div>
      </form>
    </Modal>
  )
}

function EventModal({ onClose, onDone, api, toast }: { onClose: () => void; onDone: () => void; api: ApiFn; toast: ToastFn }) {
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true)
    const fd = Object.fromEntries(new FormData(e.currentTarget).entries())
    const j = await api('/api/v1/calendar', 'POST', fd)
    setBusy(false)
    if (j.success) { toast.success('Event added', String(fd.title)); onDone() } else toast.error('Failed', j.error?.message)
  }
  return (
    <Modal open onClose={onClose} title="Add Calendar Event" icon={<CalendarPlus size={22} />} iconClass="ic-cyan">
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label>Date <span className="req">*</span></label><input className="input" name="date" type="date" required /></div>
          <div className="field"><label>Type <span className="req">*</span></label>
            <select className="select" name="type" required>{['HOLIDAY', 'VACATION', 'EVENT', 'PARENT_MEETING', 'ASSESSMENT', 'SPECIAL_DAY'].map((t) => <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>)}</select>
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Title <span className="req">*</span></label><input className="input" name="title" required /></div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Notes</label><input className="input" name="notes" /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>Add Event</button>
        </div>
      </form>
    </Modal>
  )
}

function FacilityModal({ onClose, onDone, api, toast }: { onClose: () => void; onDone: () => void; api: ApiFn; toast: ToastFn }) {
  const [busy, setBusy] = useState(false)
  const [branches, setBranches] = useState<Dict[]>([])
  useEffect(() => { fetch('/api/v1/branches').then((r) => r.json()).then((j) => { if (j.success) setBranches(j.data) }) }, [])
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true)
    const fd = Object.fromEntries(new FormData(e.currentTarget).entries())
    const j = await api('/api/v1/facilities', 'POST', fd)
    setBusy(false)
    if (j.success) { toast.success('Facility registered', String(j.data.name)); onDone() } else toast.error('Failed', j.error?.message)
  }
  return (
    <Modal open onClose={onClose} title="Register Facility / Area" icon={<DoorOpen size={22} />} iconClass="ic-orange">
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label>Branch <span className="req">*</span></label>
            <select className="select" name="branchId" required>{branches.map((b: any) => <option key={String(b.id)} value={String(b.id)}>{b.name}</option>)}</select>
          </div>
          <div className="field"><label>Type <span className="req">*</span></label>
            <select className="select" name="type" required>{['CLASSROOM', 'ACTIVITY_AREA', 'PLAY_AREA', 'NAP_AREA', 'MEAL_AREA', 'WASHROOM', 'MEDICAL', 'OTHER'].map((t) => <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>)}</select>
          </div>
          <div className="field"><label>Name <span className="req">*</span></label><input className="input" name="name" required /></div>
          <div className="field"><label>Code <span className="req">*</span></label><input className="input" name="code" required placeholder="PLAY-1" /></div>
          <div className="field"><label>Capacity</label><input className="input" name="capacity" type="number" /></div>
          <div className="field"><label>Floor / area</label><input className="input" name="floorOrArea" placeholder="Ground floor, east wing" /></div>
          <div className="field"><label>Age suitability</label><input className="input" name="ageSuitability" placeholder="2–4 years" /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>Register Facility</button>
        </div>
      </form>
    </Modal>
  )
}

function StaffModal({ onClose, onDone, api, toast }: { onClose: () => void; onDone: () => void; api: ApiFn; toast: ToastFn }) {
  const [busy, setBusy] = useState(false)
  const [branches, setBranches] = useState<Dict[]>([])
  useEffect(() => { fetch('/api/v1/branches').then((r) => r.json()).then((j) => { if (j.success) setBranches(j.data) }) }, [])
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true)
    const fd = Object.fromEntries(new FormData(e.currentTarget).entries())
    const j = await api('/api/v1/staff', 'POST', { ...fd, mode: 'new' })
    setBusy(false)
    if (j.success) { toast.success('Staff created', String(fd.employeeCode)); onDone() } else toast.error('Failed', j.error?.message)
  }
  return (
    <Modal open onClose={onClose} title="Add Staff Member" icon={<UserPlus size={22} />} iconClass="ic-purple" wide>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label>Full name <span className="req">*</span></label><input className="input" name="fullName" required /></div>
          <div className="field"><label>Email (login) <span className="req">*</span></label><input className="input" name="email" type="email" required /></div>
          <div className="field"><label>Temporary password <span className="req">*</span></label><input className="input" name="password" required minLength={6} /></div>
          <div className="field"><label>Role <span className="req">*</span></label>
            <select className="select" name="role" required>
              {CANONICAL_SETUP_STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_META[r]?.label ? `${r} — ${ROLE_META[r].label}` : r}
                </option>
              ))}
            </select>
          </div>
          <div className="field"><label>Employee code <span className="req">*</span></label><input className="input" name="employeeCode" required placeholder="EMP-001" /></div>
          <div className="field"><label>Branch (operational assignment)</label>
            <select className="select" name="branchId">
              <option value="">— assign later —</option>
              {branches.map((b: any) => <option key={String(b.id)} value={String(b.id)}>{b.name}</option>)}
            </select>
            <div className="helper">Created ≠ assigned — branch assignment completes the Staff Foundation step.</div>
          </div>
          <div className="field"><label>Designation</label><input className="input" name="designation" /></div>
          <div className="field"><label>Qualification</label><input className="input" name="qualification" /></div>
          <div className="field"><label>Joining date</label><input className="input" name="joiningDate" type="date" /></div>
          <div className="field"><label>Employment type</label>
            <select className="select" name="employmentType">{['REGULAR', 'PART_TIME', 'CONTRACT', 'INTERN'].map((t) => <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>)}</select>
          </div>
          <div className="field"><label>Emergency contact name</label><input className="input" name="emergencyContactName" /></div>
          <div className="field"><label>Emergency contact phone</label><input className="input" name="emergencyContactPhone" /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>Create Staff</button>
        </div>
      </form>
    </Modal>
  )
}

/* ────────────────────────── IN-PLACE EDIT MODALS ────────────────────────── */

function EditBranchModal({ item, onClose, onDone, api, toast }: { item: Dict; onClose: () => void; onDone: () => void; api: ApiFn; toast: ToastFn }) {
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true)
    const fd = Object.fromEntries(new FormData(e.currentTarget).entries())
    const payload = {
      name: fd.name,
      address: fd.address || null,
      city: fd.city || null,
      phone: fd.phone || null,
      timingOpen: fd.timingOpen || '08:30',
      timingClose: fd.timingClose || '16:00',
      capacity: fd.capacity ? Number(fd.capacity) : null,
      isActive: fd.isActive === 'on',
    }
    const j = await api('/api/v1/branches/' + item.id, 'PATCH', payload)
    setBusy(false)
    if (j.success) {
      toast.success('Branch updated', String(j.data.name))
      onClose(); onDone()
    } else {
      toast.error('Update failed', j.error?.message)
    }
  }

  return (
    <Modal open onClose={onClose} title={'Edit Branch — ' + item.name} icon={<Building2 size={22} />} iconClass="ic-blue">
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label>Branch Name <span className="req">*</span></label><input className="input" name="name" defaultValue={String(item.name || '')} required /></div>
          <div className="field"><label>Code</label><input className="input" value={String(item.code || '')} disabled title="Branch code is permanent" /></div>
          <div className="field"><label>City</label><input className="input" name="city" defaultValue={String(item.city || '')} /></div>
          <div className="field"><label>Contact Phone</label><input className="input" name="phone" defaultValue={String(item.phone || '')} /></div>
          <div className="field"><label>Opens at</label><input className="input" name="timingOpen" type="time" defaultValue={String(item.timingOpen || '08:30')} /></div>
          <div className="field"><label>Closes at</label><input className="input" name="timingClose" type="time" defaultValue={String(item.timingClose || '16:00')} /></div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Campus Address</label><input className="input" name="address" defaultValue={String(item.address || '')} /></div>
          <div className="field"><label>Seat Capacity</label><input className="input" name="capacity" type="number" defaultValue={item.capacity ? Number(item.capacity) : ''} min="1" /></div>
          <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" name="isActive" defaultChecked={item.isActive !== false} />
              <span>Active Branch</span>
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className={'btn btn-primary ' + (busy ? 'is-loading' : '')} disabled={busy}>Save Changes</button>
        </div>
      </form>
    </Modal>
  )
}

function EditProgramModal({ item, onClose, onDone, api, toast }: { item: Dict; onClose: () => void; onDone: () => void; api: ApiFn; toast: ToastFn }) {
  const [busy, setBusy] = useState(false)
  const [impactWarning, setImpactWarning] = useState<string | null>(null)

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true); setImpactWarning(null)
    const fd = Object.fromEntries(new FormData(e.currentTarget).entries())
    const payload = {
      name: fd.name,
      description: fd.description || null,
      ageMinMonths: fd.ageMinMonths ? Number(fd.ageMinMonths) : null,
      ageMaxMonths: fd.ageMaxMonths ? Number(fd.ageMaxMonths) : null,
      capacity: Number(fd.capacity || 20),
      isActive: fd.isActive === 'on',
    }

    const j = await api('/api/v1/programs/' + item.id, 'PATCH', payload)
    setBusy(false)
    if (j.success) {
      toast.success('Program updated', String(j.data.name))
      onClose(); onDone()
    } else {
      if (j.error?.code === 'SETUP_004') {
        setImpactWarning(j.error.message)
      }
      toast.error('Update failed', j.error?.message)
    }
  }

  return (
    <Modal open onClose={onClose} title={'Edit Program — ' + item.name} icon={<Blocks size={22} />} iconClass="ic-violet">
      <form onSubmit={submit}>
        {impactWarning && (
          <div style={{ padding: '8px 12px', background: 'var(--danger-subtle)', border: '1px solid var(--danger)', borderRadius: 8, marginBottom: 12, fontSize: 13, color: 'var(--danger)' }}>
            <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
            {impactWarning}
          </div>
        )}
        <div className="form-grid">
          <div className="field"><label>Program Name <span className="req">*</span></label><input className="input" name="name" defaultValue={String(item.name || '')} required /></div>
          <div className="field"><label>Code</label><input className="input" value={String(item.code || '')} disabled title="Program code is permanent" /></div>
          <div className="field"><label>Seat Capacity <span className="req">*</span></label><input className="input" name="capacity" type="number" defaultValue={Number(item.capacity || 20)} min="1" required /></div>
          <div className="field"><label>Min Age (months)</label><input className="input" name="ageMinMonths" type="number" defaultValue={item.ageMinMonths != null ? Number(item.ageMinMonths) : ''} placeholder="e.g. 24" /></div>
          <div className="field"><label>Max Age (months)</label><input className="input" name="ageMaxMonths" type="number" defaultValue={item.ageMaxMonths != null ? Number(item.ageMaxMonths) : ''} placeholder="e.g. 36" /></div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Description</label><input className="input" name="description" defaultValue={String(item.description || '')} placeholder="e.g. Sensory discovery & play-based early foundation" /></div>
          <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" name="isActive" defaultChecked={item.isActive !== false} />
              <span>Accepting New Admissions (Active)</span>
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className={'btn btn-primary ' + (busy ? 'is-loading' : '')} disabled={busy}>Save Changes</button>
        </div>
      </form>
    </Modal>
  )
}

function EditYearModal({ item, onClose, onDone, api, toast }: { item: Dict; onClose: () => void; onDone: () => void; api: ApiFn; toast: ToastFn }) {
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true)
    const fd = Object.fromEntries(new FormData(e.currentTarget).entries())
    const payload: Record<string, unknown> = {
      name: fd.name,
      startDate: fd.startDate,
      endDate: fd.endDate,
    }
    if (fd.setStatusCurrent === 'on') payload.setStatusCurrent = true

    const j = await api('/api/v1/academic-years/' + item.id, 'PATCH', payload)
    setBusy(false)
    if (j.success) {
      toast.success('Academic year updated', String(item.name))
      onClose(); onDone()
    } else {
      toast.error('Update failed', j.error?.message)
    }
  }

  const sDate = item.startDate ? new Date(String(item.startDate)).toISOString().split('T')[0] : ''
  const eDate = item.endDate ? new Date(String(item.endDate)).toISOString().split('T')[0] : ''

  return (
    <Modal open onClose={onClose} title={'Edit Academic Year — ' + item.name} icon={<CalendarPlus size={22} />} iconClass="ic-green">
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label>Year Name <span className="req">*</span></label><input className="input" name="name" defaultValue={String(item.name || '')} required /></div>
          <div className="field"><label>Start Date <span className="req">*</span></label><input className="input" name="startDate" type="date" defaultValue={sDate} required /></div>
          <div className="field"><label>End Date <span className="req">*</span></label><input className="input" name="endDate" type="date" defaultValue={eDate} required /></div>
          <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" name="setStatusCurrent" defaultChecked={item.isCurrent === true} />
              <span>Current Operating Year</span>
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className={'btn btn-primary ' + (busy ? 'is-loading' : '')} disabled={busy}>Save Changes</button>
        </div>
      </form>
    </Modal>
  )
}

function EditClassModal({ item, onClose, onDone, api, toast }: { item: Dict; onClose: () => void; onDone: () => void; api: ApiFn; toast: ToastFn }) {
  const [busy, setBusy] = useState(false)
  const [members, setMembers] = useState<Dict[]>([])
  const [programs, setPrograms] = useState<Dict[]>([])
  const [facilities, setFacilities] = useState<Dict[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/users').then((r) => r.json()),
      fetch('/api/v1/programs').then((r) => r.json()),
      fetch('/api/v1/facilities').then((r) => r.json()),
    ]).then(([u, p, f]) => {
      if (u.success) setMembers(u.data)
      if (p.success) setPrograms(p.data)
      if (f.success) setFacilities(f.data)
    })
  }, [])

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true); setErr(null)
    const fd = Object.fromEntries(new FormData(e.currentTarget).entries())
    const payload = {
      name: fd.name,
      capacity: Number(fd.capacity || 20),
      programId: fd.programId || null,
      primaryTeacherId: fd.primaryTeacherId || null,
      facilityId: fd.facilityId || null,
    }

    const j = await api('/api/v1/classrooms/' + item.id, 'PATCH', payload)
    setBusy(false)
    if (j.success) {
      toast.success('Classroom updated', String(item.name))
      onClose(); onDone()
    } else {
      setErr(j.error?.message || 'Update failed')
      toast.error('Update failed', j.error?.message)
    }
  }

  return (
    <Modal open onClose={onClose} title={'Edit Classroom / Section — ' + item.name} icon={<LayoutGrid size={22} />} iconClass="ic-blue">
      <form onSubmit={submit}>
        {err && (
          <div style={{ padding: '8px 12px', background: 'var(--danger-subtle)', border: '1px solid var(--danger)', borderRadius: 8, marginBottom: 12, fontSize: 13, color: 'var(--danger)' }}>
            <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
            {err}
          </div>
        )}
        <div className="form-grid">
          <div className="field"><label>Class / Section Name <span className="req">*</span></label><input className="input" name="name" defaultValue={String(item.name || '')} required /></div>
          <div className="field"><label>Code</label><input className="input" value={String(item.code || '')} disabled title="Classroom code is permanent" /></div>
          <div className="field"><label>Program Offering <span className="req">*</span></label>
            <select className="select" name="programId" defaultValue={String(item.programId || '')}>
              <option value="">Select program…</option>
              {programs.map((p: any) => <option key={String(p.id)} value={String(p.id)}>{p.name} ({String(p.programType)})</option>)}
            </select>
          </div>
          <div className="field"><label>Seat Capacity (max students) <span className="req">*</span></label>
            <input className="input" name="capacity" type="number" defaultValue={Number(item.capacity || 20)} min="1" required />
            <div className="helper">Currently enrolled: {String(item.students ?? 0)} children</div>
          </div>
          <div className="field"><label>Primary Lead Teacher</label>
            <select className="select" name="primaryTeacherId" defaultValue={String(item.primaryTeacherId || '')}>
              <option value="">— unassigned —</option>
              {members.map((u: any) => <option key={String(u.userId)} value={String(u.userId)}>{u.name} ({String(u.role).replaceAll('_', ' ')})</option>)}
            </select>
          </div>
          <div className="field"><label>Physical Room / Facility</label>
            <select className="select" name="facilityId" defaultValue={String(item.facilityId || '')}>
              <option value="">— default room —</option>
              {facilities.map((f: any) => <option key={String(f.id)} value={String(f.id)}>{f.name} ({f.code})</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className={'btn btn-primary ' + (busy ? 'is-loading' : '')} disabled={busy}>Save Changes</button>
        </div>
      </form>
    </Modal>
  )
}

function ClassroomModal({ onClose, onDone, api, toast }: { onClose: () => void; onDone: () => void; api: ApiFn; toast: ToastFn }) {
  const [busy, setBusy] = useState(false)
  const [branches, setBranches] = useState<Dict[]>([])
  const [programs, setPrograms] = useState<Dict[]>([])
  const [members, setMembers] = useState<Dict[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/branches').then((r) => r.json()),
      fetch('/api/v1/programs').then((r) => r.json()),
      fetch('/api/v1/users').then((r) => r.json()),
    ]).then(([b, p, u]) => {
      if (b.success) setBranches(b.data)
      if (p.success) setPrograms(p.data)
      if (u.success) setMembers(u.data)
    })
  }, [])

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true)
    const fd = Object.fromEntries(new FormData(e.currentTarget).entries())
    const selectedProgram = programs.find((p: any) => p.id === fd.programId)
    const payload = {
      name: fd.name,
      programType: selectedProgram ? selectedProgram.programType : 'PLAYGROUP',
      programId: fd.programId || null,
      capacity: Number(fd.capacity || 20),
      branchId: fd.branchId || null,
      primaryTeacherId: fd.primaryTeacherId || null,
    }

    const j = await api('/api/v1/classrooms', 'POST', payload)
    setBusy(false)
    if (j.success) {
      toast.success('Classroom created', String(fd.name))
      onClose(); onDone()
    } else {
      toast.error('Failed to create classroom', j.error?.message)
    }
  }

  return (
    <Modal open onClose={onClose} title="Add Classroom / Section" icon={<LayoutGrid size={22} />} iconClass="ic-blue">
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label>Class Name <span className="req">*</span></label><input className="input" name="name" required placeholder="Nursery - Sunflower" /></div>
          <div className="field"><label>Program <span className="req">*</span></label>
            <select className="select" name="programId" required>
              <option value="">Select program…</option>
              {programs.map((p: any) => <option key={String(p.id)} value={String(p.id)}>{p.name} ({String(p.programType)})</option>)}
            </select>
          </div>
          <div className="field"><label>Campus Branch <span className="req">*</span></label>
            <select className="select" name="branchId" required>
              {branches.map((b: any) => <option key={String(b.id)} value={String(b.id)}>{b.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Seat Capacity <span className="req">*</span></label><input className="input" name="capacity" type="number" defaultValue={20} min="1" required /></div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Primary Teacher</label>
            <select className="select" name="primaryTeacherId">
              <option value="">— assign later —</option>
              {members.map((u: any) => <option key={String(u.userId)} value={String(u.userId)}>{u.name} ({String(u.role).replaceAll('_', ' ')})</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className={'btn btn-primary ' + (busy ? 'is-loading' : '')} disabled={busy}>Create Classroom</button>
        </div>
      </form>
    </Modal>
  )
}

function EditFacilityModal({ item, onClose, onDone, api, toast }: { item: Dict; onClose: () => void; onDone: () => void; api: ApiFn; toast: ToastFn }) {
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true)
    const fd = Object.fromEntries(new FormData(e.currentTarget).entries())
    const payload = {
      name: fd.name,
      type: fd.type,
      capacity: fd.capacity ? Number(fd.capacity) : null,
      floorOrArea: fd.floorOrArea || null,
      ageSuitability: fd.ageSuitability || null,
    }
    const j = await api('/api/v1/facilities/' + item.id, 'PATCH', payload)
    setBusy(false)
    if (j.success) {
      toast.success('Facility updated', String(item.name))
      onClose(); onDone()
    } else {
      toast.error('Update failed', j.error?.message)
    }
  }

  return (
    <Modal open onClose={onClose} title={'Edit Facility — ' + item.name} icon={<DoorOpen size={22} />} iconClass="ic-orange">
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label>Name <span className="req">*</span></label><input className="input" name="name" defaultValue={String(item.name || '')} required /></div>
          <div className="field"><label>Type <span className="req">*</span></label>
            <select className="select" name="type" defaultValue={String(item.type || 'CLASSROOM')} required>
              {['CLASSROOM', 'ACTIVITY_AREA', 'PLAY_AREA', 'NAP_AREA', 'MEAL_AREA', 'WASHROOM', 'MEDICAL', 'OTHER'].map((t) => <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>)}
            </select>
          </div>
          <div className="field"><label>Code</label><input className="input" value={String(item.code || '')} disabled title="Code cannot be modified" /></div>
          <div className="field"><label>Capacity</label><input className="input" name="capacity" type="number" defaultValue={item.capacity != null ? Number(item.capacity) : ''} /></div>
          <div className="field"><label>Floor / Area</label><input className="input" name="floorOrArea" defaultValue={String(item.floorOrArea || '')} /></div>
          <div className="field"><label>Age Suitability</label><input className="input" name="ageSuitability" defaultValue={String(item.ageSuitability || '')} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className={'btn btn-primary ' + (busy ? 'is-loading' : '')} disabled={busy}>Save Changes</button>
        </div>
      </form>
    </Modal>
  )
}

function EditStaffModal({ item, onClose, onDone, api, toast }: { item: Dict; onClose: () => void; onDone: () => void; api: ApiFn; toast: ToastFn }) {
  const [busy, setBusy] = useState(false)
  const [branches, setBranches] = useState<Dict[]>([])

  useEffect(() => {
    fetch('/api/v1/branches').then((r) => r.json()).then((j) => { if (j.success) setBranches(j.data) })
  }, [])

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true)
    const fd = Object.fromEntries(new FormData(e.currentTarget).entries())
    const payload = {
      id: item.id,
      branchId: fd.branchId || null,
      membershipRole: fd.role,
      designation: fd.designation || null,
      qualification: fd.qualification || null,
      employmentType: fd.employmentType || 'REGULAR',
      emergencyContactName: fd.emergencyContactName || null,
      emergencyContactPhone: fd.emergencyContactPhone || null,
    }
    const j = await api('/api/v1/staff', 'PATCH', payload)
    setBusy(false)
    if (j.success) {
      toast.success('Staff profile updated', String(item.name))
      onClose(); onDone()
    } else {
      toast.error('Update failed', j.error?.message)
    }
  }

  return (
    <Modal open onClose={onClose} title={'Edit Staff — ' + item.name} icon={<Users size={22} />} iconClass="ic-purple" wide>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label>Staff Member</label><input className="input" value={String(item.name || '')} disabled /></div>
          <div className="field"><label>Email</label><input className="input" value={String(item.email || '')} disabled /></div>
          <div className="field"><label>Employee Code</label><input className="input" value={String(item.employeeCode || '')} disabled /></div>
          <div className="field"><label>Operating Role <span className="req">*</span></label>
            <select className="select" name="role" defaultValue={String(item.role || 'TEACHER')}>
              {CANONICAL_SETUP_STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_META[r]?.label ? `${r} — ${ROLE_META[r].label}` : r}
                </option>
              ))}
            </select>
          </div>
          <div className="field"><label>Branch Assignment</label>
            <select className="select" name="branchId" defaultValue={String(item.branchId || '')}>
              <option value="">— unassigned —</option>
              {branches.map((b: any) => <option key={String(b.id)} value={String(b.id)}>{b.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Designation</label><input className="input" name="designation" defaultValue={String(item.designation || '')} /></div>
          <div className="field"><label>Qualification</label><input className="input" name="qualification" defaultValue={String(item.qualification || '')} /></div>
          <div className="field"><label>Employment Type</label>
            <select className="select" name="employmentType" defaultValue={String(item.employmentType || 'REGULAR')}>
              {['REGULAR', 'PART_TIME', 'CONTRACT', 'INTERN'].map((t) => <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>)}
            </select>
          </div>
          <div className="field"><label>Emergency Contact Person</label><input className="input" name="emergencyContactName" defaultValue={String(item.emergencyContactName || '')} /></div>
          <div className="field"><label>Emergency Phone</label><input className="input" name="emergencyContactPhone" defaultValue={String(item.emergencyContactPhone || '')} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className={'btn btn-primary ' + (busy ? 'is-loading' : '')} disabled={busy}>Save Changes</button>
        </div>
      </form>
    </Modal>
  )
}

function SubjectModal({ onClose, onDone, api, toast }: { onClose: () => void; onDone: () => void; api: ApiFn; toast: ToastFn }) {
  const [busy, setBusy] = useState(false)
  const [programs, setPrograms] = useState<Dict[]>([])
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/v1/programs').then((r) => r.json()).then((j) => {
      if (j.success && Array.isArray(j.data)) setPrograms(j.data)
    })
  }, [])

  const toggleProgram = (id: string) => {
    setSelectedPrograms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true)
    const fd = Object.fromEntries(new FormData(e.currentTarget).entries())
    const payload = {
      name: fd.name,
      code: fd.code,
      shortName: fd.shortName || undefined,
      description: fd.description || undefined,
      subjectType: fd.subjectType || 'CORE',
      programIds: selectedPrograms,
    }
    const j = await api('/api/v1/subjects', 'POST', payload)
    setBusy(false)
    if (j.success) {
      toast.success('Subject created', String(j.data?.name ?? ''))
      onClose(); onDone()
    } else {
      toast.error('Failed to create subject', j.error?.message)
    }
  }

  return (
    <Modal open onClose={onClose} title="Add Subject / Learning Area" icon={<BookOpen size={22} />} iconClass="ic-blue">
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label>Subject Name <span className="req">*</span></label><input className="input" name="name" required placeholder="Early Literacy & Phonics" /></div>
          <div className="field"><label>Subject Code <span className="req">*</span></label><input className="input" name="code" required placeholder="LIT" /></div>
          <div className="field"><label>Short Name</label><input className="input" name="shortName" placeholder="Literacy" /></div>
          <div className="field"><label>Subject Type <span className="req">*</span></label>
            <select className="select" name="subjectType" defaultValue="CORE" required>
              <option value="CORE">CORE — Core Learning Area</option>
              <option value="OPTIONAL">OPTIONAL — Optional / Elective</option>
              <option value="ACTIVITY">ACTIVITY — Co-curricular / Activity</option>
            </select>
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Description</label><input className="input" name="description" placeholder="Foundational language and reading development" /></div>

          {programs.length > 0 && (
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Assign to Programs</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
                {programs.map((p: any) => (
                  <label key={String(p.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', background: 'var(--surface-muted)', padding: '4px 8px', borderRadius: 6 }}>
                    <input
                      type="checkbox"
                      checked={selectedPrograms.includes(String(p.id))}
                      onChange={() => toggleProgram(String(p.id))}
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>Create Subject</button>
        </div>
      </form>
    </Modal>
  )
}

function EditSubjectModal({ item, onClose, onDone, api, toast }: { item: Dict; onClose: () => void; onDone: () => void; api: ApiFn; toast: ToastFn }) {
  const [busy, setBusy] = useState(false)
  const [programs, setPrograms] = useState<Dict[]>([])
  const initialProgramIds = useMemo(() => {
    if (Array.isArray(item.programSubjects)) {
      return item.programSubjects.map((ps: any) => String(ps.programId))
    }
    return []
  }, [item])
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>(initialProgramIds)

  useEffect(() => {
    fetch('/api/v1/programs').then((r) => r.json()).then((j) => {
      if (j.success && Array.isArray(j.data)) setPrograms(j.data)
    })
  }, [])

  const toggleProgram = (id: string) => {
    setSelectedPrograms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true)
    const fd = Object.fromEntries(new FormData(e.currentTarget).entries())
    const payload = {
      name: fd.name,
      shortName: fd.shortName || undefined,
      description: fd.description || undefined,
      subjectType: fd.subjectType || 'CORE',
      status: fd.status || 'ACTIVE',
      programIds: selectedPrograms,
    }
    const j = await api(`/api/v1/subjects/${item.id}`, 'PATCH', payload)
    setBusy(false)
    if (j.success) {
      toast.success('Subject updated', String(item.name))
      onClose(); onDone()
    } else {
      toast.error('Failed to update subject', j.error?.message)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Edit Subject — ${item.name}`} icon={<BookOpen size={22} />} iconClass="ic-blue">
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label>Subject Name <span className="req">*</span></label><input className="input" name="name" defaultValue={String(item.name || '')} required /></div>
          <div className="field"><label>Subject Code</label><input className="input" value={String(item.code || '')} disabled /></div>
          <div className="field"><label>Short Name</label><input className="input" name="shortName" defaultValue={String(item.shortName || '')} /></div>
          <div className="field"><label>Subject Type <span className="req">*</span></label>
            <select className="select" name="subjectType" defaultValue={String(item.type || 'CORE')} required>
              <option value="CORE">CORE — Core Learning Area</option>
              <option value="OPTIONAL">OPTIONAL — Optional / Elective</option>
              <option value="ACTIVITY">ACTIVITY — Co-curricular / Activity</option>
            </select>
          </div>
          <div className="field"><label>Status</label>
            <select className="select" name="status" defaultValue={item.active ? 'ACTIVE' : 'INACTIVE'}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Description</label><input className="input" name="description" defaultValue={String(item.description || '')} /></div>

          {programs.length > 0 && (
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Assign to Programs</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
                {programs.map((p: any) => (
                  <label key={String(p.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', background: 'var(--surface-muted)', padding: '4px 8px', borderRadius: 6 }}>
                    <input
                      type="checkbox"
                      checked={selectedPrograms.includes(String(p.id))}
                      onChange={() => toggleProgram(String(p.id))}
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>Save Changes</button>
        </div>
      </form>
    </Modal>
  )
}

