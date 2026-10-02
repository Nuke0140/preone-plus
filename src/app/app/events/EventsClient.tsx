'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Breadcrumbs } from '@/components/preone/Breadcrumbs'
import { PageHead, KpiTile, StatusBadge } from '@/components/preone/ui'
import { TactileButton } from '@/components/preone/TactileMotion'
import { Modal } from '@/components/preone/Modal'
import { EmptyState } from '@/components/preone'
import { apiFetch, parseApiError } from '@/lib/client-api'
import { can } from '@/lib/auth'
import { Trophy, Plus, CalendarDays, MapPin, Users, Ticket, UserPlus, CheckCheck } from 'lucide-react'

interface EventRow {
  id: string
  title: string
  type: string
  description: string | null
  venue: string | null
  startsAt: string
  endsAt: string | null
  audience: string
  capacity: number | null
  registrationRequired: boolean
  registrationDeadline: string | null
  status: string
  registeredCount: number
  seatsLeft: number | null
}
interface RegistrationRow {
  id: string
  status: string
  registeredAt: string
  student: { id: string; admissionNo: string; firstName: string; lastName: string; currentClassroom: { id: string; name: string } | null }
}
interface StudentOption { id: string; firstName: string; lastName: string; admissionNo: string }

const TYPE_VARIANTS: Record<string, string> = {
  SPORTS: 'success', CULTURAL: 'warning', ACADEMIC: 'info', TRIP: 'info',
  COMPETITION: 'danger', CELEBRATION: 'warning', MEETING: 'neutral', WORKSHOP: 'neutral', OTHER: 'neutral',
}
const STATUS_VARIANTS: Record<string, string> = {
  SCHEDULED: 'info', ONGOING: 'warning', COMPLETED: 'success', CANCELLED: 'danger',
}
const REG_VARIANTS: Record<string, string> = {
  REGISTERED: 'info', WAITLISTED: 'warning', CANCELLED: 'danger', ATTENDED: 'success', ABSENT: 'danger',
}

function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export function EventsClient({ session }: { session: any }) {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [events, setEvents] = useState<EventRow[]>([])
  const [stats, setStats] = useState<any>(null)
  const [students, setStudents] = useState<StudentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    title: '', type: 'SPORTS', description: '', venue: '', startsAt: '', endsAt: '',
    audience: 'ALL', capacity: '', registrationRequired: false, registrationDeadline: '',
  })
  const [saving, setSaving] = useState(false)

  // registrations drawer
  const [detail, setDetail] = useState<{ event: EventRow; registrations: RegistrationRow[] } | null>(null)
  const [regStudentId, setRegStudentId] = useState('')

  const canWrite = can((session?.roles as any)?.length ? session.roles : [session?.role], 'events:write')

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, st] = await Promise.all([
        apiFetch<any[]>('/api/v1/events'),
        apiFetch<any>('/api/v1/events?stats=1'),
      ])
      setEvents(Array.isArray(list?.data) ? list.data : [])
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

  const createEvent = async () => {
    if (!form.title.trim() || !form.startsAt) {
      setError('Title and start time are required')
      setSaving(false)
      return
    }
    setSaving(true)
    try {
      await apiFetch('/api/v1/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          capacity: form.capacity ? Number(form.capacity) : undefined,
        }),
      })
      setShowCreate(false)
      setForm({ title: '', type: 'SPORTS', description: '', venue: '', startsAt: '', endsAt: '', audience: 'ALL', capacity: '', registrationRequired: false, registrationDeadline: '' })
      flash('Event created')
      await load()
    } catch (err) {
      setError(parseApiError(err).message)
    } finally {
      setSaving(false)
    }
  }

  const openRegistrations = async (ev: EventRow) => {
    try {
      const regs = await apiFetch<any[]>(`/api/v1/events/${ev.id}/registrations`)
      setDetail({ event: ev, registrations: Array.isArray(regs?.data) ? regs.data : [] })
      setRegStudentId('')
    } catch (err) {
      setError(parseApiError(err).message)
    }
  }

  const register = async (eventId: string) => {
    if (!regStudentId) { flash('Select a student first'); return }
    try {
      await apiFetch(`/api/v1/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', studentId: regStudentId }),
      })
      flash('Student registered')
      setRegStudentId('')
      const ev = detail?.event
      if (ev) {
        const regs = await apiFetch<any[]>(`/api/v1/events/${eventId}/registrations`)
        setDetail({ event: ev, registrations: Array.isArray(regs?.data) ? regs.data : [] })
      }
      await load()
    } catch (err) {
      setError(parseApiError(err).message)
    }
  }

  const markAttendance = async (eventId: string, studentId: string, attended: boolean) => {
    try {
      await apiFetch(`/api/v1/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-attendance', studentId, attended }),
      })
      const regs = await apiFetch<any[]>(`/api/v1/events/${eventId}/registrations`)
      setDetail((d) => (d ? { ...d, registrations: Array.isArray(regs?.data) ? regs.data : [] } : d))
      await load()
    } catch (err) {
      setError(parseApiError(err).message)
    }
  }

  const now = new Date()
  const filtered = events.filter((ev) =>
    tab === 'upcoming' ? new Date(ev.startsAt) >= now && ev.status !== 'CANCELLED' : new Date(ev.startsAt) < now || ev.status === 'CANCELLED'
  )

  const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'
  const labelCls = 'text-xs font-semibold text-muted-foreground uppercase tracking-wide'

  return (
    <div className="p-4 md:p-6 space-y-5">
      <Breadcrumbs items={[{ label: 'Home', href: '/app/home' }, { label: 'Events & Activities' }]} />
      <PageHead
        eyebrow="School Life"
        title="Events & Activities"
        description="Sports day, cultural fests, trips, competitions and workshops"
        actions={canWrite ? (
          <TactileButton onClick={() => setShowCreate(true)}><Plus size={16} /> Create Event</TactileButton>
        ) : undefined}
      />

      {error && <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">{error}</div>}
      {toast && <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{toast}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Total Events" value={stats?.total ?? '—'} icon={<Trophy size={18} />} iconClass="g-yellow" />
        <KpiTile label="Upcoming" value={stats?.upcoming ?? '—'} icon={<CalendarDays size={18} />} iconClass="g-sky" />
        <KpiTile label="Ongoing" value={stats?.ongoing ?? '—'} icon={<Ticket size={18} />} iconClass="g-orange" />
        <KpiTile label="Registrations" value={stats?.registrations ?? '—'} icon={<Users size={18} />} iconClass="g-purple" />
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-card p-1 w-fit">
        {([
          { key: 'upcoming', label: 'Upcoming' },
          { key: 'past', label: 'Past & Cancelled' },
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

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading events…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <EmptyState icon={<Trophy size={40} />} title={tab === 'upcoming' ? 'No upcoming events' : 'No past events'} description={canWrite ? 'Create your first school event' : 'School events will appear here'} />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((ev) => {
            const full = ev.seatsLeft === 0
            return (
              <div key={ev.id} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{ev.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {fmtDateTime(ev.startsAt)}</span>
                      {ev.venue && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {ev.venue}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge label={ev.type} variant={(TYPE_VARIANTS[ev.type] ?? 'neutral') as any} />
                    <StatusBadge label={ev.status} variant={(STATUS_VARIANTS[ev.status] ?? 'neutral') as any} />
                  </div>
                </div>
                {ev.description && <p className="text-sm text-muted-foreground line-clamp-2">{ev.description}</p>}
                {ev.registrationRequired && (
                  <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-xs">
                    <span className="text-muted-foreground">Registrations</span>
                    <span className={`font-semibold tabular-nums ${full ? 'text-red-600' : 'text-foreground'}`}>
                      {ev.registeredCount}{ev.capacity ? ` / ${ev.capacity}` : ''}{full ? ' · FULL' : ''}
                    </span>
                  </div>
                )}
                <div className="mt-auto flex items-center justify-between pt-1">
                  <button className="text-xs font-medium text-primary hover:underline" onClick={() => openRegistrations(ev)}>
                    {ev.registrationRequired ? 'Manage registrations' : 'View details'}
                  </button>
                  {ev.registrationDeadline && <span className="text-[11px] text-muted-foreground">Deadline: {fmtDateTime(ev.registrationDeadline)}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create event modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Event" width="max-w-xl">
        <div className="space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Title *</label>
              <input className={`${inputCls} mt-1`} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Annual Sports Day 2026" />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select className={`${inputCls} mt-1`} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {['SPORTS', 'CULTURAL', 'ACADEMIC', 'TRIP', 'COMPETITION', 'CELEBRATION', 'MEETING', 'WORKSHOP', 'OTHER'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Starts at *</label>
              <input type="datetime-local" className={`${inputCls} mt-1`} value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Ends at</label>
              <input type="datetime-local" className={`${inputCls} mt-1`} value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Venue</label>
              <input className={`${inputCls} mt-1`} value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="Main ground / Auditorium" />
            </div>
            <div>
              <label className={labelCls}>Audience</label>
              <select className={`${inputCls} mt-1`} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                {['ALL', 'STUDENTS', 'PARENTS', 'STAFF'].map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea className={`${inputCls} mt-1 min-h-[4rem]`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Capacity</label>
              <input type="number" min={1} className={`${inputCls} mt-1`} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="Unlimited if empty" />
            </div>
            <div>
              <label className={labelCls}>Registration deadline</label>
              <input type="datetime-local" className={`${inputCls} mt-1`} value={form.registrationDeadline} onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.registrationRequired} onChange={(e) => setForm({ ...form, registrationRequired: e.target.checked })} />
            Registration required
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <TactileButton variant="ghost" onClick={() => setShowCreate(false)}>Cancel</TactileButton>
            <TactileButton onClick={createEvent} disabled={saving}>{saving ? 'Creating…' : 'Create Event'}</TactileButton>
          </div>
        </div>
      </Modal>

      {/* Registrations modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Registrations — ${detail.event.title}` : ''} width="max-w-3xl">
        {detail && (
          <div className="space-y-4">
            {canWrite && detail.event.registrationRequired && detail.event.status === 'SCHEDULED' && (
              <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
                <div className="flex-1 min-w-[14rem]">
                  <label className={labelCls}>Register student</label>
                  <select className={`${inputCls} mt-1`} value={regStudentId} onChange={(e) => setRegStudentId(e.target.value)}>
                    <option value="">Select student</option>
                    {students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNo})</option>)}
                  </select>
                </div>
                <TactileButton onClick={() => register(detail.event.id)}><UserPlus size={14} /> Register</TactileButton>
              </div>
            )}
            <div className="max-h-[55vh] overflow-y-auto space-y-2">
              {detail.registrations.length === 0 && (
                <EmptyState icon={<Users size={36} />} title="No registrations yet" description={detail.event.registrationRequired ? 'Register students using the form above' : 'This event does not require registration'} />
              )}
              {detail.registrations.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
                  <div>
                    <div className="font-medium text-sm">{r.student.firstName} {r.student.lastName}</div>
                    <div className="text-xs text-muted-foreground">{r.student.admissionNo} · {r.student.currentClassroom?.name ?? '—'} · {fmtDateTime(r.registeredAt)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge label={r.status} variant={(REG_VARIANTS[r.status] ?? 'neutral') as any} />
                    {canWrite && ['REGISTERED'].includes(r.status) && (
                      <button className="text-xs font-medium text-emerald-600 hover:underline inline-flex items-center gap-1" onClick={() => markAttendance(detail.event.id, r.student.id, true)}>
                        <CheckCheck size={12} /> Present
                      </button>
                    )}
                    {canWrite && ['REGISTERED'].includes(r.status) && (
                      <button className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline" onClick={() => markAttendance(detail.event.id, r.student.id, false)}>
                        Absent
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
