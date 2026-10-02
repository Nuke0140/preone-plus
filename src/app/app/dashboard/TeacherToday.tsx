'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CalendarCheck, Sparkles, CheckCircle2, AlertTriangle, Sun, Utensils, Moon,
  Bath, Palette, Baby, ArrowRight, Activity,
} from 'lucide-react'
import { PageHead, Skeleton, Avatar, EmptyState, StatusBadge } from '@/components/preone/ui'
import { Modal } from '@/components/preone/Modal'
import { useToast } from '@/components/preone/Toast'
import { timeAgo } from '@/lib/format'

interface TeacherData {
  today: string
  dayStatus: string
  attendanceExpected: boolean
  sections: {
    id: string; name: string; programType: string
    expected: number; present: number; absent: number; attendancePending: boolean
    students: { id: string; firstName: string; lastName: string | null; admissionNo: string }[]
  }[]
  actions: { attendancePending: boolean; careEventsToday: number; observationDue: boolean; followUpsOpen: number }
  followUps: { id: string; severity: string; domain: string; status: string; title: string; student: string | null; createdAt: string }[]
}

const CARE_ACTIONS = [
  { type: 'ARRIVAL', label: 'Arrival', icon: <Sun size={14} /> },
  { type: 'MEALS', label: 'Meal', icon: <Utensils size={14} /> },
  { type: 'NAP', label: 'Nap', icon: <Moon size={14} /> },
  { type: 'BATHROOM', label: 'Bathroom', icon: <Bath size={14} /> },
  { type: 'ACTIVITIES', label: 'Activity', icon: <Palette size={14} /> },
]

export function TeacherToday() {
  const toast = useToast()
  const [data, setData] = useState<TeacherData | null>(null)
  const [busy, setBusy] = useState(false)
  const [careFor, setCareFor] = useState<{ id: string; name: string } | null>(null)
  const [section, setSection] = useState('')

  const load = useCallback(async () => {
    const r = await fetch('/api/v1/teacher/today').then((r) => r.json())
    if (r.success) setData(r.data)
  }, [])

  useEffect(() => { load() }, [load])

  const quickCare = async (studentId: string, type: string) => {
    setBusy(true)
    const res = await fetch('/api/v1/care', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, type, mood: type === 'MOOD' ? 'Happy' : undefined }),
    })
    const json = await res.json()
    setBusy(false)
    if (json.success) {
      toast.success('Recorded on child timeline', 'Parents see it instantly — no extra data entry')
      load()
    } else toast.error('Failed', json.error?.message)
  }

  const resolveFu = async (id: string) => {
    const outcome = window.prompt('Outcome — kya action liya? kya result aaya?', '')
    if (!outcome?.trim()) return
    setBusy(true)
    const res = await fetch(`/api/v1/operations/follow-ups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve', outcome: outcome.trim() }),
    })
    const json = await res.json()
    setBusy(false)
    if (json.success) { toast.success('Follow-up resolved', outcome); load() }
    else toast.error('Failed', json.error?.message)
  }

  if (!data) {
    return (
      <>
        <PageHead title="Aaj ke actions" sub="Your class, your children, your day." />
        <Skeleton h={140} />
        <div style={{ height: 12 }} />
        <Skeleton h={300} />
      </>
    )
  }

  const dayClosed = !data.attendanceExpected

  return (
    <>
      <PageHead
        eyebrow="Teacher Daily Workspace"
        badge={<span className="badge b-primary b-dot">Classroom Care</span>}
        title="Aaj ke actions"
        sub={`${data.today} · ${data.sections.length} section(s) · ${data.actions.followUpsOpen} follow-ups open${dayClosed ? ' · SCHOOL CLOSED TODAY' : ''}`}
        actions={
          <>
            <Link className="btn btn-outline" href="/app/daily-diary?tab=observations"><Sparkles size={14} /> Observation {data.actions.observationDue ? '• due' : ''}</Link>
            <Link className="btn btn-primary" href="/app/daily-diary?tab=attendance"><CalendarCheck size={14} /> Attendance</Link>
          </>
        }
      />

      {dayClosed && (
        <div className="card" style={{ borderColor: 'var(--warning)', marginBottom: 16 }}>
          <b style={{ fontSize: 13.5 }}>School closed today ({data.dayStatus.replace(/_/g, ' ').toLowerCase()})</b>
          <p className="t-caption">Attendance is not expected — calendar + operating config se aaya hai.</p>
        </div>
      )}

      {data.sections.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Baby size={36} />}
            title="No sections assigned yet"
            message="Aapko koi class-section allocate nahi hui. Principal/Owner se apni assignment confirm karein (Setup → Teacher Assignment)."
          />
        </div>
      ) : (
        data.sections.map((s) => (
          <div className="card" key={s.id} style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div>
                <div className="card-title">{s.name} <span className="t-caption" style={{ fontWeight: 400 }}>· {s.programType}</span></div>
                <div className="card-sub">
                  {s.present}/{s.expected} present{s.absent > 0 ? ` · ${s.absent} absent` : ''}
                  {s.attendancePending && !dayClosed ? ' · attendance pending' : ''}
                </div>
              </div>
              {s.attendancePending && !dayClosed && (
                <Link className="btn btn-secondary btn-sm" href="/app/daily-diary?tab=attendance">
                  Mark now <ArrowRight size={12} />
                </Link>
              )}
            </div>

            {/* children row — minimal-tap care actions (Spec §40) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {s.students.map((st) => {
                const name = `${st.firstName} ${st.lastName || ''}`.trim()
                return (
                  <div key={st.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Avatar name={name} />
                    <b style={{ fontSize: 13, flex: '1 1 120px' }}>{name}</b>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {CARE_ACTIONS.map((a) => (
                        <button
                          key={a.type}
                          className="btn btn-ghost btn-sm"
                          disabled={busy}
                          title={`Record ${a.label}`}
                          onClick={() => quickCare(st.id, a.type)}
                        >
                          {a.icon}
                        </button>
                      ))}
                      <button
                        className="btn btn-outline btn-sm"
                        disabled={busy}
                        onClick={() => { setCareFor({ id: st.id, name }); setSection(s.id) }}
                      >
                        <Activity size={13} /> More
                      </button>
                    </div>
                  </div>
                )
              })}
              {s.students.length === 0 && <p className="t-caption">No children allocated to this section yet.</p>}
            </div>
          </div>
        ))
      )}

      {/* follow-ups assigned to me / my sections */}
      <div className="card">
        <div className="card-head">
          <div className="card-title">Meri follow-ups</div>
          <span className="badge b-neutral">{data.actions.followUpsOpen} open</span>
        </div>
        {data.followUps.length === 0 ? (
          <p className="t-caption">Kuch pending nahi — good job!</p>
        ) : (
          data.followUps.map((f) => (
            <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border-subtle)' }}>
              {f.severity === 'EMERGENCY' || f.severity === 'URGENT'
                ? <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />
                : <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />}
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: 13 }}>{f.title}</b>
                <div className="t-caption">{f.student ? `${f.student} · ` : ''}{f.domain} · {timeAgo(f.createdAt)}</div>
              </div>
              <StatusBadge status={f.status} />
              <button className="btn btn-success btn-sm" disabled={busy} onClick={() => resolveFu(f.id)}>
                <CheckCircle2 size={13} /> Resolve
              </button>
            </div>
          ))
        )}
      </div>

      {/* detailed care modal */}
      <Modal open={!!careFor} onClose={() => setCareFor(null)} title={`Daily record — ${careFor?.name || ''}`} subtitle="Config-driven daily sheet (DAILY_OPERATIONS)" wide>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            setBusy(true)
            const res = await fetch('/api/v1/care', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                studentId: careFor?.id,
                type: fd.get('type'),
                title: fd.get('title') || undefined,
                body: fd.get('body') || undefined,
                mood: fd.get('mood') || undefined,
                outcome: fd.get('outcome') || undefined,
                category: fd.get('category') || undefined,
              }),
            })
            const json = await res.json()
            setBusy(false)
            if (json.success) {
              const raised = json.data?.followUpsRaised?.length || 0
              toast.success('Saved', raised > 0 ? `${raised} health follow-up raised — principal alerted` : 'Timeline updated')
              setCareFor(null)
              load()
            } else toast.error('Failed', json.error?.message)
          }}
        >
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Record type</label>
            <select className="select" name="type" defaultValue="HEALTH_CHECK">
              <option value="ARRIVAL">Arrival</option>
              <option value="MEALS">Meal</option>
              <option value="NAP">Nap</option>
              <option value="BATHROOM">Bathroom</option>
              <option value="MOOD">Mood</option>
              <option value="ACTIVITIES">Activity</option>
              <option value="NOTE">Note</option>
              <option value="HEALTH_CHECK">Health check</option>
              <option value="INCIDENT">Incident</option>
              <option value="MILESTONE">Milestone</option>
            </select>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Outcome (health check)</label>
            <select className="select" name="outcome" defaultValue="">
              <option value="">—</option>
              <option value="NORMAL">Normal</option>
              <option value="ABNORMAL">Abnormal (raises urgent follow-up)</option>
            </select>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Incident category</label>
            <select className="select" name="category" defaultValue="">
              <option value="">—</option>
              <option value="MINOR_INJURY">Minor injury</option>
              <option value="FALL">Fall</option>
              <option value="ALLERGIC_REACTION">Allergic reaction</option>
              <option value="ILLNESS">Illness</option>
              <option value="EMERGENCY">Emergency</option>
            </select>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Title</label>
            <input className="input" name="title" placeholder="Ate full lunch, enjoyed outdoor play…" />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Details</label>
            <textarea className="textarea" name="body" style={{ minHeight: 80 }} placeholder="Short note — parents yahi dekhte hain." />
          </div>
          <div className="field">
            <label>Mood</label>
            <input className="input" name="mood" placeholder="Happy / Fussy / Sleepy" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setCareFor(null)}>Cancel</button>
            <button className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>Save record</button>
          </div>
        </form>
      </Modal>
    </>
  )
}
