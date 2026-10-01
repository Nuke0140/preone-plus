'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Baby, AlertTriangle, Wallet, Sparkles, CalendarCheck } from 'lucide-react'
import { PageHead, Skeleton, Avatar, EmptyState, StatusBadge } from '@/components/preone/ui'
import { inr, timeAgo } from '@/lib/format'

interface ChildData {
  id: string
  name: string
  admissionNo: string
  photoUrl: string | null
  classroom: string | null
  teacher: string | null
  attendance: string | null
  todayCare: { type: string; title: string; body: string | null; mood: string | null; at: string }[]
  latestUpdate: { narrative: string; observedAt: string; category: string | null } | null
  feesDue: { invoiceNumber: string; dueDate: string; balanceCents: number; status: string }[]
  alerts: { title: string; severity: string; createdAt: string }[]
}

export function ParentToday() {
  const [data, setData] = useState<{ today: string; children: ChildData[] } | null>(null)

  const load = useCallback(async () => {
    const r = await fetch('/api/v1/parent/today').then((r) => r.json())
    if (r.success) setData(r.data)
  }, [])

  useEffect(() => { load() }, [load])

  if (!data) {
    return (
      <>
        <PageHead title="Mera bachcha" sub="How is my child doing today?" />
        <Skeleton h={300} />
      </>
    )
  }

  return (
    <>
      <PageHead
        eyebrow="Parent Connect"
        badge={<span className="badge b-primary b-dot">Child Profile</span>}
        title="Mera bachcha"
        sub={`${data.today} — aaj ka din, care se learning tak.`}
      />

      {data.children.length === 0 && (
        <div className="card">
          <EmptyState
            icon={<Baby size={36} />}
            title="No children linked"
            message="Aapke account se koi child link nahi hai. School admin se contact karein."
          />
        </div>
      )}

      {data.children.map((c) => (
        <div className="card" key={c.id} style={{ marginBottom: 16 }}>
          <div className="card-head">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Avatar name={c.name} size="lg" />
              <div>
                <div className="card-title">{c.name}</div>
                <div className="card-sub">
                  {c.classroom ?? '—'}{c.teacher ? ` · ${c.teacher}` : ''}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {c.attendance
                ? <StatusBadge status={c.attendance} />
                : <span className="badge b-neutral">Attendance pending</span>}
            </div>
          </div>

          {c.alerts.length > 0 && (
            <div style={{ background: 'color-mix(in srgb, var(--danger) 8%, transparent)', borderRadius: 12, padding: '10px 14px', marginBottom: 12 }}>
              {c.alerts.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <AlertTriangle size={14} style={{ color: 'var(--danger)' }} />
                  <b style={{ fontSize: 12.5 }}>{a.title}</b>
                  <span className="t-caption">{timeAgo(a.createdAt)}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {/* TODAY — care */}
            <div>
              <b style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}>
                <CalendarCheck size={13} /> Aaj ka din
              </b>
              {c.todayCare.length === 0 ? (
                <p className="t-caption" style={{ marginTop: 6 }}>Aaj koi care update nahi — school day shuru hote hi dikhega.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {c.todayCare.map((e, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8 }}>
                      <span className="badge b-neutral" style={{ height: 20, fontSize: 10.5 }}>{e.type}</span>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 12.5 }}>{e.title}{e.mood ? ` · ${e.mood}` : ''}</span>
                        <div className="t-caption">{timeAgo(e.at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* LEARNING */}
            <div>
              <b style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}>
                <Sparkles size={13} /> Teacher update
              </b>
              {c.latestUpdate ? (
                <div style={{ marginTop: 8 }}>
                  <p className="t-caption" style={{ fontSize: 12.5 }}>{c.latestUpdate.narrative}</p>
                  <div className="t-caption" style={{ marginTop: 4 }}>
                    {c.latestUpdate.category ? `${c.latestUpdate.category} · ` : ''}{timeAgo(c.latestUpdate.observedAt)}
                  </div>
                </div>
              ) : (
                <p className="t-caption" style={{ marginTop: 6 }}>Published observations yahan dikhenge.</p>
              )}
              <Link className="btn btn-ghost btn-sm" href="/app/timeline" style={{ marginTop: 8 }}>
                Full child timeline
              </Link>
            </div>

            {/* FEES */}
            <div>
              <b style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}>
                <Wallet size={13} /> Fees
              </b>
              {c.feesDue.length === 0 ? (
                <p className="t-caption" style={{ marginTop: 6 }}>Sab clear — koi outstanding nahi.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {c.feesDue.map((f) => (
                    <div key={f.invoiceNumber} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <b style={{ fontSize: 12.5 }}>{f.invoiceNumber}</b>
                      <StatusBadge status={f.status} />
                      <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 700 }}>{inr(f.balanceCents)}</span>
                    </div>
                  ))}
                  <Link className="btn btn-secondary btn-sm" href="/app/finance" style={{ alignSelf: 'flex-start' }}>
                    Pay / view invoices
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
