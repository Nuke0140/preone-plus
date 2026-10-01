'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Breadcrumbs } from '@/components/preone/Breadcrumbs'
import { PageHead } from '@/components/preone/ui'
import { TactileButton } from '@/components/preone/TactileMotion'
import { Modal } from '@/components/preone/Modal'
import { EmptyState } from '@/components/preone'
import { apiFetch, parseApiError } from '@/lib/client-api'
import { CalendarRange, Plus, Trash2, Copy, User } from 'lucide-react'

interface Slot {
  id: string; day: string; periodNumber: number; startTime: string; endTime: string
  label: string | null
  subject: { id: string; name: string; code: string } | null
  teacher: { id: string; fullName: string } | null
}
interface Classroom { id: string; name: string; code: string }
interface Teacher { id: string; employeeCode: string; designation?: string; user: { id: string; fullName: string } }

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const
const DAY_SHORT: Record<string, string> = { MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat' }

const SLOT_COLORS = [
  'color-mix(in srgb, var(--primary, #7C3AED) 10%, white)',
  'color-mix(in srgb, var(--secondary, #0D9488) 10%, white)',
  'color-mix(in srgb, var(--warning, #D97706) 10%, white)',
  'color-mix(in srgb, var(--info, #2563EB) 10%, white)',
  'color-mix(in srgb, var(--pink, #DB2777) 10%, white)',
]

export function TimetableClient({ session }: { session: any }) {
  const [view, setView] = useState<'class' | 'teacher'>('class')
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [classroomId, setClassroomId] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [slots, setSlots] = useState<Slot[]>([])
  const [periods, setPeriods] = useState<{ n: number; start: string; end: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const [showSlot, setShowSlot] = useState(false)
  const [slotForm, setSlotForm] = useState({ day: 'MONDAY', periodNumber: 1, startTime: '09:00', endTime: '09:40', subjectId: '', teacherId: '', label: '' })
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([])
  const [copyFrom, setCopyFrom] = useState('')

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    ;(async () => {
      const r = await apiFetch<any>('/api/v1/timetable?meta=classrooms')
      if (r.success && r.data) {
        setClassrooms(r.data.classrooms || [])
        setClassroomId((prev) => prev || r.data.classrooms?.[0]?.id || '')
      }
      const t = await apiFetch<Teacher[]>('/api/v1/timetable?meta=teachers')
      if (t.success && t.data) setTeachers(t.data)
      const s = await apiFetch<any>('/api/v1/subjects')
      if (s.success && s.data) setSubjects(Array.isArray(s.data) ? s.data : s.data?.items || [])
    })()
  }, [])

  const loadGrid = useCallback(async () => {
    if (view === 'class' && !classroomId) return
    if (view === 'teacher' && !teacherId) return
    setLoading(true)
    setError('')
    const q = view === 'class' ? `classroomId=${classroomId}` : `teacherId=${teacherId}`
    const r = await apiFetch<any>(`/api/v1/timetable?${q}`)
    if (r.success && r.data) {
      const list: Slot[] = r.data.slots || []
      setSlots(list)
      // derive period rows from data (max period + most common time)
      const map = new Map<number, { start: string; end: string }>()
      for (const s of list) map.set(s.periodNumber, { start: s.startTime, end: s.endTime })
      setPeriods([...map.entries()].map(([n, t]) => ({ n, ...t })).sort((a, b) => a.n - b.n))
    } else setError(parseApiError(r).message)
    setLoading(false)
  }, [view, classroomId, teacherId])

  useEffect(() => { loadGrid() }, [loadGrid])

  const getSlot = (day: string, period: number) => slots.find((s) => s.day === day && s.periodNumber === period)

  const openSlotEditor = (day: string, period: number) => {
    if (!canEdit) return
    const existing = getSlot(day, period)
    setSlotForm({
      day,
      periodNumber: period,
      startTime: existing?.startTime || periods.find((p) => p.n === period)?.start || '09:00',
      endTime: existing?.endTime || periods.find((p) => p.n === period)?.end || '09:40',
      subjectId: existing?.subject?.id || '',
      teacherId: existing?.teacher?.id || '',
      label: existing?.label || '',
    })
    setShowSlot(true)
  }

  const saveSlot = async () => {
    setError('')
    const r = await apiFetch('/api/v1/timetable', {
      method: 'POST',
      body: JSON.stringify({
        classroomId, day: slotForm.day, periodNumber: slotForm.periodNumber,
        startTime: slotForm.startTime, endTime: slotForm.endTime,
        subjectId: slotForm.subjectId || null,
        teacherId: slotForm.teacherId || null,
        label: slotForm.label || null,
      }),
    })
    if (r.success) {
      setShowSlot(false)
      flash('Slot saved')
      loadGrid()
    } else setError(parseApiError(r).message)
  }

  const deleteSlot = async (id: string) => {
    const r = await apiFetch(`/api/v1/timetable/slots/${id}`, { method: 'DELETE' })
    if (r.success) { flash('Slot removed'); loadGrid() }
    else setError(parseApiError(r).message)
  }

  const copyDay = async () => {
    if (!copyFrom) return
    setError('')
    const r = await apiFetch('/api/v1/timetable/copy-day', {
      method: 'POST', body: JSON.stringify({ classroomId, fromDay: copyFrom, toDay: slotForm.day === copyFrom ? 'MONDAY' : slotForm.day }),
    })
    if (r.success) { flash(`Day copied`); loadGrid() }
    else setError(parseApiError(r).message)
  }

  const canEdit = view === 'class' // teachers manage class grids with timetable:write; teacher-view is read-only aggregation

  return (
    <div className="page-shell space-y-6">
      <Breadcrumbs items={[{ label: 'Home', href: '/app/home' }, { label: 'Timetable' }]} />
      <PageHead
        eyebrow="PreOne Plus"
        title="Timetable"
        description="Class-wise and teacher-wise weekly schedules with conflict detection"
        backHref="/app/home"
      />

      <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
        <div className="flex gap-2">
          {([['class', 'Class view', <CalendarRange size={14} key="c" />], ['teacher', 'Teacher view', <User size={14} key="t" />]] as const).map(([k, label, icon]) => (
            <button key={k} onClick={() => setView(k as any)} className={`btn btn-sm ${view === k ? 'btn-primary' : 'btn-ghost'}`} style={{ border: '1px solid var(--border-default)' }}>{icon} {label}</button>
          ))}
        </div>
        {view === 'class' ? (
          <select className="input md:w-64" value={classroomId} onChange={(e) => setClassroomId(e.target.value)} aria-label="Select classroom">
            <option value="">Select classroom…</option>
            {classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        ) : (
          <select className="input md:w-64" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} aria-label="Select teacher">
            <option value="">Select teacher…</option>
            {teachers.map((t) => <option key={t.user.id} value={t.user.id}>{t.user.fullName} {t.employeeCode ? `(${t.employeeCode})` : ''}</option>)}
          </select>
        )}
      </div>

      {error && <div className="card p-3 text-sm" style={{ borderColor: 'var(--danger, #EF4444)', color: 'var(--danger, #EF4444)' }}>{error}</div>}
      {toast && <div className="card p-3 text-sm" style={{ borderColor: 'var(--success, #16A34A)', color: 'var(--success, #16A34A)' }}>{toast}</div>}

      <div className="card p-4 md:p-6" style={{ overflowX: 'auto' }}>
        {loading ? <p className="text-sm opacity-60">Loading schedule…</p> : !classroomId && !teacherId ? (
          <EmptyState illustration="classrooms" eyebrow="Timetable" title="Pick a classroom or teacher" description="Select a classroom to view or edit its weekly schedule, or a teacher to see their engagements." />
        ) : periods.length === 0 ? (
          <EmptyState illustration="attendance" eyebrow="Empty schedule" title="No periods configured" description="Click any cell below to add the first period. Period numbers and times are set per slot." />
        ) : (
          <table className="w-full text-sm" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th className="p-2 text-left opacity-60 w-28">Period</th>
                {DAYS.map((d) => <th key={d} className="p-2 text-left opacity-60">{DAY_SHORT[d]}</th>)}
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.n} className="border-t" style={{ borderColor: 'var(--border-default)' }}>
                  <td className="p-2">
                    <div className="font-semibold">P{p.n}</div>
                    <div className="text-xs opacity-60">{p.start}–{p.end}</div>
                  </td>
                  {DAYS.map((d) => {
                    const slot = getSlot(d, p.n)
                    const colorIdx = (slot?.subject?.id?.charCodeAt(0) || 0) % SLOT_COLORS.length
                    return (
                      <td key={d} className="p-1">
                        <div
                          role={canEdit ? 'button' : undefined}
                          tabIndex={canEdit ? 0 : undefined}
                          onClick={() => canEdit && openSlotEditor(d, p.n)}
                          onKeyDown={(e) => { if (canEdit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openSlotEditor(d, p.n) } }}
                          className="rounded-lg p-2 text-xs min-h-[52px] flex flex-col justify-center"
                          style={{
                            background: slot ? SLOT_COLORS[colorIdx] : 'transparent',
                            border: slot ? '1px solid var(--border-default)' : `1px dashed var(--border-default)`,
                            cursor: canEdit ? 'pointer' : 'default',
                          }}
                        >
                          {slot ? (
                            <>
                              <span className="font-semibold">{slot.label || slot.subject?.name || 'Free'}</span>
                              {slot.teacher && <span className="opacity-60">{slot.teacher.fullName}</span>}
                              {slot.label && slot.subject && <span className="opacity-60">{slot.subject.name}</span>}
                              <span className="opacity-50">{slot.startTime}</span>
                            </>
                          ) : (
                            <span className="opacity-40 text-center">{canEdit ? '+ add' : '—'}</span>
                          )}
                        </div>
                        {slot && canEdit && (
                          <button className="mt-1 text-xs opacity-50 hover:opacity-100 flex items-center gap-1 mx-auto" onClick={() => deleteSlot(slot.id)} aria-label="Delete slot">
                            <Trash2 size={11} /> remove
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showSlot} onClose={() => setShowSlot(false)} title={`Edit slot — ${DAY_SHORT[slotForm.day]} P${slotForm.periodNumber}`}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs block">From<input type="time" className="input w-full mt-1" value={slotForm.startTime} onChange={(e) => setSlotForm({ ...slotForm, startTime: e.target.value })} /></label>
            <label className="text-xs block">To<input type="time" className="input w-full mt-1" value={slotForm.endTime} onChange={(e) => setSlotForm({ ...slotForm, endTime: e.target.value })} /></label>
          </div>
          <label className="text-xs block">Subject
            <select className="input w-full mt-1" value={slotForm.subjectId} onChange={(e) => setSlotForm({ ...slotForm, subjectId: e.target.value })}>
              <option value="">— None / activity —</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="text-xs block">Teacher
            <select className="input w-full mt-1" value={slotForm.teacherId} onChange={(e) => setSlotForm({ ...slotForm, teacherId: e.target.value })}>
              <option value="">— None —</option>
              {teachers.map((t) => <option key={t.user.id} value={t.user.id}>{t.user.fullName}</option>)}
            </select>
          </label>
          <label className="text-xs block">Activity label (optional)
            <input className="input w-full mt-1" value={slotForm.label} onChange={(e) => setSlotForm({ ...slotForm, label: e.target.value })} placeholder="Lunch Break, Games, Nap Time" />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <TactileButton variant="secondary" size="md" onClick={() => setShowSlot(false)}>Cancel</TactileButton>
            <TactileButton variant="primary" size="md" onClick={saveSlot}>Save Slot</TactileButton>
          </div>
          {view === 'class' && (
            <div className="pt-2 text-xs" style={{ borderTop: '1px solid var(--border-default)' }}>
              <div className="flex items-center gap-2 pt-2">
                <Copy size={13} />
                <span>Copy entire day</span>
                <select className="input" style={{ width: 120 }} value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
                  <option value="">Source day…</option>
                  {DAYS.map((d) => <option key={d} value={d}>{DAY_SHORT[d]}</option>)}
                </select>
                <TactileButton variant="secondary" size="sm" onClick={copyDay} disabled={!copyFrom}>Copy to {DAY_SHORT[slotForm.day]}</TactileButton>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
