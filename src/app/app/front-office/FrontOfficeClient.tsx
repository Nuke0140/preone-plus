'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Breadcrumbs } from '@/components/preone/Breadcrumbs'
import { PageHead, KpiTile, StatusBadge } from '@/components/preone/ui'
import { TactileButton } from '@/components/preone/TactileMotion'
import { Modal } from '@/components/preone/Modal'
import { EmptyState } from '@/components/preone'
import { apiFetch, parseApiError } from '@/lib/client-api'
import { can } from '@/lib/auth'
import { DoorOpen, Plus, UserCheck, LogOut, IdCard, ArrowRightLeft, Clock } from 'lucide-react'

interface VisitorRow {
  id: string
  visitorName: string
  visitorPhone: string | null
  organization: string | null
  purpose: string
  personToMeet: string | null
  badgeNumber: string | null
  checkInAt: string
  checkOutAt: string | null
  branch: { id: string; name: string } | null
}
interface GatePassRow {
  id: string
  passNumber: string
  reason: string
  status: string
  guardianName: string | null
  guardianPhone: string | null
  outAt: string | null
  createdAt: string
  student: { id: string; admissionNo: string; firstName: string; lastName: string; currentClassroom: { name: string } | null }
  requestedBy: { id: string; fullName: string } | null
}
interface StudentOption { id: string; firstName: string; lastName: string; admissionNo: string }

const PASS_VARIANTS: Record<string, string> = {
  REQUESTED: 'warning', APPROVED: 'info', REJECTED: 'danger', OUT: 'info', RETURNED: 'success',
}

function fmtTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function FrontOfficeClient({ session }: { session: any }) {
  const [tab, setTab] = useState<'visitors' | 'gate-passes'>('visitors')
  const [visitors, setVisitors] = useState<VisitorRow[]>([])
  const [passes, setPasses] = useState<GatePassRow[]>([])
  const [stats, setStats] = useState<any>(null)
  const [students, setStudents] = useState<StudentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const [showVisitor, setShowVisitor] = useState(false)
  const [visitorForm, setVisitorForm] = useState({ visitorName: '', visitorPhone: '', organization: '', purpose: '', personToMeet: '', badgeNumber: '' })
  const [showPass, setShowPass] = useState(false)
  const [passForm, setPassForm] = useState({ studentId: '', reason: '', guardianName: '', guardianPhone: '' })
  const [saving, setSaving] = useState(false)

  const canWrite = can((session?.roles as any)?.length ? session.roles : [session?.role], 'frontoffice:write')

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [vis, ps, st] = await Promise.all([
        apiFetch<any[]>('/api/v1/front-office/visitors'),
        apiFetch<any[]>('/api/v1/front-office/gate-passes'),
        apiFetch<any>('/api/v1/front-office/visitors?stats=1'),
      ])
      setVisitors(Array.isArray(vis?.data) ? vis.data : [])
      setPasses(Array.isArray(ps?.data) ? ps.data : [])
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
      .then((r) => setStudents(((Array.isArray(r?.data) ? r.data : (r?.data?.items ?? []))).map((s: any) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, admissionNo: s.admissionNo }))))
      .catch(() => {})
  }, [load])

  const checkIn = async () => {
    if (!visitorForm.visitorName.trim() || !visitorForm.purpose.trim()) {
      setError('Visitor name and purpose are required')
      setSaving(false)
      return
    }
    setSaving(true)
    try {
      await apiFetch('/api/v1/front-office/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(visitorForm),
      })
      setShowVisitor(false)
      setVisitorForm({ visitorName: '', visitorPhone: '', organization: '', purpose: '', personToMeet: '', badgeNumber: '' })
      flash('Visitor checked in')
      await load()
    } catch (err) {
      setError(parseApiError(err).message)
    } finally {
      setSaving(false)
    }
  }

  const checkOut = async (id: string) => {
    try {
      await apiFetch('/api/v1/front-office/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-out', id }),
      })
      flash('Visitor checked out')
      await load()
    } catch (err) {
      setError(parseApiError(err).message)
    }
  }

  const createPass = async () => {
    if (!passForm.studentId || !passForm.reason.trim()) {
      setError('Student and reason are required')
      setSaving(false)
      return
    }
    setSaving(true)
    try {
      await apiFetch('/api/v1/front-office/gate-passes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'gate-pass', ...passForm }),
      })
      setShowPass(false)
      setPassForm({ studentId: '', reason: '', guardianName: '', guardianPhone: '' })
      setTab('gate-passes')
      flash('Gate pass created')
      await load()
    } catch (err) {
      setError(parseApiError(err).message)
    } finally {
      setSaving(false)
    }
  }

  const passAction = async (id: string, action: string) => {
    try {
      await apiFetch(`/api/v1/front-office/gate-passes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      flash(`Pass ${action.replace('_', ' ')}d`)
      await load()
    } catch (err) {
      setError(parseApiError(err).message)
    }
  }

  const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'
  const labelCls = 'text-xs font-semibold text-muted-foreground uppercase tracking-wide'

  return (
    <div className="p-4 md:p-6 space-y-5">
      <Breadcrumbs items={[{ label: 'Home', href: '/app/home' }, { label: 'Front Office' }]} />
      <PageHead
        eyebrow="Campus Safety"
        title="Front Office"
        description="Visitor check-ins, student gate passes and early-leave verification"
        actions={canWrite ? (
          <div className="flex gap-2">
            <TactileButton variant="secondary" onClick={() => { setTab('gate-passes'); setShowPass(true) }}><Plus size={16} /> Gate Pass</TactileButton>
            <TactileButton onClick={() => setShowVisitor(true)}><Plus size={16} /> Check In Visitor</TactileButton>
          </div>
        ) : undefined}
      />

      {error && <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">{error}</div>}
      {toast && <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{toast}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Visitors Today" value={stats?.visitorsToday ?? '—'} icon={<DoorOpen size={18} />} iconClass="g-sky" />
        <KpiTile label="On Premises" value={stats?.onPremises ?? '—'} icon={<UserCheck size={18} />} iconClass="g-green" />
        <KpiTile label="Passes Today" value={stats?.passesToday ?? '—'} icon={<IdCard size={18} />} iconClass="g-cyan" />
        <KpiTile label="Pending Approvals" value={stats?.pendingApprovals ?? '—'} icon={<Clock size={18} />} iconClass="g-orange" />
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-card p-1 w-fit">
        {([
          { key: 'visitors', label: `Visitors${visitors.length ? ` (${visitors.length})` : ''}` },
          { key: 'gate-passes', label: `Gate Passes${passes.length ? ` (${passes.length})` : ''}` },
        ] as const).map((t) => (
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
        ) : tab === 'visitors' ? (
          visitors.length === 0 ? (
            <EmptyState icon={<DoorOpen size={40} />} title="No visitors logged" description="Check in visitors at the front desk to keep campus secure" />
          ) : (
            <div className="max-h-[32rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Visitor</th>
                    <th className="px-4 py-3 text-left font-semibold">Purpose</th>
                    <th className="px-4 py-3 text-left font-semibold">To Meet</th>
                    <th className="px-4 py-3 text-left font-semibold">Badge</th>
                    <th className="px-4 py-3 text-left font-semibold">In</th>
                    <th className="px-4 py-3 text-left font-semibold">Out</th>
                    {canWrite && <th className="px-4 py-3 text-right font-semibold">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {visitors.map((v) => (
                    <tr key={v.id} className="border-t border-border hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <div className="font-medium">{v.visitorName}</div>
                        <div className="text-xs text-muted-foreground">{v.organization ?? v.visitorPhone ?? ''}</div>
                      </td>
                      <td className="px-4 py-3 max-w-[14rem]"><div className="truncate">{v.purpose}</div></td>
                      <td className="px-4 py-3">{v.personToMeet ?? '—'}</td>
                      <td className="px-4 py-3">{v.badgeNumber ?? '—'}</td>
                      <td className="px-4 py-3 tabular-nums">{fmtDate(v.checkInAt)} {fmtTime(v.checkInAt)}</td>
                      <td className="px-4 py-3 tabular-nums">{v.checkOutAt ? fmtTime(v.checkOutAt) : <StatusBadge label="ON CAMPUS" variant="info" />}</td>
                      {canWrite && (
                        <td className="px-4 py-3 text-right">
                          {!v.checkOutAt ? (
                            <button className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1" onClick={() => checkOut(v.id)}><LogOut size={12} /> Check out</button>
                          ) : '—'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : passes.length === 0 ? (
          <EmptyState icon={<IdCard size={40} />} title="No gate passes" description="Issue gate passes for students leaving during school hours" />
        ) : (
          <div className="max-h-[32rem] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Pass #</th>
                  <th className="px-4 py-3 text-left font-semibold">Student</th>
                  <th className="px-4 py-3 text-left font-semibold">Reason</th>
                  <th className="px-4 py-3 text-left font-semibold">Guardian</th>
                  <th className="px-4 py-3 text-left font-semibold">Out At</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  {canWrite && <th className="px-4 py-3 text-right font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {passes.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-4 py-3 font-mono text-xs">{p.passNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.student.firstName} {p.student.lastName}</div>
                      <div className="text-xs text-muted-foreground">{p.student.currentClassroom?.name ?? p.student.admissionNo}</div>
                    </td>
                    <td className="px-4 py-3 max-w-[12rem]"><div className="truncate">{p.reason}</div></td>
                    <td className="px-4 py-3">{p.guardianName ?? '—'}</td>
                    <td className="px-4 py-3 tabular-nums">{p.outAt ? fmtTime(p.outAt) : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge label={p.status} variant={(PASS_VARIANTS[p.status] ?? 'neutral') as any} /></td>
                    {canWrite && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {p.status === 'REQUESTED' && (
                          <>
                            <button className="text-xs font-medium text-emerald-600 hover:underline" onClick={() => passAction(p.id, 'approve')}>Approve</button>
                            <button className="ml-2 text-xs font-medium text-red-600 hover:underline" onClick={() => passAction(p.id, 'reject')}>Reject</button>
                          </>
                        )}
                        {p.status === 'APPROVED' && (
                          <button className="text-xs font-medium text-primary hover:underline" onClick={() => passAction(p.id, 'mark_out')}>Mark out</button>
                        )}
                        {p.status === 'OUT' && (
                          <button className="text-xs font-medium text-primary hover:underline" onClick={() => passAction(p.id, 'mark_returned')}>Mark returned</button>
                        )}
                        {['RETURNED', 'REJECTED'].includes(p.status) && '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Visitor check-in modal */}
      <Modal open={showVisitor} onClose={() => setShowVisitor(false)} title="Visitor Check-In" width="max-w-lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Visitor name *</label>
              <input className={`${inputCls} mt-1`} value={visitorForm.visitorName} onChange={(e) => setVisitorForm({ ...visitorForm, visitorName: e.target.value })} placeholder="Full name" />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input className={`${inputCls} mt-1`} value={visitorForm.visitorPhone} onChange={(e) => setVisitorForm({ ...visitorForm, visitorPhone: e.target.value })} placeholder="+91…" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Organization</label>
              <input className={`${inputCls} mt-1`} value={visitorForm.organization} onChange={(e) => setVisitorForm({ ...visitorForm, organization: e.target.value })} placeholder="Company / self" />
            </div>
            <div>
              <label className={labelCls}>Badge number</label>
              <input className={`${inputCls} mt-1`} value={visitorForm.badgeNumber} onChange={(e) => setVisitorForm({ ...visitorForm, badgeNumber: e.target.value })} placeholder="V-014" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Purpose *</label>
            <input className={`${inputCls} mt-1`} value={visitorForm.purpose} onChange={(e) => setVisitorForm({ ...visitorForm, purpose: e.target.value })} placeholder="Parent meeting / delivery / vendor" />
          </div>
          <div>
            <label className={labelCls}>Person to meet</label>
            <input className={`${inputCls} mt-1`} value={visitorForm.personToMeet} onChange={(e) => setVisitorForm({ ...visitorForm, personToMeet: e.target.value })} placeholder="Principal / Admin office" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <TactileButton variant="ghost" onClick={() => setShowVisitor(false)}>Cancel</TactileButton>
            <TactileButton onClick={checkIn} disabled={saving}>{saving ? 'Checking in…' : 'Check In'}</TactileButton>
          </div>
        </div>
      </Modal>

      {/* Gate pass modal */}
      <Modal open={showPass} onClose={() => setShowPass(false)} title="Issue Gate Pass" width="max-w-lg">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Student *</label>
            <select className={`${inputCls} mt-1`} value={passForm.studentId} onChange={(e) => setPassForm({ ...passForm, studentId: e.target.value })}>
              <option value="">Select student</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNo})</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Reason *</label>
            <input className={`${inputCls} mt-1`} value={passForm.reason} onChange={(e) => setPassForm({ ...passForm, reason: e.target.value })} placeholder="Doctor appointment / family emergency" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Guardian name</label>
              <input className={`${inputCls} mt-1`} value={passForm.guardianName} onChange={(e) => setPassForm({ ...passForm, guardianName: e.target.value })} placeholder="Picking up guardian" />
            </div>
            <div>
              <label className={labelCls}>Guardian phone</label>
              <input className={`${inputCls} mt-1`} value={passForm.guardianPhone} onChange={(e) => setPassForm({ ...passForm, guardianPhone: e.target.value })} placeholder="+91…" />
            </div>
          </div>
          <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
            <ArrowRightLeft size={14} className="mt-0.5 shrink-0" />
            Pass will be created for approval. Verify guardian identity at the gate before handing over the student.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <TactileButton variant="ghost" onClick={() => setShowPass(false)}>Cancel</TactileButton>
            <TactileButton onClick={createPass} disabled={saving}>{saving ? 'Creating…' : 'Create Pass'}</TactileButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
