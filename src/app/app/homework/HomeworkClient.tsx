'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Breadcrumbs } from '@/components/preone/Breadcrumbs'
import { PageHead, KpiTile, StatusBadge } from '@/components/preone/ui'
import { TactileButton } from '@/components/preone/TactileMotion'
import { Modal } from '@/components/preone/Modal'
import { EmptyState } from '@/components/preone'
import { apiFetch, parseApiError } from '@/lib/client-api'
import { can } from '@/lib/auth'
import { NotebookPen, Plus, Users, CalendarClock, CheckCircle2, ClipboardCheck, Star } from 'lucide-react'

interface HomeworkRow {
  id: string
  title: string
  description: string | null
  status: string
  assignedDate: string
  dueDate: string
  estimatedMinutes: number | null
  classroom: { id: string; name: string; code: string }
  subject: { id: string; name: string; code: string } | null
  teacher: { id: string; fullName: string } | null
  classStrength: number
  submittedCount: number
}
interface SubmissionRow {
  id: string
  status: string
  submittedAt: string | null
  remarks: string | null
  grade: string | null
  feedback: string | null
  student: { id: string; admissionNo: string; firstName: string; lastName: string }
}
interface Picker {
  classrooms: { id: string; name: string; code: string }[]
  subjects: { id: string; name: string; code: string }[]
}

const STATUS_VARIANTS: Record<string, string> = {
  DRAFT: 'neutral', PUBLISHED: 'info', CLOSED: 'success',
  PENDING: 'neutral', SUBMITTED: 'info', LATE: 'warning', GRADED: 'success', RETURNED: 'success',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function HomeworkClient({ session }: { session: any }) {
  const [rows, setRows] = useState<HomeworkRow[]>([])
  const [stats, setStats] = useState<any>(null)
  const [picker, setPicker] = useState<Picker | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', classroomId: '', subjectId: '', dueDate: '', estimatedMinutes: '' })
  const [saving, setSaving] = useState(false)

  // submissions drawer
  const [detail, setDetail] = useState<{ homework: HomeworkRow; submissions: SubmissionRow[] } | null>(null)
  const [gradeDraft, setGradeDraft] = useState<Record<string, { grade: string; feedback: string }>>({})

  const canWrite = can((session?.roles as any)?.length ? session.roles : [session?.role], 'homework:write')

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, st] = await Promise.all([
        apiFetch<any[]>('/api/v1/homework'),
        apiFetch<any>('/api/v1/homework?stats=1'),
      ])
      setRows(Array.isArray(list?.data) ? list.data : [])
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
    apiFetch<any>('/api/v1/classrooms').then((r) => setPicker((p) => ({ classrooms: Array.isArray(r?.data) ? r.data : (r?.data?.items ?? []), subjects: p?.subjects ?? [] }))).catch(() => {})
    apiFetch<any>('/api/v1/subjects').then((r) => setPicker((p) => ({ classrooms: p?.classrooms ?? [], subjects: Array.isArray(r?.data) ? r.data : (r?.data?.items ?? []) }))).catch(() => {})
  }, [load])

  const submitCreate = async () => {
    if (!form.title.trim() || !form.classroomId || !form.dueDate) {
      setError('Title, class and due date are required')
      setSaving(false)
      return
    }
    setSaving(true)
    try {
      const r = await apiFetch('/api/v1/homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : undefined,
        }),
      })
      if (!r?.success) { setError(parseApiError(r).message); setSaving(false); return }
      setShowCreate(false)
      setForm({ title: '', description: '', classroomId: '', subjectId: '', dueDate: '', estimatedMinutes: '' })
      flash('Homework assigned')
      await load()
    } catch (err) {
      setError(parseApiError(err).message)
    } finally {
      setSaving(false)
    }
  }

  const openSubmissions = async (hw: HomeworkRow) => {
    try {
      const subs = await apiFetch<any[]>(`/api/v1/homework/${hw.id}/submissions`)
      setDetail({ homework: hw, submissions: Array.isArray(subs?.data) ? subs.data : [] })
      setGradeDraft({})
    } catch (err) {
      setError(parseApiError(err).message)
    }
  }

  const markSubmitted = async (homeworkId: string, studentId: string) => {
    try {
      const r = await apiFetch(`/api/v1/homework/${homeworkId}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      })
      if (!r?.success) { setError(parseApiError(r).message); return }
      flash('Marked submitted')
      const subs = await apiFetch<any[]>(`/api/v1/homework/${homeworkId}/submissions`)
      setDetail((d) => (d ? { ...d, submissions: Array.isArray(subs?.data) ? subs.data : [] } : d))
      await load()
    } catch (err) {
      setError(parseApiError(err).message)
    }
  }

  const saveGrade = async (homeworkId: string, studentId: string, draft: { grade: string; feedback: string }) => {
    try {
      const r = await apiFetch(`/api/v1/homework/${homeworkId}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'grade', studentId, ...draft }),
      })
      if (!r?.success) { setError(parseApiError(r).message); return }
      flash('Graded')
      const subs = await apiFetch<any[]>(`/api/v1/homework/${homeworkId}/submissions`)
      setDetail((d) => (d ? { ...d, submissions: Array.isArray(subs?.data) ? subs.data : [] } : d))
      await load()
    } catch (err) {
      setError(parseApiError(err).message)
    }
  }

  const closeHomework = async (id: string) => {
    try {
      const r = await apiFetch(`/api/v1/homework/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CLOSED' }),
      })
      if (!r?.success) { setError(parseApiError(r).message); return }
      flash('Homework closed')
      await load()
    } catch (err) {
      setError(parseApiError(err).message)
    }
  }

  const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'
  const labelCls = 'text-xs font-semibold text-muted-foreground uppercase tracking-wide'

  return (
    <div className="p-4 md:p-6 space-y-5">
      <Breadcrumbs items={[{ label: 'Home', href: '/app/home' }, { label: 'Homework' }]} />
      <PageHead
        eyebrow="Academics"
        title="Homework & Assignments"
        description="Assign homework, track submissions and grade — all in one place"
        actions={canWrite ? (
          <TactileButton onClick={() => setShowCreate(true)}><Plus size={16} /> Assign Homework</TactileButton>
        ) : undefined}
      />

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">{error}</div>
      )}
      {toast && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{toast}</div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Total Homework" value={stats?.total ?? '—'} icon={<NotebookPen size={18} />} iconClass="g-pink" />
        <KpiTile label="Open Now" value={stats?.open ?? '—'} icon={<CalendarClock size={18} />} iconClass="g-sky" />
        <KpiTile label="Submissions" value={stats?.submissions ?? '—'} icon={<ClipboardCheck size={18} />} iconClass="g-cyan" />
        <KpiTile label="Graded" value={stats?.graded ?? '—'} icon={<CheckCircle2 size={18} />} iconClass="g-green" />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading homework…</div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<NotebookPen size={40} />}
            title="No homework assigned yet"
            description={canWrite ? 'Assign your first homework to a class' : 'Homework assigned by teachers will appear here'}
          />
        ) : (
          <div className="max-h-[32rem] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Title</th>
                  <th className="px-4 py-3 text-left font-semibold">Class</th>
                  <th className="px-4 py-3 text-left font-semibold">Subject</th>
                  <th className="px-4 py-3 text-left font-semibold">Due</th>
                  <th className="px-4 py-3 text-left font-semibold">Completion</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((hw) => {
                  const pct = hw.classStrength > 0 ? Math.round((hw.submittedCount / hw.classStrength) * 100) : 0
                  return (
                    <tr key={hw.id} className="border-t border-border hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium">
                        <div className="max-w-[16rem] truncate">{hw.title}</div>
                        <div className="text-xs text-muted-foreground">{hw.teacher?.fullName ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3">{hw.classroom?.name}</td>
                      <td className="px-4 py-3">{hw.subject?.name ?? '—'}</td>
                      <td className="px-4 py-3">{fmtDate(hw.dueDate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-[8rem]">
                          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums">{hw.submittedCount}/{hw.classStrength}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge label={hw.status} variant={(STATUS_VARIANTS[hw.status] ?? 'neutral') as any} /></td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button className="text-xs font-medium text-primary hover:underline" onClick={() => openSubmissions(hw)}>Submissions</button>
                        {canWrite && hw.status === 'PUBLISHED' && (
                          <button className="ml-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline" onClick={() => closeHomework(hw.id)}>Close</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create homework modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Assign Homework" width="max-w-lg">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Title *</label>
            <input className={`${inputCls} mt-1`} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Chapter 4 — Fractions worksheet" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Class *</label>
              <select className={`${inputCls} mt-1`} value={form.classroomId} onChange={(e) => setForm({ ...form, classroomId: e.target.value })}>
                <option value="">Select class</option>
                {(picker?.classrooms ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Subject</label>
              <select className={`${inputCls} mt-1`} value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                <option value="">—</option>
                {(picker?.subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Due date *</label>
              <input type="date" className={`${inputCls} mt-1`} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Est. minutes</label>
              <input type="number" min={5} className={`${inputCls} mt-1`} value={form.estimatedMinutes} onChange={(e) => setForm({ ...form, estimatedMinutes: e.target.value })} placeholder="30" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Instructions</label>
            <textarea className={`${inputCls} mt-1 min-h-[5rem]`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Complete exercise 4.2, questions 1–12" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <TactileButton variant="ghost" onClick={() => setShowCreate(false)}>Cancel</TactileButton>
            <TactileButton onClick={submitCreate} disabled={saving}>{saving ? 'Assigning…' : 'Assign'}</TactileButton>
          </div>
        </div>
      </Modal>

      {/* Submissions modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Submissions — ${detail.homework.title}` : ''} width="max-w-3xl">
        {detail && (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {detail.submissions.length === 0 && (
              <EmptyState icon={<Users size={36} />} title="No students in this class" description="Add students to the class to track submissions" />
            )}
            {detail.submissions.map((s) => {
              const d = gradeDraft[s.id] ?? { grade: s.grade ?? '', feedback: s.feedback ?? '' }
              const submittable = ['PENDING'].includes(s.status) && canWrite
              return (
                <div key={s.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm">{s.student.firstName} {s.student.lastName}</div>
                      <div className="text-xs text-muted-foreground">{s.student.admissionNo} · {s.submittedAt ? `Submitted ${fmtDate(s.submittedAt)}` : 'Not submitted'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge label={s.status} variant={(STATUS_VARIANTS[s.status] ?? 'neutral') as any} />
                      {submittable && (
                        <button className="text-xs font-medium text-primary hover:underline" onClick={() => markSubmitted(detail.homework.id, s.student.id)}>Mark submitted</button>
                      )}
                    </div>
                  </div>
                  {canWrite && s.status !== 'PENDING' && (
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <div className="w-24">
                        <label className={labelCls}>Grade</label>
                        <input className={`${inputCls} mt-1`} value={d.grade} onChange={(e) => setGradeDraft({ ...gradeDraft, [s.id]: { ...d, grade: e.target.value } })} placeholder="A" />
                      </div>
                      <div className="flex-1 min-w-[10rem]">
                        <label className={labelCls}>Feedback</label>
                        <input className={`${inputCls} mt-1`} value={d.feedback} onChange={(e) => setGradeDraft({ ...gradeDraft, [s.id]: { ...d, feedback: e.target.value } })} placeholder="Good work!" />
                      </div>
                      <TactileButton variant="secondary" onClick={() => saveGrade(detail.homework.id, s.student.id, d)}>
                        <Star size={14} /> Save Grade
                      </TactileButton>
                    </div>
                  )}
                  {!canWrite && s.grade && <div className="mt-2 text-xs text-muted-foreground">Grade: <span className="font-semibold text-foreground">{s.grade}</span>{s.feedback ? ` — ${s.feedback}` : ''}</div>}
                </div>
              )
            })}
          </div>
        )}
      </Modal>
    </div>
  )
}
