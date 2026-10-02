'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Breadcrumbs } from '@/components/preone/Breadcrumbs'
import { PageHead, KpiTile, StatusBadge } from '@/components/preone/ui'
import { TactileButton } from '@/components/preone/TactileMotion'
import { Modal } from '@/components/preone/Modal'
import { EmptyState } from '@/components/preone'
import { apiFetch, parseApiError } from '@/lib/client-api'
import { can } from '@/lib/auth'
import { Stethoscope, Plus, HeartPulse, AlertTriangle, Thermometer, ShieldCheck, Activity } from 'lucide-react'

interface HealthRecordRow {
  id: string
  type: string
  recordDate: string
  summary: string
  details: string | null
  doctorName: string | null
  followUpDate: string | null
  isChronic: boolean
  student: { id: string; admissionNo: string; firstName: string; lastName: string }
}
interface SickBayRow {
  id: string
  visitDate: string
  symptoms: string
  temperatureC: number | null
  actionTaken: string
  medicationGiven: string | null
  parentNotified: boolean
  returnedToClassAt: string | null
  student: { id: string; admissionNo: string; firstName: string; lastName: string }
}
interface AlertRow {
  id: string
  studentId: string
  studentName: string
  admissionNo: string
  className: string | null
  type: string
  summary: string
  details: string | null
}
interface StudentOption { id: string; firstName: string; lastName: string; admissionNo: string }

const TYPE_VARIANTS: Record<string, string> = {
  CHECKUP: 'info', VACCINATION: 'success', ALLERGY: 'warning',
  MEDICAL_CONDITION: 'danger', INJURY: 'warning', DENTAL: 'neutral', VISION: 'neutral',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function HealthClient({ session }: { session: any }) {
  const [tab, setTab] = useState<'records' | 'sickbay' | 'alerts'>('records')
  const [records, setRecords] = useState<HealthRecordRow[]>([])
  const [visits, setVisits] = useState<SickBayRow[]>([])
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [stats, setStats] = useState<any>(null)
  const [students, setStudents] = useState<StudentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const [showRecord, setShowRecord] = useState(false)
  const [recordForm, setRecordForm] = useState({ studentId: '', type: 'CHECKUP', summary: '', details: '', doctorName: '', isChronic: false })
  const [showVisit, setShowVisit] = useState(false)
  const [visitForm, setVisitForm] = useState({ studentId: '', symptoms: '', temperatureC: '', actionTaken: '', medicationGiven: '', parentNotified: true })
  const [saving, setSaving] = useState(false)

  const canWrite = can((session?.roles as any)?.length ? session.roles : [session?.role], 'health:write')

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [recs, vis, alr, st] = await Promise.all([
        apiFetch<any[]>('/api/v1/health'),
        apiFetch<any[]>('/api/v1/health?sickBay=1'),
        apiFetch<any[]>('/api/v1/health?alerts=1'),
        apiFetch<any>('/api/v1/health?stats=1'),
      ])
      setRecords(Array.isArray(recs?.data) ? recs.data : [])
      setVisits(Array.isArray(vis?.data) ? vis.data : [])
      setAlerts(Array.isArray(alr?.data) ? alr.data : [])
      setStats(st?.data ?? null)
      setError('')
    } catch (err) {
      setError(parseApiError(err).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    apiFetch<any>('/api/v1/students?pageSize=500')
      .then((r) => setStudents(((Array.isArray(r?.data) ? r.data : (r?.data?.items ?? []))) .map((s: any) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, admissionNo: s.admissionNo }))))
      .catch(() => {})
  }, [load])

  const saveRecord = async () => {
    if (!recordForm.studentId || !recordForm.summary.trim()) {
      setError('Student and summary are required')
      setSaving(false)
      return
    }
    setSaving(true)
    try {
      await apiFetch('/api/v1/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordForm),
      })
      setShowRecord(false)
      setRecordForm({ studentId: '', type: 'CHECKUP', summary: '', details: '', doctorName: '', isChronic: false })
      flash('Health record added')
      await load()
    } catch (err) {
      setError(parseApiError(err).message)
    } finally {
      setSaving(false)
    }
  }

  const saveVisit = async () => {
    if (!visitForm.studentId || !visitForm.symptoms.trim() || !visitForm.actionTaken.trim()) {
      setError('Student, symptoms and action taken are required')
      setSaving(false)
      return
    }
    setSaving(true)
    try {
      await apiFetch('/api/v1/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'sick-bay',
          ...visitForm,
          temperatureC: visitForm.temperatureC ? Number(visitForm.temperatureC) : undefined,
        }),
      })
      setShowVisit(false)
      setVisitForm({ studentId: '', symptoms: '', temperatureC: '', actionTaken: '', medicationGiven: '', parentNotified: true })
      flash('Sick bay visit logged')
      await load()
    } catch (err) {
      setError(parseApiError(err).message)
    } finally {
      setSaving(false)
    }
  }

  const returnToClass = async (id: string) => {
    try {
      await apiFetch(`/api/v1/health/sick-bay/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'return-to-class' }),
      })
      flash('Student returned to class')
      await load()
    } catch (err) {
      setError(parseApiError(err).message)
    }
  }

  const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'
  const labelCls = 'text-xs font-semibold text-muted-foreground uppercase tracking-wide'
  const tabs = [
    { key: 'records', label: 'Health Records' },
    { key: 'sickbay', label: 'Sick Bay' },
    { key: 'alerts', label: `Medical Alerts${alerts.length ? ` (${alerts.length})` : ''}` },
  ] as const

  return (
    <div className="p-4 md:p-6 space-y-5">
      <Breadcrumbs items={[{ label: 'Home', href: '/app/home' }, { label: 'Health & Medical' }]} />
      <PageHead
        eyebrow="Student Wellbeing"
        title="Health & Medical"
        description="Health records, sick-bay visits and campus-wide medical alerts"
        actions={canWrite ? (
          <div className="flex gap-2">
            <TactileButton variant="secondary" onClick={() => setShowVisit(true)}><Plus size={16} /> Sick Bay Entry</TactileButton>
            <TactileButton onClick={() => setShowRecord(true)}><Plus size={16} /> Health Record</TactileButton>
          </div>
        ) : undefined}
      />

      {error && <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">{error}</div>}
      {toast && <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{toast}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Health Records" value={stats?.records ?? '—'} icon={<Stethoscope size={18} />} iconClass="g-green" />
        <KpiTile label="Chronic / Allergy" value={stats?.chronic ?? '—'} icon={<AlertTriangle size={18} />} iconClass="g-red" />
        <KpiTile label="Sick Bay Today" value={stats?.visitsToday ?? '—'} icon={<Thermometer size={18} />} iconClass="g-orange" />
        <KpiTile label="In Sick Bay Now" value={stats?.pendingReturn ?? '—'} icon={<HeartPulse size={18} />} iconClass="g-rose" />
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-card p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${tab === t.key ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : tab === 'records' ? (
          records.length === 0 ? (
            <EmptyState icon={<Stethoscope size={40} />} title="No health records" description="Add checkups, vaccinations and medical history for students" />
          ) : (
            <div className="max-h-[32rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Student</th>
                    <th className="px-4 py-3 text-left font-semibold">Type</th>
                    <th className="px-4 py-3 text-left font-semibold">Summary</th>
                    <th className="px-4 py-3 text-left font-semibold">Doctor</th>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.student.firstName} {r.student.lastName}</div>
                        <div className="text-xs text-muted-foreground">{r.student.admissionNo}</div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge label={r.type.replace('_', ' ')} variant={(TYPE_VARIANTS[r.type] ?? 'neutral') as any} /></td>
                      <td className="px-4 py-3 max-w-[18rem]"><div className="truncate" title={r.details ?? r.summary}>{r.summary}</div></td>
                      <td className="px-4 py-3">{r.doctorName ?? '—'}</td>
                      <td className="px-4 py-3">{fmtDate(r.recordDate)}</td>
                      <td className="px-4 py-3">{r.isChronic ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600"><AlertTriangle size={12} /> Chronic</span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tab === 'sickbay' ? (
          visits.length === 0 ? (
            <EmptyState icon={<Thermometer size={40} />} title="No sick-bay visits" description="Log sick-bay visits when students feel unwell at school" />
          ) : (
            <div className="max-h-[32rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Student</th>
                    <th className="px-4 py-3 text-left font-semibold">Symptoms</th>
                    <th className="px-4 py-3 text-left font-semibold">Temp</th>
                    <th className="px-4 py-3 text-left font-semibold">Action</th>
                    <th className="px-4 py-3 text-left font-semibold">Parent</th>
                    <th className="px-4 py-3 text-right font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => (
                    <tr key={v.id} className="border-t border-border hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <div className="font-medium">{v.student.firstName} {v.student.lastName}</div>
                        <div className="text-xs text-muted-foreground">{fmtDate(v.visitDate)}</div>
                      </td>
                      <td className="px-4 py-3 max-w-[14rem]"><div className="truncate">{v.symptoms}</div></td>
                      <td className="px-4 py-3 tabular-nums">{v.temperatureC ? `${v.temperatureC}°C` : '—'}</td>
                      <td className="px-4 py-3 max-w-[14rem]"><div className="truncate">{v.actionTaken}{v.medicationGiven ? ` · ${v.medicationGiven}` : ''}</div></td>
                      <td className="px-4 py-3">{v.parentNotified ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium"><ShieldCheck size={12} /> Notified</span> : <span className="text-xs text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3 text-right">
                        {v.returnedToClassAt ? (
                          <StatusBadge label="RETURNED" variant="success" />
                        ) : canWrite ? (
                          <button className="text-xs font-medium text-primary hover:underline" onClick={() => returnToClass(v.id)}>Return to class</button>
                        ) : (
                          <StatusBadge label="IN SICK BAY" variant="warning" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : alerts.length === 0 ? (
          <EmptyState icon={<ShieldCheck size={40} />} title="No medical alerts" description="Chronic conditions and allergies will appear here for quick staff awareness" />
        ) : (
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {alerts.map((a) => (
              <div key={a.id} className="rounded-lg border border-amber-300 bg-amber-50/60 p-4 dark:border-amber-800 dark:bg-amber-950/40">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-sm">{a.studentName} <span className="font-normal text-muted-foreground">· {a.className ?? a.admissionNo}</span></div>
                  <StatusBadge label={a.type.replace('_', ' ')} variant={(a.type === 'ALLERGY' ? 'warning' : 'danger') as any} />
                </div>
                <div className="mt-2 text-sm">{a.summary}</div>
                {a.details && <div className="mt-1 text-xs text-muted-foreground">{a.details}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Health record modal */}
      <Modal open={showRecord} onClose={() => setShowRecord(false)} title="Add Health Record" width="max-w-lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Student *</label>
              <select className={`${inputCls} mt-1`} value={recordForm.studentId} onChange={(e) => setRecordForm({ ...recordForm, studentId: e.target.value })}>
                <option value="">Select student</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNo})</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select className={`${inputCls} mt-1`} value={recordForm.type} onChange={(e) => setRecordForm({ ...recordForm, type: e.target.value })}>
                {['CHECKUP', 'VACCINATION', 'ALLERGY', 'MEDICAL_CONDITION', 'INJURY', 'DENTAL', 'VISION'].map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Summary *</label>
            <input className={`${inputCls} mt-1`} value={recordForm.summary} onChange={(e) => setRecordForm({ ...recordForm, summary: e.target.value })} placeholder="Annual health checkup — normal" />
          </div>
          <div>
            <label className={labelCls}>Details</label>
            <textarea className={`${inputCls} mt-1 min-h-[4rem]`} value={recordForm.details} onChange={(e) => setRecordForm({ ...recordForm, details: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Doctor</label>
              <input className={`${inputCls} mt-1`} value={recordForm.doctorName} onChange={(e) => setRecordForm({ ...recordForm, doctorName: e.target.value })} />
            </div>
            <label className="mt-6 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={recordForm.isChronic} onChange={(e) => setRecordForm({ ...recordForm, isChronic: e.target.checked })} />
              Mark as chronic condition
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <TactileButton variant="ghost" onClick={() => setShowRecord(false)}>Cancel</TactileButton>
            <TactileButton onClick={saveRecord} disabled={saving}>{saving ? 'Saving…' : 'Save Record'}</TactileButton>
          </div>
        </div>
      </Modal>

      {/* Sick bay modal */}
      <Modal open={showVisit} onClose={() => setShowVisit(false)} title="Sick Bay Entry" width="max-w-lg">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Student *</label>
            <select className={`${inputCls} mt-1`} value={visitForm.studentId} onChange={(e) => setVisitForm({ ...visitForm, studentId: e.target.value })}>
              <option value="">Select student</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNo})</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Symptoms *</label>
            <input className={`${inputCls} mt-1`} value={visitForm.symptoms} onChange={(e) => setVisitForm({ ...visitForm, symptoms: e.target.value })} placeholder="Headache, mild fever" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Temperature (°C)</label>
              <input type="number" step="0.1" className={`${inputCls} mt-1`} value={visitForm.temperatureC} onChange={(e) => setVisitForm({ ...visitForm, temperatureC: e.target.value })} placeholder="98.6" />
            </div>
            <div>
              <label className={labelCls}>Medication given</label>
              <input className={`${inputCls} mt-1`} value={visitForm.medicationGiven} onChange={(e) => setVisitForm({ ...visitForm, medicationGiven: e.target.value })} placeholder="Paracetamol (with consent)" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Action taken *</label>
            <input className={`${inputCls} mt-1`} value={visitForm.actionTaken} onChange={(e) => setVisitForm({ ...visitForm, actionTaken: e.target.value })} placeholder="Rest for 30 min, monitored" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={visitForm.parentNotified} onChange={(e) => setVisitForm({ ...visitForm, parentNotified: e.target.checked })} />
            <Activity size={14} /> Parent notified
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <TactileButton variant="ghost" onClick={() => setShowVisit(false)}>Cancel</TactileButton>
            <TactileButton onClick={saveVisit} disabled={saving}>{saving ? 'Saving…' : 'Log Visit'}</TactileButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
