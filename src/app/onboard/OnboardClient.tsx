'use client'

import React, { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, MapPin, School, GraduationCap, UserPlus, Rocket, ArrowRight, ArrowLeft,
  CheckCircle2, Power, LogOut, ExternalLink, Clock3,
} from 'lucide-react'
import { PLogoWordmark } from '@/components/preone/PLogo'
import { Avatar, Segmented } from '@/components/preone/ui'
import { useToast } from '@/components/preone/Toast'
import { fmtDate, enumLabel } from '@/lib/format'

interface TenantRow {
  id: string
  name: string
  code: string
  city: string | null
  status: string
  plan: string
  students: number
  branches: number
  onboardedAt: string | null
  createdAt: string
}

const STEPS = ['School', 'Branch', 'Programs', 'Owner', 'Review']
const PROGRAMS = ['PLAYGROUP', 'NURSERY', 'LKG', 'UKG', 'DAYCARE']

export function OnboardClient({
  user,
  tenants: initial,
}: {
  user: { name: string; email: string }
  tenants: TenantRow[]
}) {
  const toast = useToast()
  const router = useRouter()
  const [tenants, setTenants] = useState(initial)
  const [wizard, setWizard] = useState(false)
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    name: '', code: '', city: '', state: '', pincode: '', phone: '', email: '', address: '',
    branchName: 'Main Campus',
    programs: ['PLAYGROUP', 'NURSERY', 'LKG', 'UKG'],
    sessionName: '2026-27',
    ownerName: '', ownerEmail: '', ownerPassword: 'Welcome@123',
    plan: 'PRO',
  })

  const set = (k: string, v: string | string[]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = useCallback(async () => {
    setBusy(true)
    const res = await fetch('/api/v1/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    setBusy(false)
    if (json.success) {
      toast.success(`${form.name} onboarded!`, 'Owner can sign in immediately')
      setWizard(false)
      setStep(0)
      setForm((f) => ({ ...f, name: '', code: '', city: '', state: '', pincode: '', phone: '', email: '', address: '', ownerName: '', ownerEmail: '' }))
      const fresh = await fetch('/api/v1/tenants').then((r) => r.json())
      if (fresh.success) setTenants(fresh.data)
    } else {
      toast.error('Onboarding failed', json.error?.message)
    }
  }, [form, toast])

  const toggleStatus = async (t: TenantRow) => {
    const next = t.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    const res = await fetch(`/api/v1/tenants/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    const json = await res.json()
    if (json.success) {
      toast.info(`${t.name} ${next === 'ACTIVE' ? 'activated' : 'suspended'}`)
      setTenants((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: next } : x)))
    } else toast.error('Failed', json.error?.message)
  }

  const logout = async () => {
    await fetch('/api/v1/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  const canNext = () => {
    if (step === 0) return form.name && form.code
    if (step === 3) return form.ownerName && form.ownerEmail
    return true
  }

  return (
    <>
      {/* Header */}
      <header className="app-header">
        <div className="h-logo">
          <PLogoWordmark subtitle="Platform Console" />
        </div>
        <div className="h-breadcrumb">
          <span>PreOne SaaS</span>
          <ArrowRight size={12} />
          <b>Client Onboarding</b>
        </div>
        <div className="h-spacer" />
        <button className="h-avatar" onClick={logout}>
          <Avatar name={user.name} size="sm" />
          <span className="who">
            <b>{user.name}</b>
            <span>Platform Admin</span>
          </span>
        </button>
      </header>

      <main className="app-main">
        <div className="app-content">
          <div className="page-head">
            <div>
              <h1 className="t-h1">Platform Console</h1>
              <div className="sub">Naye preschool clients onboard karo — 4 steps, 2 minute.</div>
            </div>
            {!wizard && (
              <button className="btn btn-hero" onClick={() => setWizard(true)}>
                <Rocket size={18} /> Onboard New Client
              </button>
            )}
          </div>

          {!wizard ? (
            <div className="dtable-wrap">
              <div className="table-toolbar">
                <div className="card-title">Client Schools ({tenants.length})</div>
              </div>
              <div className="dtable-scroll">
                <table className="dtable">
                  <thead>
                    <tr><th>School</th><th>Code</th><th>Plan</th><th>Branches</th><th>Students</th><th>Onboarded</th><th>Status</th><th style={{ width: 90 }} /></tr>
                  </thead>
                  <tbody>
                    {tenants.map((t) => (
                      <tr key={t.id} style={{ cursor: 'default' }}>
                        <td>
                          <span className="cell-user">
                            <Avatar name={t.name} />
                            <span>
                              <span className="cell-strong">{t.name}</span>
                              <span className="cell-sub">{t.city || 'India'}</span>
                            </span>
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{t.code}</td>
                        <td><span className="badge b-primary">{enumLabel(t.plan)}</span></td>
                        <td>{t.branches}</td>
                        <td>{t.students}</td>
                        <td>{t.onboardedAt ? fmtDate(t.onboardedAt) : <span className="badge b-warning"><Clock3 size={11} /> Pending</span>}</td>
                        <td>
                          <span className={`badge ${t.status === 'ACTIVE' ? 'b-success b-dot' : 'b-danger'}`}>
                            {enumLabel(t.status)}
                          </span>
                        </td>
                        <td>
                          <button
                            className={`btn btn-sm ${t.status === 'ACTIVE' ? 'btn-outline' : 'btn-success'}`}
                            onClick={() => toggleStatus(t)}
                          >
                            <Power size={13} /> {t.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tenants.length === 0 && (
                  <div className="empty">
                    <div className="empty-art"><Building2 size={40} /></div>
                    <h4>No clients yet</h4>
                    <p>Onboard your first preschool — the wizard sets up everything automatically.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card" style={{ maxWidth: 760, margin: '0 auto' }}>
              {/* Steps */}
              <div className="wiz-steps" style={{ justifyContent: 'center', marginBottom: 24 }}>
                {STEPS.map((s, i) => (
                  <React.Fragment key={s}>
                    {i > 0 && <span className="wiz-arrow" />}
                    <div className={`wstep ${i === step ? 'now' : i < step ? 'done' : ''}`}>
                      <span className="n">{i < step ? '✓' : i + 1}</span>
                      <span>{s}</span>
                    </div>
                  </React.Fragment>
                ))}
              </div>

              {step === 0 && (
                <>
                  <div className="card-head" style={{ justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div className="modal-icon ic-purple" style={{ margin: '0 auto 10px' }}><Building2 size={22} /></div>
                      <h3 style={{ fontSize: 18 }}>School details</h3>
                      <p className="t-body-sm">Ye client tenant banega — code unique hona chahiye.</p>
                    </div>
                  </div>
                  <div className="form-grid" style={{ marginTop: 12 }}>
                    <div className="field"><label>School Name <span className="req">*</span></label>
                      <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Little Stars Preschool" /></div>
                    <div className="field"><label>School Code <span className="req">*</span></label>
                      <input className="input" value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="LITTLE" /></div>
                    <div className="field"><label>City</label><input className="input" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Pune" /></div>
                    <div className="field"><label>State</label><input className="input" value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="Maharashtra" /></div>
                    <div className="field"><label>Phone</label><input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
                    <div className="field"><label>Email</label><input className="input" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <div className="card-head" style={{ justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div className="modal-icon ic-blue" style={{ margin: '0 auto 10px' }}><MapPin size={22} /></div>
                      <h3 style={{ fontSize: 18 }}>Main branch</h3>
                      <p className="t-body-sm">Pehla campus — baad mein aur branches add kar sakte ho (100+ supported).</p>
                    </div>
                  </div>
                  <div className="form-grid" style={{ marginTop: 12 }}>
                    <div className="field"><label>Branch Name <span className="req">*</span></label>
                      <input className="input" value={form.branchName} onChange={(e) => set('branchName', e.target.value)} /></div>
                    <div className="field"><label>Address</label>
                      <input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} /></div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="card-head" style={{ justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div className="modal-icon ic-pink" style={{ margin: '0 auto 10px' }}><GraduationCap size={22} /></div>
                      <h3 style={{ fontSize: 18 }}>Programs & fee plans</h3>
                      <p className="t-body-sm">Har program ke liye classrooms aur starter fee plan auto-create hoga.</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
                    {PROGRAMS.map((p) => {
                      const on = form.programs.includes(p)
                      return (
                        <button
                          key={p}
                          className={`btn ${on ? 'btn-secondary' : 'btn-outline'}`}
                          onClick={() =>
                            set('programs', on ? form.programs.filter((x) => x !== p) : [...form.programs, p])
                          }
                        >
                          {on && <CheckCircle2 size={14} />} {enumLabel(p)}
                        </button>
                      )
                    })}
                  </div>
                  <div className="form-grid" style={{ marginTop: 18, justifyContent: 'center' }}>
                    <div className="field"><label>Academic Session</label>
                      <input className="input" value={form.sessionName} onChange={(e) => set('sessionName', e.target.value)} /></div>
                    <div className="field"><label>Plan</label>
                      <select className="select" value={form.plan} onChange={(e) => set('plan', e.target.value)}>
                        {['STARTER', 'PRO', 'ENTERPRISE'].map((p) => <option key={p} value={p}>{enumLabel(p)}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div className="card-head" style={{ justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div className="modal-icon ic-green" style={{ margin: '0 auto 10px' }}><UserPlus size={22} /></div>
                      <h3 style={{ fontSize: 18 }}>Owner account</h3>
                      <p className="t-body-sm">School owner ka login — full access to their workspace.</p>
                    </div>
                  </div>
                  <div className="form-grid" style={{ marginTop: 12 }}>
                    <div className="field"><label>Owner Name <span className="req">*</span></label>
                      <input className="input" value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} placeholder="Riya Kapoor" /></div>
                    <div className="field"><label>Owner Email <span className="req">*</span></label>
                      <input className="input" type="email" value={form.ownerEmail} onChange={(e) => set('ownerEmail', e.target.value)} placeholder="riya@littlestars.in" /></div>
                    <div className="field"><label>Temp Password</label>
                      <input className="input" value={form.ownerPassword} onChange={(e) => set('ownerPassword', e.target.value)} /></div>
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <div className="card-head" style={{ justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div className="modal-icon ic-cyan" style={{ margin: '0 auto 10px' }}><School size={22} /></div>
                      <h3 style={{ fontSize: 18 }}>Review & launch</h3>
                      <p className="t-body-sm">Sab kuch set hai — launch karte hi tenant active ho jaayega.</p>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                    <div className="stat-mini"><b style={{ fontSize: 14 }}>{form.name || '—'}</b><span>Code: {form.code || '—'} · {form.city}</span></div>
                    <div className="stat-mini"><b style={{ fontSize: 14 }}>{form.branchName}</b><span>Main campus</span></div>
                    <div className="stat-mini"><b style={{ fontSize: 14 }}>{form.programs.length} programs</b><span>{form.programs.map(enumLabel).join(', ')}</span></div>
                    <div className="stat-mini"><b style={{ fontSize: 14 }}>{form.ownerName || '—'}</b><span>{form.ownerEmail} · {enumLabel(form.plan)}</span></div>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 26 }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => (step === 0 ? setWizard(false) : setStep((s) => s - 1))}
                >
                  <ArrowLeft size={15} /> {step === 0 ? 'Cancel' : 'Back'}
                </button>
                {step < 4 ? (
                  <button className="btn btn-primary" disabled={!canNext()} onClick={() => setStep((s) => s + 1)}>
                    Continue <ArrowRight size={15} />
                  </button>
                ) : (
                  <button className={`btn btn-hero ${busy ? 'is-loading' : ''}`} disabled={busy} onClick={submit}>
                    <Rocket size={17} /> Launch Client
                  </button>
                )}
              </div>
            </div>
          )}

          {!wizard && (
            <p className="t-caption" style={{ textAlign: 'center' }}>
              Onboarding wizard: tenant + branch + academic session + classrooms + fee plans + owner account — ek transaction mein (PRD 8.13 · 7-day time-to-value).
            </p>
          )}
        </div>
      </main>
    </>
  )
}
