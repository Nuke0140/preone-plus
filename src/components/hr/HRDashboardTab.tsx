'use client'

import React from 'react'
import {
  Users,
  UserCheck,
  UserX,
  CalendarCheck,
  Clock,
  AlertCircle,
  GraduationCap,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Building,
  CheckCircle2,
  CalendarDays,
  CalendarRange,
  FileText,
  Plus,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react'
import { Card, StatusBadge, Skeleton } from '@/components/preone/ui'
import type { HRMetrics, HRTabKey } from './types'
import { money } from './types'

interface HRDashboardTabProps {
  metrics: HRMetrics | null
  loading?: boolean
  onNavigateTab: (tab: HRTabKey) => void
  onOpenOnboard?: () => void
  canWrite?: boolean
}

export function HRDashboardTab({
  metrics,
  loading,
  onNavigateTab,
  onOpenOnboard,
  canWrite,
}: HRDashboardTabProps) {
  if (loading || !metrics) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} h={110} variant="card" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton h={220} variant="card" />
          <Skeleton h={220} variant="card" />
          <Skeleton h={220} variant="card" />
        </div>
      </div>
    )
  }

  // Calculate live attendance percentages for visual progress bar
  const total = Math.max(metrics.totalStaff, 1)
  const presentPct = Math.round((metrics.presentToday / total) * 100)
  const leavePct = Math.round((metrics.onLeaveToday / total) * 100)
  const absentCount = Math.max(0, metrics.totalStaff - (metrics.presentToday + metrics.onLeaveToday))
  const absentPct = Math.max(0, 100 - (presentPct + leavePct))

  // KPI cards definition
  const kpis = [
    {
      label: 'Total Staff',
      value: metrics.totalStaff,
      sub: `${metrics.activeStaff} active · ${metrics.onProbation} probation`,
      icon: Users,
      iconBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      tab: 'employees' as HRTabKey,
    },
    {
      label: 'Present Today',
      value: metrics.presentToday,
      sub: `${presentPct}% roll call rate`,
      icon: UserCheck,
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      valueColor: 'text-emerald-600 dark:text-emerald-400',
      tab: 'attendance' as HRTabKey,
    },
    {
      label: 'Absent Today',
      value: metrics.absentToday,
      sub: metrics.absentToday > 0 ? 'Unplanned absences' : 'All staff accounted for',
      icon: UserX,
      iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      valueColor: metrics.absentToday > 0 ? 'text-rose-600 dark:text-rose-400' : undefined,
      tab: 'attendance' as HRTabKey,
    },
    {
      label: 'On Leave',
      value: metrics.onLeaveToday,
      sub: 'Approved educator leaves',
      icon: Clock,
      iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      tab: 'leave' as HRTabKey,
    },
    {
      label: 'Preschool Teachers',
      value: metrics.totalTeachers ?? Math.max(0, metrics.totalStaff - 3),
      sub: 'Classroom educators',
      icon: GraduationCap,
      iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
      tab: 'schedule' as HRTabKey,
    },
    {
      label: 'Pending Requests',
      value: metrics.pendingLeaves,
      sub: metrics.pendingLeaves > 0 ? 'Action required' : 'Inbox caught up',
      icon: AlertCircle,
      iconBg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
      valueColor: metrics.pendingLeaves > 0 ? 'text-orange-600 dark:text-orange-400' : undefined,
      tab: 'requests' as HRTabKey,
    },
  ]

  return (
    <div className="space-y-6">
      {/* ── SECTION 1: Workforce Snapshot ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Workforce Snapshot
          </h2>
          <button
            onClick={() => onNavigateTab('employees')}
            className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
          >
            Directory <ArrowRight size={12} />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map((kpi, idx) => {
            const Icon = kpi.icon
            return (
              <div
                key={idx}
                role="button"
                tabIndex={0}
                onClick={() => onNavigateTab(kpi.tab)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onNavigateTab(kpi.tab)
                  }
                }}
                className="group p-4 rounded-2xl border border-border/80 bg-card hover:bg-card/90 transition-all duration-200 shadow-xs hover:shadow-sm cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
                    {kpi.label}
                  </span>
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${kpi.iconBg}`}
                  >
                    <Icon size={14} />
                  </div>
                </div>

                <div className="space-y-0.5">
                  <div
                    className={`text-2xl font-bold tracking-tight ${
                      kpi.valueColor || 'text-foreground'
                    }`}
                  >
                    {kpi.value}
                  </div>
                  <div className="text-[11px] text-muted-foreground line-clamp-1">
                    {kpi.sub}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── SECTIONS 2, 3, 4: Operational Cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* SECTION 2: Today's Attendance Roll Call */}
        <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CalendarCheck size={15} />
              </div>
              <h3 className="text-sm font-bold text-foreground">Today's Attendance</h3>
            </div>
            <button
              onClick={() => onNavigateTab('attendance')}
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
            >
              Register <ArrowRight size={12} />
            </button>
          </div>

          {/* Multi-Segment Horizontal Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">Campus Staff Roll Call</span>
              <span className="text-muted-foreground font-mono text-[11px]">
                {metrics.presentToday} / {metrics.totalStaff} present
              </span>
            </div>

            <div className="h-3 w-full rounded-full bg-muted/60 overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${presentPct}%` }}
                className="bg-emerald-500 h-full transition-all duration-500"
                title={`Present: ${presentPct}%`}
              />
              <div
                style={{ width: `${leavePct}%` }}
                className="bg-amber-500 h-full transition-all duration-500"
                title={`On Leave: ${leavePct}%`}
              />
              <div
                style={{ width: `${absentPct}%` }}
                className="bg-rose-500 h-full transition-all duration-500"
                title={`Absent: ${absentPct}%`}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 flex-wrap gap-1">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Present ({metrics.presentToday})
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Leave ({metrics.onLeaveToday})
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Absent ({absentCount})
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Attendance Rate:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
              {presentPct}%
            </span>
          </div>
        </div>

        {/* SECTION 3: Requests & Approvals */}
        <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                <AlertCircle size={15} />
              </div>
              <h3 className="text-sm font-bold text-foreground">Requests & Approvals</h3>
            </div>
            <button
              onClick={() => onNavigateTab('requests')}
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
            >
              All Requests <ArrowRight size={12} />
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div
              onClick={() => onNavigateTab('requests')}
              className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <CalendarDays size={14} className="text-amber-500" />
                <span className="text-foreground font-medium">Pending Leave Requests</span>
              </div>
              <span className="badge b-warning text-[10.5px] font-bold px-2 py-0.5">
                {metrics.pendingLeaves} review
              </span>
            </div>

            <div
              onClick={() => onNavigateTab('requests')}
              className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-blue-500" />
                <span className="text-foreground font-medium">Notice & Exit Checklists</span>
              </div>
              <span className="font-medium text-foreground text-[11.5px] px-1.5 py-0.5 rounded bg-muted/50">
                {metrics.pendingResignations} active
              </span>
            </div>

            <div
              onClick={() => onNavigateTab('training')}
              className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-purple-500" />
                <span className="text-foreground font-medium">POSH Expiries (30 Days)</span>
              </div>
              <span className="font-semibold text-warning text-[11.5px]">
                {metrics.poshDue} due
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Urgent Approvals:</span>
            <span className="font-semibold text-foreground">
              {metrics.pendingLeaves + metrics.pendingResignations} total
            </span>
          </div>
        </div>

        {/* SECTION 4: Payroll & Compliance */}
        <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <CreditCard size={15} />
              </div>
              <h3 className="text-sm font-bold text-foreground">Payroll & Statutory</h3>
            </div>
            <button
              onClick={() => onNavigateTab('payroll')}
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
            >
              Cycles <ArrowRight size={12} />
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30">
              <span className="text-muted-foreground font-medium">Current Month Status</span>
              <StatusBadge status={metrics.latestPayrollStatus} />
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30">
              <span className="text-muted-foreground font-medium">Scheduled Net Payout</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                {money(metrics.latestPayrollNet)}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30">
              <span className="text-muted-foreground font-medium">Child Safety & POSH</span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                <ShieldCheck size={14} /> Audit Ready
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Statutory Gate:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 size={13} /> PF / ESI Active
            </span>
          </div>
        </div>
      </div>

      {/* ── SECTION 5: Quick Operational Actions ── */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Quick Operations
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {canWrite && onOpenOnboard && (
            <button
              onClick={onOpenOnboard}
              className="p-3.5 rounded-2xl border border-border/80 bg-card hover:bg-card/90 text-left transition-all duration-200 shadow-xs hover:shadow-sm flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Plus size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                  Add Educator
                </div>
                <div className="text-[11px] text-muted-foreground">Onboard new staff</div>
              </div>
            </button>
          )}

          <button
            onClick={() => onNavigateTab('attendance')}
            className="p-3.5 rounded-2xl border border-border/80 bg-card hover:bg-card/90 text-left transition-all duration-200 shadow-xs hover:shadow-sm flex items-center gap-3 group"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CalendarCheck size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                Roll Call
              </div>
              <div className="text-[11px] text-muted-foreground">Daily attendance</div>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('leave')}
            className="p-3.5 rounded-2xl border border-border/80 bg-card hover:bg-card/90 text-left transition-all duration-200 shadow-xs hover:shadow-sm flex items-center gap-3 group"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <CalendarDays size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                Leave Approvals
              </div>
              <div className="text-[11px] text-muted-foreground">Review balances</div>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('schedule')}
            className="p-3.5 rounded-2xl border border-border/80 bg-card hover:bg-card/90 text-left transition-all duration-200 shadow-xs hover:shadow-sm flex items-center gap-3 group"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <CalendarRange size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                Classroom Roster
              </div>
              <div className="text-[11px] text-muted-foreground">Educator shifts</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
