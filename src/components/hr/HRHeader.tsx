'use client'

import React from 'react'
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  CreditCard,
  Award,
  ShieldCheck,
  Inbox,
  FileBarChart,
  Search,
  RefreshCw,
  Plus,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  FileText,
  Clock,
  ArrowUpRight,
} from 'lucide-react'
import type { HRTabKey } from './types'

interface HRHeaderProps {
  activeTab: HRTabKey
  onTabChange: (tab: HRTabKey) => void
  lastSyncTime?: string
  searchQuery: string
  onSearchChange: (q: string) => void
  onRefresh: () => void
  busy?: boolean
  pendingRequestsCount?: number
  onOpenOnboard?: () => void
  canWrite?: boolean
  canPayroll?: boolean
  canApprove?: boolean
  onOpenProcessPayroll?: () => void
}

interface ModuleDef {
  key: HRTabKey
  label: string
  desc: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  badge?: number | string
  accentColor: string
  iconBg: string
}

export function HRHeader({
  activeTab,
  onTabChange,
  lastSyncTime,
  searchQuery,
  onSearchChange,
  onRefresh,
  busy,
  pendingRequestsCount = 0,
  onOpenOnboard,
  canWrite,
  canPayroll,
  canApprove,
  onOpenProcessPayroll,
}: HRHeaderProps) {
  const modules: ModuleDef[] = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      desc: 'Workforce snapshot & KPIs',
      icon: LayoutDashboard,
      accentColor: 'text-purple-600 dark:text-purple-400',
      iconBg: 'bg-purple-500/10 dark:bg-purple-500/20',
    },
    {
      key: 'employees',
      label: 'Employees',
      desc: 'Staff profiles & directory',
      icon: Users,
      accentColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-500/10 dark:bg-blue-500/20',
    },
    {
      key: 'attendance',
      label: 'Attendance',
      desc: 'Daily roll call & punches',
      icon: CalendarCheck,
      accentColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    },
    {
      key: 'leave',
      label: 'Leave',
      desc: 'Balances & approvals',
      icon: CalendarDays,
      accentColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-500/10 dark:bg-amber-500/20',
    },
    {
      key: 'schedule',
      label: 'Staff Schedule',
      desc: 'Timetables & classrooms',
      icon: CalendarRange,
      accentColor: 'text-indigo-600 dark:text-indigo-400',
      iconBg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    },
    {
      key: 'payroll',
      label: 'Payroll',
      desc: 'Cycles, PF/ESI & payouts',
      icon: CreditCard,
      accentColor: 'text-teal-600 dark:text-teal-400',
      iconBg: 'bg-teal-500/10 dark:bg-teal-500/20',
    },
    {
      key: 'performance',
      label: 'Performance',
      desc: 'Appraisals & reviews',
      icon: Award,
      accentColor: 'text-violet-600 dark:text-violet-400',
      iconBg: 'bg-violet-500/10 dark:bg-violet-500/20',
    },
    {
      key: 'training',
      label: 'Training',
      desc: 'POSH, safety & ECCE',
      icon: ShieldCheck,
      accentColor: 'text-cyan-600 dark:text-cyan-400',
      iconBg: 'bg-cyan-500/10 dark:bg-cyan-500/20',
    },
    {
      key: 'requests',
      label: 'Requests',
      desc: 'Unified approvals inbox',
      icon: Inbox,
      badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
      accentColor: 'text-orange-600 dark:text-orange-400',
      iconBg: 'bg-orange-500/10 dark:bg-orange-500/20',
    },
    {
      key: 'reports',
      label: 'Reports',
      desc: 'Analytics & compliance',
      icon: FileBarChart,
      accentColor: 'text-slate-600 dark:text-slate-400',
      iconBg: 'bg-slate-500/10 dark:bg-slate-500/20',
    },
  ]

  // Render contextual action buttons per active tab
  const renderContextualActions = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <>
            <button
              onClick={() => onTabChange('requests')}
              className="btn btn-ghost btn-sm h-9 px-3 gap-1.5 text-xs font-semibold rounded-xl border border-border/80 hover:bg-muted/50"
            >
              <Inbox size={14} className="text-orange-500" />
              <span>View Requests</span>
              {pendingRequestsCount > 0 && (
                <span className="badge b-warning text-[10px] px-1.5 py-0 font-bold ml-0.5">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => onTabChange('payroll')}
              className="btn btn-ghost btn-sm h-9 px-3 gap-1.5 text-xs font-semibold rounded-xl border border-border/80 hover:bg-muted/50"
            >
              <CreditCard size={14} className="text-primary" />
              <span>Payroll</span>
            </button>
            {canWrite && onOpenOnboard && (
              <button
                onClick={onOpenOnboard}
                className="btn btn-primary btn-sm h-9 px-3.5 gap-1.5 text-xs font-semibold rounded-xl shadow-xs"
              >
                <Plus size={14} />
                <span>Add Employee</span>
              </button>
            )}
          </>
        )

      case 'employees':
        return (
          canWrite && onOpenOnboard && (
            <button
              onClick={onOpenOnboard}
              className="btn btn-primary btn-sm h-9 px-3.5 gap-1.5 text-xs font-semibold rounded-xl shadow-xs"
            >
              <Plus size={14} />
              <span>Add Employee</span>
            </button>
          )
        )

      case 'attendance':
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onTabChange('schedule')}
              className="btn btn-ghost btn-sm h-9 px-3 gap-1.5 text-xs font-semibold rounded-xl border border-border/80 hover:bg-muted/50"
            >
              <CalendarRange size={14} className="text-indigo-500" />
              <span>View Roster</span>
            </button>
          </div>
        )

      case 'leave':
        return (
          <button
            onClick={() => onTabChange('requests')}
            className="btn btn-ghost btn-sm h-9 px-3 gap-1.5 text-xs font-semibold rounded-xl border border-border/80 hover:bg-muted/50"
          >
            <CheckCircle2 size={14} className="text-emerald-500" />
            <span>Review Requests</span>
          </button>
        )

      case 'schedule':
        return (
          <button
            onClick={() => onTabChange('employees')}
            className="btn btn-ghost btn-sm h-9 px-3 gap-1.5 text-xs font-semibold rounded-xl border border-border/80 hover:bg-muted/50"
          >
            <Users size={14} className="text-primary" />
            <span>Staff Directory</span>
          </button>
        )

      case 'payroll':
        return (
          canPayroll && onOpenProcessPayroll && (
            <button
              onClick={onOpenProcessPayroll}
              className="btn btn-primary btn-sm h-9 px-3.5 gap-1.5 text-xs font-semibold rounded-xl shadow-xs"
            >
              <CreditCard size={14} />
              <span>Process Payroll</span>
            </button>
          )
        )

      case 'training':
        return (
          <button
            onClick={() => onTabChange('reports')}
            className="btn btn-ghost btn-sm h-9 px-3 gap-1.5 text-xs font-semibold rounded-xl border border-border/80 hover:bg-muted/50"
          >
            <FileText size={14} className="text-cyan-500" />
            <span>Compliance Report</span>
          </button>
        )

      case 'requests':
        return (
          <button
            onClick={() => onTabChange('leave')}
            className="btn btn-ghost btn-sm h-9 px-3 gap-1.5 text-xs font-semibold rounded-xl border border-border/80 hover:bg-muted/50"
          >
            <CalendarDays size={14} className="text-amber-500" />
            <span>Leave Balances</span>
          </button>
        )

      case 'reports':
        return (
          <button
            onClick={onRefresh}
            className="btn btn-ghost btn-sm h-9 px-3 gap-1.5 text-xs font-semibold rounded-xl border border-border/80 hover:bg-muted/50"
          >
            <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
            <span>Refresh Analytics</span>
          </button>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      {/* ── 1. HR Module Hero Section ── */}
      <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-card/80 backdrop-blur-sm shadow-xs transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left: Eyebrow + Heading + Badge + Description */}
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                PEOPLE & OPERATIONS
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-primary/10 text-primary border border-primary/20">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                M07 Control Plane
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              HR & Workforce
            </h1>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Manage preschool educators, attendance, leave, classroom assignments, payroll, training and staff operations.
            </p>
          </div>

          {/* Right: Search + Refresh + Contextual Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Quick Staff Search */}
            <div className="relative min-w-[200px] sm:min-w-[220px]">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <input
                className="input text-xs pl-8 pr-3 h-9 w-full rounded-xl bg-background/80"
                placeholder="Search staff, code, role..."
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value)
                  if (activeTab !== 'employees') onTabChange('employees')
                }}
              />
            </div>

            {/* Refresh / Sync Button */}
            <button
              onClick={onRefresh}
              disabled={busy}
              className="btn btn-ghost btn-sm h-9 px-3 gap-1.5 text-xs font-semibold rounded-xl border border-border/80 hover:bg-muted/50"
              title="Refresh HR Data"
            >
              <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">
                {lastSyncTime ? `Synced ${lastSyncTime}` : 'Sync'}
              </span>
            </button>

            {/* Contextual Actions */}
            {renderContextualActions()}
          </div>
        </div>
      </div>

      {/* ── 2. Windows / Metro-Inspired Module Navigation (10 Interactive Cards) ── */}
      <nav aria-label="HR Modules" className="w-full">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
          {modules.map((m) => {
            const Icon = m.icon
            const isActive = activeTab === m.key

            return (
              <button
                key={m.key}
                type="button"
                onClick={() => onTabChange(m.key)}
                className={`group relative text-left p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 outline-none flex flex-col justify-between min-h-[96px] sm:min-h-[104px] cursor-pointer ${
                  isActive
                    ? 'bg-primary/5 dark:bg-primary/10 border-primary/60 dark:border-primary/50 shadow-sm ring-1 ring-primary/20'
                    : 'bg-card/90 hover:bg-card border-border/80 hover:border-border/90 hover:shadow-sm'
                }`}
              >
                {/* Top Row: Icon container + Badge + Active indicator */}
                <div className="flex items-center justify-between w-full">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${m.iconBg} ${m.accentColor}`}
                  >
                    <Icon size={16} />
                  </div>

                  <div className="flex items-center gap-1.5">
                    {m.badge !== undefined && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white leading-none">
                        {m.badge}
                      </span>
                    )}
                    {isActive ? (
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" title="Active Module" />
                    ) : (
                      <ChevronRight
                        size={14}
                        className="text-muted-foreground/50 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                      />
                    )}
                  </div>
                </div>

                {/* Bottom Row: Module Title + Descriptor */}
                <div className="mt-2.5 space-y-0.5">
                  <div
                    className={`text-xs sm:text-sm font-bold tracking-tight leading-tight line-clamp-1 ${
                      isActive ? 'text-primary' : 'text-foreground group-hover:text-primary transition-colors'
                    }`}
                  >
                    {m.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground line-clamp-1 leading-normal">
                    {m.desc}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
