'use client'

import React from 'react'
import Link from 'next/link'
import {
  Users, CalendarCheck, Wallet, ClipboardList, ArrowRight, Activity, School, Plus, CheckCircle2,
} from 'lucide-react'
import { PageHead, KpiTile } from '@/components/preone/ui'
import { LineChart, BarChart } from '@/components/preone/Chart'
import { inr, timeAgo, enumLabel } from '@/lib/format'

interface Props {
  role: string
  perms: { students: boolean; admissions: boolean; finance: boolean; attendance: boolean }
  data: {
    activeStudents: number
    presentToday: number
    attendancePct: number
    billed: number
    collected: number
    overdue: number
    collectRate: number
    pendingApps: number
    newLeads: number
    classrooms: { name: string; programType: string; students: number; capacity: number }[]
    trend: { label: string; pct: number }[]
    recentActivity: { summary: string; actor: string | null; at: string }[]
  }
}

export function DashboardClient({ role, perms, data }: Props) {
  const maxTrend = Math.max(...data.trend.map((t) => t.pct), 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── 1. Operational Command Center Hero ── */}
      <div className="operational-hero">
        <div className="operational-hero-head">
          <div>
            <div className="page-eyebrow">Preschool Operations Command</div>
            <h1 className="operational-hero-title">
              Namaste, {role === 'TEACHER' ? 'Teacher' : role === 'PARENT' ? 'Parent' : 'Administrator'}!
            </h1>
            <p className="operational-hero-sub">
              Aapke school ka live operational pulse — today&apos;s attendance, enrolled students, collection rate, and critical workflows.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge b-primary b-dot">Active Academic Session</span>
          </div>
        </div>

        {/* ── Unified Operational Pulse Strip (No Floating Cards) ── */}
        <div className="metric-strip" style={{ marginTop: 16 }}>
          {perms.students && (
            <div className="metric-cell">
              <div className="m-top">
                <span className="m-lbl">Active Students</span>
                <Users size={16} style={{ color: 'var(--primary)' }} />
              </div>
              <div className="m-val m-highlight">{data.activeStudents}</div>
              <div className="m-meta">{data.classrooms.length} active classrooms</div>
            </div>
          )}

          {perms.attendance && (
            <div className="metric-cell">
              <div className="m-top">
                <span className="m-lbl">Present Today</span>
                <CalendarCheck size={16} style={{ color: 'var(--success)' }} />
              </div>
              <div className="m-val m-success">{data.presentToday}</div>
              <div className="m-meta">{data.attendancePct}% daily attendance</div>
            </div>
          )}

          {perms.finance && (
            <div className="metric-cell">
              <div className="m-top">
                <span className="m-lbl">Fees Collected</span>
                <Wallet size={16} style={{ color: 'var(--warning)' }} />
              </div>
              <div className="m-val">{inr(data.collected, { compact: true })}</div>
              <div className="m-meta">{data.collectRate}% of {inr(data.billed, { compact: true })} billed</div>
            </div>
          )}

          {perms.admissions && (
            <div className="metric-cell">
              <div className="m-top">
                <span className="m-lbl">Admissions Pipeline</span>
                <ClipboardList size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <div className="m-val">{data.pendingApps}</div>
              <div className="m-meta">{data.newLeads} new leads to call</div>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Quick Action Launchpad ── */}
      <div className="quick-action-strip">
        <span className="strip-label">Quick Actions:</span>
        {perms.attendance && (
          <Link href="/app/daily-diary?tab=attendance" className="btn-action">
            <CalendarCheck size={14} /> Mark Attendance
          </Link>
        )}
        {perms.students && (
          <Link href="/app/students" className="btn-action">
            <Plus size={14} /> Enroll Child
          </Link>
        )}
        {perms.finance && (
          <Link href="/app/finance" className="btn-action">
            <Wallet size={14} /> Fee Manager
          </Link>
        )}
        {perms.admissions && (
          <Link href="/app/admissions" className="btn-action">
            <ClipboardList size={14} /> Review Pipeline
          </Link>
        )}
      </div>

      {/* ── 3. Operational Analytics Workspace ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }} className="dash-grid">
        {/* Attendance trend chart */}
        {perms.attendance && (
          <div className="card card-hover">
            <div className="card-head">
              <div>
                <div className="card-title">Weekly Attendance Dynamics</div>
                <div className="card-sub">Daily present % across all classrooms</div>
              </div>
              <span className="badge b-success b-dot">Live Feed</span>
            </div>
            <div style={{ padding: '8px 4px' }}>
              <LineChart
                data={data.trend.map((t) => ({ label: t.label, value: t.pct }))}
                height={190}
                ariaLabel="Weekly attendance dynamics line chart"
                color="var(--primary)"
                fillGradient
                showGrid
              />
            </div>
            <div className="card-foot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="t-caption" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
                Target benchmark: ≥85% healthy attendance
              </span>
              <Link href="/app/daily-diary?tab=attendance" className="btn btn-ghost btn-sm">
                Open Daily Register <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}

        {/* Overdue + Fee Health */}
        {perms.finance && (
          <div className="card card-hover">
            <div className="card-head">
              <div>
                <div className="card-title">Fee Health & Collection</div>
                <div className="card-sub">Collections rate & outstanding balance</div>
              </div>
              <span className={`badge ${data.overdue > 0 ? 'b-warning' : 'b-success'}`}>
                {data.overdue > 0 ? 'Follow-up Needed' : 'On Track'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="stat-mini">
                <b style={{ fontSize: 22 }}>{inr(data.collected, { compact: true })}</b>
                <span>Total Collected to Date</span>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="t-caption" style={{ fontWeight: 600 }}>Collection Efficiency</span>
                  <span className="t-caption" style={{ fontWeight: 750, color: 'var(--primary)' }}>{data.collectRate}%</span>
                </div>
                <div className="progressbar"><i style={{ width: `${data.collectRate}%` }} /></div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
                  North Star target: 92% recovery
                </div>
              </div>
              <div className="stat-mini" style={{ background: data.overdue > 0 ? 'var(--danger-soft)' : 'var(--bg-muted)' }}>
                <b style={{ color: data.overdue > 0 ? 'var(--danger)' : undefined, fontSize: 20 }}>
                  {inr(data.overdue, { compact: true })}
                </b>
                <span>Overdue Outstanding</span>
              </div>
              <Link href="/app/finance" className="btn btn-secondary btn-sm" style={{ justifyContent: 'center' }}>
                Open Finance Control Center <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. Operations & Audit Workspace ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }} className="dash-grid">
        {/* Classrooms */}
        <div className="card card-hover">
          <div className="card-head">
            <div>
              <div className="card-title">Classrooms & Enrollment</div>
              <div className="card-sub">Student count vs licensed capacity</div>
            </div>
            <School size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.classrooms.map((c) => {
              const pct = Math.round((c.students / Math.max(1, c.capacity)) * 100)
              return (
                <div key={c.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 650, color: 'var(--text-primary)' }}>
                      {c.name} <span className="t-caption">· {enumLabel(c.programType)}</span>
                    </span>
                    <span className="t-caption" style={{ fontWeight: 700 }}>
                      {c.students} / {c.capacity}
                    </span>
                  </div>
                  <div className="progressbar" style={{ height: 6 }}>
                    <i style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              )
            })}
            {data.classrooms.length === 0 && (
              <p className="t-body" style={{ color: 'var(--text-muted)' }}>No classrooms configured yet.</p>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card card-hover">
          <div className="card-head">
            <div>
              <div className="card-title">Recent Operational Activity</div>
              <div className="card-sub">Real-time immutable audit trail</div>
            </div>
            <Activity size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="timeline">
            {data.recentActivity.map((a, i) => (
              <div className="tl-item" key={i}>
                <span className="tl-dot" />
                <div className="tl-body">
                  <div className="tl-head">
                    <b style={{ fontSize: 13 }}>{a.summary}</b>
                  </div>
                  <p style={{ fontSize: 12 }}>
                    {a.actor || 'System'} · {timeAgo(a.at)}
                  </p>
                </div>
              </div>
            ))}
            {data.recentActivity.length === 0 && (
              <p className="t-body" style={{ color: 'var(--text-muted)' }}>No recent activity recorded.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
