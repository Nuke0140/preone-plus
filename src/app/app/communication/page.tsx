'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Megaphone, Plus } from 'lucide-react'
import { PageHead, EmptyState, StatusBadge, Skeleton } from '@/components/preone/ui'
import { Modal } from '@/components/preone/Modal'
import { useToast } from '@/components/preone/Toast'
import { timeAgo, enumLabel } from '@/lib/format'

interface Announcement {
  id: string
  title: string
  body: string
  type: string
  audience: string
  publishedAt: string
}

export default function CommunicationPage() {
  const toast = useToast()
  const [items, setItems] = useState<Announcement[] | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [classrooms, setClassrooms] = useState<{ id: string; name: string }[]>([])
  const [audience, setAudience] = useState('SCHOOL_WIDE')

  const load = useCallback(async () => {
    const j = await fetch('/api/v1/announcements').then((r) => r.json())
    if (j.success) setItems(j.data)
  }, [])

  useEffect(() => {
    Promise.resolve().then(load)
    fetch('/api/v1/classrooms').then((r) => r.json()).then((j) => {
      if (j.success) setClassrooms(j.data)
    })
  }, [load])

  const create = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    const res = await fetch('/api/v1/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: fd.get('title'),
        body: fd.get('body'),
        type: fd.get('type'),
        audience: fd.get('audience'),
        classroomId: fd.get('classroomId') || undefined,
      }),
    })
    const json = await res.json()
    setBusy(false)
    if (json.success) {
      toast.success('Announcement published', 'Push + timeline par parents tak pahunch gaya')
      setOpen(false)
      load()
    } else toast.error('Failed', json.error?.message)
  }

  return (
    <div className="page-container">
      <PageHead
        title="Announcements"
        sub="School-wide aur class-level broadcasts — instant delivery."
        actions={
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            <Plus size={15} /> New Announcement
          </button>
        }
      />

      {items === null && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[...Array(4)].map((_, i) => <Skeleton key={i} h={64} />)}
        </div>
      )}

      {items?.length === 0 && (
        <div className="card">
          <EmptyState
            icon={<Megaphone size={40} />}
            title="No announcements yet"
            message="Share holiday notices, event invites and fee reminders — they reach parents instantly."
            action={<button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Create first announcement</button>}
          />
        </div>
      )}

      {items && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((a) => (
            <div className="card card-hover" key={a.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div className="kpi-ic ic-orange" style={{ flex: 'none' }}><Megaphone size={18} /></div>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <b style={{ fontSize: 14.5 }}>{a.title}</b>
                      <StatusBadge status={a.type} />
                    </div>
                    <p className="t-body" style={{ marginTop: 4 }}>{a.body}</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flex: 'none' }}>
                  <span className="badge b-neutral">{enumLabel(a.audience)}</span>
                  <div className="t-caption" style={{ marginTop: 6 }}>{timeAgo(a.publishedAt)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New Announcement" subtitle="Parents ko push notification + timeline entry jaayegi" icon={<Megaphone size={22} />} wide>
        <form onSubmit={create}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Title <span className="req">*</span></label>
            <input className="input" name="title" required placeholder="PTM this Saturday" />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Message <span className="req">*</span></label>
            <textarea className="textarea" name="body" required placeholder="Dear parents, we are hosting…" />
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Type</label>
              <select className="select" name="type" defaultValue="GENERAL">
                {['GENERAL','EVENT','HOLIDAY','EMERGENCY','ACHIEVEMENT','FEE_REMINDER','ACADEMIC','IMPORTANT'].map((t) => (
                  <option key={t} value={t}>{enumLabel(t)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Audience</label>
              <select className="select" name="audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
                <option value="SCHOOL_WIDE">School-wide</option>
                <option value="ALL_PARENTS">All parents</option>
                <option value="CLASS_PARENTS">Specific class</option>
                <option value="ALL_STAFF">All staff</option>
              </select>
            </div>
            {audience === 'CLASS_PARENTS' && (
              <div className="field">
                <label>Classroom</label>
                <select className="select" name="classroomId" defaultValue="">
                  <option value="">Select class</option>
                  {classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className={`btn btn-primary ${busy ? 'is-loading' : ''}`} disabled={busy}>Publish</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
