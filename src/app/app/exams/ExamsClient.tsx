'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Breadcrumbs } from '@/components/preone/Breadcrumbs'
import { PageHead, KpiTile, StatusBadge } from '@/components/preone/ui'
import { TactileButton } from '@/components/preone/TactileMotion'
import { Modal } from '@/components/preone/Modal'
import { EmptyState } from '@/components/preone'
import { apiFetch, parseApiError } from '@/lib/client-api'
import {
  FileCheck2, Plus, Trash2, ClipboardList, Award, Send, Users, Sparkles, Activity, BadgeCheck,
} from 'lucide-react'

interface Exam {
  id: string; name: string; code: string; examType: string; status: string
  startDate: string; endDate: string
  academicSession: { id: string; name: string; isCurrent: boolean }
  _count: { schedules: number; reportCards: number }
}
interface Schedule {
  id: string; examDate: string; startTime: string; endTime: string
  maxMarks: string; passingMarks: string
  classroom: { id: string; name: string; code: string }
  subject: { id: string; name: string; code: string }
  _count: { marks: number }
}
interface MarkRow {
  id: string; admissionNo: string; firstName: string; lastName: string
  marksObtained: string | null; isAbsent: boolean; remarks: string | null
}
interface ReportCard {
  id: string; totalMarks: string; obtainedMarks: string; percentage: string
  grade: string | null; rank: number | null; result: string; publishedAt: string | null
  student: { id: string; admissionNo: string; firstName: string; lastName: string }
  exam: { id: string; name: string; code: string }
  classroom: { id: string; name: string; code: string }
}
interface Picker {
  classrooms: { id: string; name: string; code: string }[]
  subjects: { id: string; name: string; code: string }[]
  sessions: { id: string; name: string; isCurrent: boolean }[]
}

const EXAM_STATUS_VARIANTS: Record<string, string> = {
  DRAFT: 'neutral', SCHEDULED: 'info', ONGOING: 'warning',
  COMPLETED: 'success', PUBLISHED: 'success', CANCELLED: 'danger',
}

export function ExamsClient({ session }: { session: any }) {
  const [tab, setTab] = useState<'exams' | 'marks' | 'results'>('exams')
  const [exams, setExams] = useState<Exam[]>([])
  const [picker, setPicker] = useState<Picker | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  // create exam modal
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', examType: 'UNIT_TEST', startDate: '', endDate: '', academicSessionId: '' })

  // detail drawer state
  const [selected, setSelected] = useState<Exam | null>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [schedForm, setSchedForm] = useState({ classroomId: '', subjectId: '', examDate: '', startTime: '09:30', endTime: '10:30', maxMarks: '100', passingMarks: '35' })
  const [showSched, setShowSched] = useState(false)

  // marks entry
  const [marksheet, setMarksheet] = useState<{ schedule: Schedule & { exam: any; classroom: any; subject: any }; students: MarkRow[] } | null>(null)
  const [saving, setSaving] = useState(false)

  // report cards
  const [cards, setCards] = useState<ReportCard[]>([])
  const [genForm, setGenForm] = useState({ examId: '', classroomId: '' })

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000) }

  const loadExams = useCallback(async () => {
    setLoading(true)
    const r = await apiFetch<Exam[]>('/api/v1/exams')
    if (r.success && r.data) setExams(r.data)
    else setError(parseApiError(r).message)
    setLoading(false)
  }, [])

  const loadPicker = useCallback(async () => {
    const [cls, ses] = await Promise.all([
      apiFetch<any>('/api/v1/classrooms'),
      apiFetch<any>('/api/v1/academic-years'),
    ])
    const classrooms = (Array.isArray(cls.data) ? cls.data : cls.data?.items || []).map((c: any) => ({ id: c.id, name: c.name, code: c.code }))
    const sessions = (Array.isArray(ses.data) ? ses.data : ses.data?.items || []).map((s: any) => ({ id: s.id, name: s.name, isCurrent: s.isCurrent }))
    const subj = await apiFetch<any>('/api/v1/subjects')
    const subjects = (Array.isArray(subj.data) ? subj.data : subj.data?.items || []).map((s: any) => ({ id: s.id, name: s.name, code: s.code }))
    setPicker({ classrooms, subjects, sessions })
    setForm((f) => ({ ...f, academicSessionId: sessions.find((s: any) => s.isCurrent)?.id || sessions[0]?.id || '' }))
  }, [])

  useEffect(() => { loadExams(); loadPicker() }, [loadExams, loadPicker])

  const openExam = async (exam: Exam) => {
    setSelected(exam)
    const r = await apiFetch<{ schedules: Schedule[] }>(`/api/v1/exams/${exam.id}`)
    if (r.success && r.data) setSchedules(r.data.schedules || [])
  }

  const createExam = async () => {
    setError('')
    const r = await apiFetch('/api/v1/exams', { method: 'POST', body: JSON.stringify(form) })
    if (r.success) {
      setShowCreate(false)
      setForm({ name: '', code: '', examType: 'UNIT_TEST', startDate: '', endDate: '', academicSessionId: form.academicSessionId })
      flash('Exam created')
      loadExams()
    } else setError(parseApiError(r).message)
  }

  const addSchedule = async () => {
    if (!selected) return
    setError('')
    const r = await apiFetch('/api/v1/exams/schedules', {
      method: 'POST',
      body: JSON.stringify({ examId: selected.id, ...schedForm, maxMarks: Number(schedForm.maxMarks), passingMarks: Number(schedForm.passingMarks) }),
    })
    if (r.success) {
      setShowSched(false)
      flash('Subject scheduled')
      openExam(selected)
      loadExams()
    } else setError(parseApiError(r).message)
  }

  const removeSchedule = async (id: string) => {
    const r = await apiFetch(`/api/v1/exams/schedules/${id}`, { method: 'DELETE' })
    if (r.success && selected) { flash('Removed'); openExam(selected) }
    else setError(parseApiError(r).message)
  }

  const openMarkSheet = async (scheduleId: string) => {
    const r = await apiFetch<any>(`/api/v1/exams/schedules/${scheduleId}/marks`)
    if (r.success && r.data) {
      setSelected(null)
      setMarksheet(r.data)
      setTab('marks')
    } else setError(parseApiError(r).message)
  }

  const saveMarks = async () => {
    if (!marksheet) return
    setSaving(true)
    setError('')
    const entries = marksheet.students.map((s) => ({
      studentId: s.id,
      marksObtained: s.isAbsent ? null : (s.marksObtained === '' || s.marksObtained == null ? null : Number(s.marksObtained)),
      isAbsent: s.isAbsent,
      remarks: s.remarks || undefined,
    }))
    const r = await apiFetch(`/api/v1/exams/schedules/${marksheet.schedule.id}/marks`, {
      method: 'POST', body: JSON.stringify({ entries }),
    })
    setSaving(false)
    if (r.success) flash(`Marks saved for ${entries.length} students`)
    else setError(parseApiError(r).message)
  }

  const loadCards = useCallback(async () => {
    const r = await apiFetch<ReportCard[]>('/api/v1/exams/report-cards')
    if (r.success && r.data) setCards(r.data)
  }, [])

  useEffect(() => { if (tab === 'results') loadCards() }, [tab, loadCards])

  const generateCards = async () => {
    setError('')
    const r = await apiFetch('/api/v1/exams/report-cards', { method: 'POST', body: JSON.stringify(genForm) })
    if (r.success) { flash('Report cards generated'); loadCards() }
    else setError(parseApiError(r).message)
  }

  const publish = async (examId: string) => {
    setError('')
    const r = await apiFetch(`/api/v1/exams/${examId}/publish`)
    if (r.success) { flash('Results published to parents'); loadCards(); loadExams() }
    else setError(parseApiError(r).message)
  }

  const publishedCount = exams.filter((e) => e.status === 'PUBLISHED').length
  const activeExams = exams.filter((e) => !['PUBLISHED', 'CANCELLED'].includes(e.status)).length

  return (
    <div className="page-shell space-y-6">
      <Breadcrumbs items={[{ label: 'Home', href: '/app/home' }, { label: 'Exams & Results' }]} />
      <PageHead
        eyebrow="PreOne Plus"
        title="Exams & Results"
        description="Schedule exams, enter marks, generate report cards and publish results"
        backHref="/app/home"
        actions={<TactileButton variant="primary" size="md" onClick={() => setShowCreate(true)}><Plus size={16} className="mr-1.5" />New Exam</TactileButton>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <KpiTile label="Total Exams" value={exams.length} icon={<Sparkles size={18} />} iconClass="ic-purple" />
        <KpiTile label="Active / Ongoing" value={activeExams} icon={<Activity size={18} />} iconClass="ic-orange" />
        <KpiTile label="Results Published" value={publishedCount} icon={<BadgeCheck size={18} />} iconClass="ic-green" />
      </div>

      <div className="flex gap-2 flex-wrap" role="tablist">
        {([['exams', 'Exam Calendar', <ClipboardList size={14} key="i" />], ['marks', 'Marks Entry', <FileCheck2 size={14} key="i" />], ['results', 'Report Cards', <Award size={14} key="i" />]] as const).map(([k, label, icon]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k as any)}
            className={`btn btn-sm ${tab === k ? 'btn-primary' : 'btn-ghost'}`}
            style={{ border: '1px solid var(--border-default)' }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {error && <div className="card p-3 text-sm" style={{ borderColor: 'var(--danger, #EF4444)', color: 'var(--danger, #EF4444)' }}>{error}</div>}
      {toast && <div className="card p-3 text-sm" style={{ borderColor: 'var(--success, #16A34A)', color: 'var(--success, #16A34A)' }}>{toast}</div>}

      {tab === 'exams' && (
        <div className="card p-4 md:p-6">
          {loading ? <p className="text-sm opacity-60">Loading exams…</p> : exams.length === 0 ? (
            <EmptyState illustration="classrooms" eyebrow="No exams yet" title="Create your first exam" description="Set up exam cycles, schedule subjects and publish report cards." />
          ) : (
            <div className="space-y-3">
              {exams.map((e) => (
                <div key={e.id} className="flex flex-col md:flex-row md:items-center gap-3 justify-between p-4 rounded-xl" style={{ border: '1px solid var(--border-default)' }}>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{e.name}</span>
                      <StatusBadge label={e.status} variant={(EXAM_STATUS_VARIANTS[e.status] || 'neutral') as any} />
                    </div>
                    <p className="text-xs opacity-60 mt-1">
                      {e.code} · {e.examType.replace(/_/g, ' ')} · {new Date(e.startDate).toLocaleDateString('en-IN')} → {new Date(e.endDate).toLocaleDateString('en-IN')} · {e.academicSession?.name}
                    </p>
                    <p className="text-xs opacity-60">{e._count.schedules} subjects scheduled · {e._count.reportCards} report cards</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <TactileButton variant="secondary" size="sm" onClick={() => openExam(e)}>Schedule</TactileButton>
                    {e._count.schedules > 0 && (
                      <TactileButton variant="secondary" size="sm" onClick={() => openMarkSheet(schedules[0]?.id || e.id)}>Marks</TactileButton>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'marks' && (
        <div className="card p-4 md:p-6">
          {!marksheet ? (
            <EmptyState illustration="classrooms" eyebrow="Marks entry" title="Pick a subject schedule" description="Open an exam from the Exam Calendar tab and choose “Enter marks” on a scheduled subject." />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{marksheet.schedule.subject.name} — {marksheet.schedule.classroom.name}</h3>
                  <p className="text-xs opacity-60">{marksheet.schedule.exam.name} · Max {marksheet.schedule.maxMarks} marks · Passing {marksheet.schedule.passingMarks}</p>
                </div>
                <div className="flex gap-2">
                  <TactileButton variant="secondary" size="sm" onClick={() => setMarksheet(null)}>Back</TactileButton>
                  <TactileButton variant="primary" size="sm" onClick={saveMarks} disabled={saving}>{saving ? 'Saving…' : 'Save Marks'}</TactileButton>
                </div>
              </div>
              <div className="max-h-[480px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="text-left opacity-60">
                      <th className="py-2 pr-2">Adm#</th>
                      <th className="py-2 pr-2">Student</th>
                      <th className="py-2 pr-2 w-28">Marks</th>
                      <th className="py-2 pr-2 w-20">Absent</th>
                      <th className="py-2">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marksheet.students.map((s, i) => (
                      <tr key={s.id} className="border-t" style={{ borderColor: 'var(--border-default)' }}>
                        <td className="py-2 pr-2 opacity-60">{s.admissionNo}</td>
                        <td className="py-2 pr-2">{s.firstName} {s.lastName || ''}</td>
                        <td className="py-2 pr-2">
                          <input
                            type="number" min={0} className="input input-sm w-24" value={s.marksObtained ?? ''}
                            disabled={s.isAbsent}
                            onChange={(e) => {
                              const next = [...marksheet.students]
                              next[i] = { ...s, marksObtained: e.target.value === '' ? null : e.target.value }
                              setMarksheet({ ...marksheet, students: next })
                            }}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="checkbox" checked={s.isAbsent} aria-label={`Absent ${s.firstName}`}
                            onChange={(e) => {
                              const next = [...marksheet.students]
                              next[i] = { ...s, isAbsent: e.target.checked, marksObtained: e.target.checked ? null : s.marksObtained }
                              setMarksheet({ ...marksheet, students: next })
                            }}
                          />
                        </td>
                        <td className="py-2">
                          <input
                            className="input input-sm w-full" value={s.remarks || ''}
                            onChange={(e) => {
                              const next = [...marksheet.students]
                              next[i] = { ...s, remarks: e.target.value }
                              setMarksheet({ ...marksheet, students: next })
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {marksheet.students.length === 0 && <p className="text-sm opacity-60 py-4">No active students in this classroom.</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'results' && (
        <div className="space-y-4">
          <div className="card p-4 md:p-6">
            <h3 className="font-semibold mb-3">Generate Report Cards</h3>
            <div className="flex flex-col md:flex-row gap-2 md:items-end">
              <label className="text-xs flex-1">Exam
                <select className="input w-full mt-1" value={genForm.examId} onChange={(e) => setGenForm({ ...genForm, examId: e.target.value })}>
                  <option value="">Select exam…</option>
                  {exams.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
                </select>
              </label>
              <label className="text-xs flex-1">Classroom
                <select className="input w-full mt-1" value={genForm.classroomId} onChange={(e) => setGenForm({ ...genForm, classroomId: e.target.value })}>
                  <option value="">Select classroom…</option>
                  {picker?.classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <TactileButton variant="primary" size="md" onClick={generateCards} disabled={!genForm.examId || !genForm.classroomId}>Generate</TactileButton>
            </div>
            {exams.some((e) => e.status === 'COMPLETED') && (
              <div className="mt-3 pt-3 text-sm" style={{ borderTop: '1px solid var(--border-default)' }}>
                {exams.filter((e) => e.status === 'COMPLETED').map((e) => (
                  <div key={e.id} className="flex items-center justify-between py-1.5">
                    <span>{e.name} — completed, ready to publish</span>
                    <TactileButton variant="primary" size="sm" onClick={() => publish(e.id)}><Send size={13} className="mr-1" />Publish Results</TactileButton>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-4 md:p-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Users size={16} />Generated Report Cards ({cards.length})</h3>
            {cards.length === 0 ? <p className="text-sm opacity-60">No report cards yet. Generate them after marks entry is complete.</p> : (
              <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="text-left opacity-60">
                      <th className="py-2 pr-2">Rank</th>
                      <th className="py-2 pr-2">Student</th>
                      <th className="py-2 pr-2">Exam</th>
                      <th className="py-2 pr-2">Score</th>
                      <th className="py-2 pr-2">%</th>
                      <th className="py-2 pr-2">Grade</th>
                      <th className="py-2">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cards.map((c) => (
                      <tr key={c.id} className="border-t" style={{ borderColor: 'var(--border-default)' }}>
                        <td className="py-2 pr-2 font-semibold">{c.rank ?? '—'}</td>
                        <td className="py-2 pr-2">{c.student.firstName} {c.student.lastName || ''}</td>
                        <td className="py-2 pr-2 opacity-70">{c.exam.name}</td>
                        <td className="py-2 pr-2">{Number(c.obtainedMarks)}/{Number(c.totalMarks)}</td>
                        <td className="py-2 pr-2">{Number(c.percentage)}%</td>
                        <td className="py-2 pr-2 font-semibold">{c.grade}</td>
                        <td className="py-2"><StatusBadge label={c.result} variant={c.result === 'PASS' ? 'success' : c.result === 'FAIL' ? 'danger' : 'neutral'} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create exam modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Exam">
        <div className="space-y-3">
          <label className="text-xs block">Exam name<input className="input w-full mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Annual Exam 2025-26" /></label>
          <label className="text-xs block">Code<input className="input w-full mt-1" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="ANNUAL-26" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs block">Type
              <select className="input w-full mt-1" value={form.examType} onChange={(e) => setForm({ ...form, examType: e.target.value })}>
                {['UNIT_TEST', 'CYCLE_TEST', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL', 'ACTIVITY_ASSESSMENT'].map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <label className="text-xs block">Session
              <select className="input w-full mt-1" value={form.academicSessionId} onChange={(e) => setForm({ ...form, academicSessionId: e.target.value })}>
                <option value="">Select…</option>
                {picker?.sessions.map((s) => <option key={s.id} value={s.id}>{s.name}{s.isCurrent ? ' (current)' : ''}</option>)}
              </select>
            </label>
            <label className="text-xs block">Start date<input type="date" className="input w-full mt-1" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
            <label className="text-xs block">End date<input type="date" className="input w-full mt-1" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <TactileButton variant="secondary" size="md" onClick={() => setShowCreate(false)}>Cancel</TactileButton>
            <TactileButton variant="primary" size="md" onClick={createExam} disabled={!form.name || !form.code || !form.startDate || !form.academicSessionId}>Create Exam</TactileButton>
          </div>
        </div>
      </Modal>

      {/* Schedule modal */}
      <Modal open={showSched} onClose={() => setShowSched(false)} title={`Schedule subject — ${selected?.name || ''}`}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs block">Classroom
              <select className="input w-full mt-1" value={schedForm.classroomId} onChange={(e) => setSchedForm({ ...schedForm, classroomId: e.target.value })}>
                <option value="">Select…</option>
                {picker?.classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-xs block">Subject
              <select className="input w-full mt-1" value={schedForm.subjectId} onChange={(e) => setSchedForm({ ...schedForm, subjectId: e.target.value })}>
                <option value="">Select…</option>
                {picker?.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="text-xs block">Date<input type="date" className="input w-full mt-1" value={schedForm.examDate} onChange={(e) => setSchedForm({ ...schedForm, examDate: e.target.value })} /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs block">From<input type="time" className="input w-full mt-1" value={schedForm.startTime} onChange={(e) => setSchedForm({ ...schedForm, startTime: e.target.value })} /></label>
              <label className="text-xs block">To<input type="time" className="input w-full mt-1" value={schedForm.endTime} onChange={(e) => setSchedForm({ ...schedForm, endTime: e.target.value })} /></label>
            </div>
            <label className="text-xs block">Max marks<input type="number" className="input w-full mt-1" value={schedForm.maxMarks} onChange={(e) => setSchedForm({ ...schedForm, maxMarks: e.target.value })} /></label>
            <label className="text-xs block">Passing marks<input type="number" className="input w-full mt-1" value={schedForm.passingMarks} onChange={(e) => setSchedForm({ ...schedForm, passingMarks: e.target.value })} /></label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <TactileButton variant="secondary" size="md" onClick={() => setShowSched(false)}>Cancel</TactileButton>
            <TactileButton variant="primary" size="md" onClick={addSchedule} disabled={!schedForm.classroomId || !schedForm.subjectId || !schedForm.examDate}>Add Schedule</TactileButton>
          </div>
        </div>
      </Modal>

      {/* Exam detail modal (schedules list) */}
      <Modal open={!!selected && !showSched} onClose={() => setSelected(null)} title={selected ? `${selected.name} — schedule` : ''}>
        <div className="space-y-3">
          {schedules.length === 0 ? <p className="text-sm opacity-60">No subjects scheduled yet.</p> : schedules.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 p-3 rounded-lg" style={{ border: '1px solid var(--border-default)' }}>
              <div className="text-sm">
                <span className="font-medium">{s.subject.name}</span> <span className="opacity-60">· {s.classroom.name}</span>
                <p className="text-xs opacity-60">{new Date(s.examDate).toLocaleDateString('en-IN')} · {s.startTime}-{s.endTime} · Max {Number(s.maxMarks)} · {s._count.marks} marks entered</p>
              </div>
              <div className="flex gap-1.5">
                <TactileButton variant="secondary" size="sm" onClick={() => openMarkSheet(s.id)}>Enter Marks</TactileButton>
                <TactileButton variant="ghost" size="sm" onClick={() => removeSchedule(s.id)} aria-label="Remove schedule"><Trash2 size={14} /></TactileButton>
              </div>
            </div>
          ))}
          <TactileButton variant="primary" size="md" onClick={() => setShowSched(true)} disabled={selected?.status === 'PUBLISHED'}><Plus size={15} className="mr-1" />Add Subject Schedule</TactileButton>
        </div>
      </Modal>
    </div>
  )
}
