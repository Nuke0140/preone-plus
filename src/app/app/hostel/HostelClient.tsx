'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Breadcrumbs } from '@/components/preone/Breadcrumbs'
import { PageHead, KpiTile, StatusBadge } from '@/components/preone/ui'
import { TactileButton } from '@/components/preone/TactileMotion'
import { Modal } from '@/components/preone/Modal'
import { EmptyState } from '@/components/preone'
import { apiFetch, parseApiError } from '@/lib/client-api'
import { BedDouble, Plus, DoorOpen, LogOut, Building2, Users2, Gauge } from 'lucide-react'

interface Room {
  id: string; roomNumber: string; block: string | null; floor: string | null; roomType: string
  capacity: number; occupied: number; status: string; monthlyFeeCents: number | null; notes: string | null
  branch: { id: string; name: string }
}
interface Allocation {
  id: string; status: string; allocatedAt: string; vacatedAt: string | null; bedNumber: string | null
  room: { id: string; roomNumber: string; block: string | null; roomType: string; monthlyFeeCents: number | null }
  student: { id: string; admissionNo: string; firstName: string; lastName: string | null; currentClassroom?: { name: string } | null }
}
interface Branch { id: string; name: string }
interface Student { id: string; admissionNo: string; firstName: string; lastName: string | null }

const fmtINR = (cents: number | null) => (cents != null ? `₹${(cents / 100).toLocaleString('en-IN')}/mo` : '—')

export function HostelClient({ session }: { session: any }) {
  const [tab, setTab] = useState<'rooms' | 'allocations'>('rooms')
  const [rooms, setRooms] = useState<Room[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [stats, setStats] = useState<any>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const [showRoom, setShowRoom] = useState(false)
  const [roomForm, setRoomForm] = useState({ branchId: '', roomNumber: '', block: '', floor: '', roomType: 'SHARING', capacity: '4', monthlyFee: '' })

  const [showAlloc, setShowAlloc] = useState(false)
  const [allocForm, setAllocForm] = useState({ roomId: '', studentId: '', bedNumber: '' })

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000) }

  const load = useCallback(async () => {
    setLoading(true)
    const [r, a, d, b] = await Promise.all([
      apiFetch<Room[]>('/api/v1/hostel/rooms'),
      apiFetch<Allocation[]>('/api/v1/hostel/allocations'),
      apiFetch<any>('/api/v1/hostel/rooms?meta=dashboard'),
      apiFetch<{ items?: Branch[] } | Branch[]>('/api/v1/branches'),
    ])
    if (r.success && r.data) setRooms(r.data)
    else setError(parseApiError(r).message)
    if (a.success && a.data) setAllocations(a.data)
    if (d.success && d.data) setStats(d.data)
    if (b.success && b.data) setBranches(Array.isArray(b.data) ? b.data : b.data.items || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    apiFetch<any>('/api/v1/students?pageSize=500').then((r) => {
      if (r.success && r.data) {
        const payload: any = r.data
        setStudents(Array.isArray(payload) ? payload : payload?.data || payload?.items || [])
      }
    })
  }, [load])

  const addRoom = async () => {
    setError('')
    const monthly = roomForm.monthlyFee ? Math.round(parseFloat(roomForm.monthlyFee) * 100) : undefined
    const r = await apiFetch('/api/v1/hostel/rooms', {
      method: 'POST',
      body: JSON.stringify({ ...roomForm, capacity: Number(roomForm.capacity), monthlyFeeCents: monthly }),
    })
    if (r.success) {
      setShowRoom(false)
      setRoomForm({ branchId: '', roomNumber: '', block: '', floor: '', roomType: 'SHARING', capacity: '4', monthlyFee: '' })
      flash('Room added')
      load()
    } else setError(parseApiError(r).message)
  }

  const allocate = async () => {
    setError('')
    const r = await apiFetch('/api/v1/hostel/allocations', { method: 'POST', body: JSON.stringify(allocForm) })
    if (r.success) {
      setShowAlloc(false)
      setAllocForm({ roomId: '', studentId: '', bedNumber: '' })
      flash('Student allocated')
      load()
    } else setError(parseApiError(r).message)
  }

  const vacate = async (al: Allocation) => {
    setError('')
    const r = await apiFetch(`/api/v1/hostel/allocations/${al.id}/vacate`, { method: 'POST', body: JSON.stringify({}) })
    if (r.success) { flash(`${al.student.firstName} vacated`); load() }
    else setError(parseApiError(r).message)
  }

  const activeAllocations = allocations.filter((a) => a.status === 'ACTIVE')
  const availableRooms = rooms.filter((r) => r.occupied < r.capacity && r.status !== 'MAINTENANCE')

  return (
    <div className="page-shell space-y-6">
      <Breadcrumbs items={[{ label: 'Home', href: '/app/home' }, { label: 'Hostel' }]} />
      <PageHead
        eyebrow="PreOne Plus"
        title="Hostel"
        description="Room inventory, blocks, student residency and occupancy tracking"
        backHref="/app/home"
        actions={<TactileButton variant="primary" size="md" onClick={() => setShowRoom(true)}><Plus size={16} className="mr-1.5" />Add Room</TactileButton>}
      />

      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <KpiTile label="Total Rooms" value={stats.totalRooms} icon={<Building2 size={18} />} iconClass="ic-purple" />
          <KpiTile label="Capacity" value={stats.totalCapacity} icon={<BedDouble size={18} />} iconClass="ic-green" />
          <KpiTile label="Residents" value={stats.activeResidents} icon={<Users2 size={18} />} iconClass="ic-orange" />
          <KpiTile label="Occupancy" value={`${stats.occupancyPct}%`} icon={<Gauge size={18} />} iconClass="ic-red" />
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {([['rooms', 'Rooms', <BedDouble size={14} key="r" />], ['allocations', 'Residency', <DoorOpen size={14} key="a" />]] as const).map(([k, label, icon]) => (
          <button key={k} onClick={() => setTab(k as any)} className={`btn btn-sm ${tab === k ? 'btn-primary' : 'btn-ghost'}`} style={{ border: '1px solid var(--border-default)' }}>{icon} {label}</button>
        ))}
        {tab === 'allocations' && (
          <TactileButton variant="primary" size="sm" className="ml-auto" onClick={() => setShowAlloc(true)}><Plus size={14} className="mr-1" />Allocate Room</TactileButton>
        )}
      </div>

      {error && <div className="card p-3 text-sm" style={{ borderColor: 'var(--danger, #EF4444)', color: 'var(--danger, #EF4444)' }}>{error}</div>}
      {toast && <div className="card p-3 text-sm" style={{ borderColor: 'var(--success, #16A34A)', color: 'var(--success, #16A34A)' }}>{toast}</div>}

      {tab === 'rooms' && (
        <div className="card p-4 md:p-6">
          {loading ? <p className="text-sm opacity-60">Loading rooms…</p> : rooms.length === 0 ? (
            <EmptyState illustration="classrooms" eyebrow="No rooms" title="Set up your hostel" description="Add rooms with block, floor, capacity and monthly fee. Then allocate resident students." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rooms.map((r) => {
                const pct = r.capacity > 0 ? Math.round((r.occupied / r.capacity) * 100) : 0
                return (
                  <div key={r.id} className="p-4 rounded-xl" style={{ border: '1px solid var(--border-default)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold">Room {r.roomNumber}</h4>
                        <p className="text-xs opacity-60">{r.block || 'Main'}{r.floor ? ` · ${r.floor}` : ''} · {r.roomType}</p>
                        <p className="text-xs opacity-60">{r.branch?.name} · {fmtINR(r.monthlyFeeCents)}</p>
                      </div>
                      <StatusBadge
                        label={r.status}
                        variant={r.status === 'AVAILABLE' ? 'success' : r.status === 'FULL' ? 'warning' : 'danger'}
                      />
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between text-xs opacity-60 mb-1">
                        <span>{r.occupied} / {r.capacity} occupied</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: 'var(--border-default, #E5E7EB)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--warning, #D97706)' : 'var(--success, #16A34A)' }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'allocations' && (
        <div className="card p-4 md:p-6">
          {loading ? <p className="text-sm opacity-60">Loading residency…</p> : allocations.length === 0 ? (
            <EmptyState illustration="students" eyebrow="No allocations" title="No students in residence" description="Allocate students to rooms. One active room per student; capacity is enforced atomically." />
          ) : (
            <div className="max-h-[520px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-left opacity-60">
                    <th className="py-2 pr-2">Student</th>
                    <th className="py-2 pr-2">Class</th>
                    <th className="py-2 pr-2">Room</th>
                    <th className="py-2 pr-2">Bed</th>
                    <th className="py-2 pr-2">Since</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((a) => (
                    <tr key={a.id} className="border-t" style={{ borderColor: 'var(--border-default)' }}>
                      <td className="py-2 pr-2 font-medium">{a.student.firstName} {a.student.lastName || ''} <span className="opacity-50 text-xs">{a.student.admissionNo}</span></td>
                      <td className="py-2 pr-2 opacity-70">{a.student.currentClassroom?.name || '—'}</td>
                      <td className="py-2 pr-2">{a.room.roomNumber}{a.room.block ? ` (${a.room.block})` : ''}</td>
                      <td className="py-2 pr-2">{a.bedNumber || '—'}</td>
                      <td className="py-2 pr-2">{new Date(a.allocatedAt).toLocaleDateString('en-IN')}</td>
                      <td className="py-2 pr-2"><StatusBadge label={a.status} variant={a.status === 'ACTIVE' ? 'success' : 'neutral'} /></td>
                      <td className="py-2">
                        {a.status === 'ACTIVE' && (
                          <TactileButton variant="secondary" size="sm" onClick={() => vacate(a)}><LogOut size={13} className="mr-1" />Vacate</TactileButton>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add room modal */}
      <Modal open={showRoom} onClose={() => setShowRoom(false)} title="Add Hostel Room">
        <div className="space-y-3">
          <label className="text-xs block">Branch *
            <select className="input w-full mt-1" value={roomForm.branchId} onChange={(e) => setRoomForm({ ...roomForm, branchId: e.target.value })}>
              <option value="">Select branch…</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs block">Room number *<input className="input w-full mt-1" value={roomForm.roomNumber} onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })} placeholder="101" /></label>
            <label className="text-xs block">Block<input className="input w-full mt-1" value={roomForm.block} onChange={(e) => setRoomForm({ ...roomForm, block: e.target.value })} placeholder="A" /></label>
            <label className="text-xs block">Floor<input className="input w-full mt-1" value={roomForm.floor} onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })} placeholder="Ground" /></label>
            <label className="text-xs block">Room type
              <select className="input w-full mt-1" value={roomForm.roomType} onChange={(e) => setRoomForm({ ...roomForm, roomType: e.target.value })}>
                {['SHARING', 'PRIVATE', 'DORMITORY'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="text-xs block">Capacity *<input type="number" min={1} max={50} className="input w-full mt-1" value={roomForm.capacity} onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })} /></label>
            <label className="text-xs block">Monthly fee (₹)<input type="number" min={0} className="input w-full mt-1" value={roomForm.monthlyFee} onChange={(e) => setRoomForm({ ...roomForm, monthlyFee: e.target.value })} placeholder="2500" /></label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <TactileButton variant="secondary" size="md" onClick={() => setShowRoom(false)}>Cancel</TactileButton>
            <TactileButton variant="primary" size="md" onClick={addRoom} disabled={!roomForm.branchId || !roomForm.roomNumber}>Add Room</TactileButton>
          </div>
        </div>
      </Modal>

      {/* Allocate modal */}
      <Modal open={showAlloc} onClose={() => setShowAlloc(false)} title="Allocate Room">
        <div className="space-y-3">
          <label className="text-xs block">Room *
            <select className="input w-full mt-1" value={allocForm.roomId} onChange={(e) => setAllocForm({ ...allocForm, roomId: e.target.value })}>
              <option value="">Select an available room…</option>
              {availableRooms.map((r) => (
                <option key={r.id} value={r.id}>Room {r.roomNumber} {r.block ? `(${r.block})` : ''} — {r.capacity - r.occupied} free</option>
              ))}
            </select>
          </label>
          <label className="text-xs block">Student *
            <select className="input w-full mt-1" value={allocForm.studentId} onChange={(e) => setAllocForm({ ...allocForm, studentId: e.target.value })}>
              <option value="">Select student…</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName || ''} ({s.admissionNo})</option>)}
            </select>
          </label>
          <label className="text-xs block">Bed number<input className="input w-full mt-1" value={allocForm.bedNumber} onChange={(e) => setAllocForm({ ...allocForm, bedNumber: e.target.value })} placeholder="B1 (optional)" /></label>
          <p className="text-xs opacity-50">One active room per student. Vacate the current room first to re-allocate.</p>
          <div className="flex justify-end gap-2 pt-2">
            <TactileButton variant="secondary" size="md" onClick={() => setShowAlloc(false)}>Cancel</TactileButton>
            <TactileButton variant="primary" size="md" onClick={allocate} disabled={!allocForm.roomId || !allocForm.studentId}>Allocate</TactileButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
