'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  CalendarRange,
  GraduationCap,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building,
  User,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Card, StatusBadge, Avatar, Skeleton } from '@/components/preone/ui'
import { DataTable, Column } from '@/components/preone/DataTable'
import { useToast } from '@/components/preone/Toast'

interface ClassroomScheduleItem {
  id: string
  name: string
  code: string
  programType: string
  programName: string | null
  capacity: number
  enrolledCount: number
  branchId: string
  branchName: string
  primaryTeacher: {
    id: string
    name: string
    email: string
    phone: string | null
    employeeCode: string | null
    designation: string | null
  } | null
  defaultShift: string
  workingHours: number
}

interface ScheduleData {
  classrooms: ClassroomScheduleItem[]
  unassignedTeachers: Array<{
    id: string
    userId: string
    name: string
    email: string
    phone: string | null
    employeeCode: string
    designation: string
    branchName: string
  }>
  coveragesToday: Array<{
    id: string
    classroomName: string
    absentTeacherName: string
    status: string
    notes: string | null
  }>
  summary: {
    totalClassrooms: number
    assignedClassrooms: number
    unassignedClassrooms: number
    availableTeachers: number
    activeCoveragesToday: number
  }
}

export function HRScheduleTab({ branchFilter }: { branchFilter?: string }) {
  const toast = useToast()
  const [data, setData] = useState<ScheduleData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const fetchSchedule = async () => {
      setLoading(true)
      try {
        const sp = new URLSearchParams()
        if (branchFilter && branchFilter !== 'ALL') sp.set('branchId', branchFilter)
        const res = await fetch(`/api/v1/hr/schedule?${sp.toString()}`).then((r) => r.json())
        if (active && res.success) {
          setData(res.data)
        }
      } catch (e: any) {
        if (active) toast.error('Failed to load staff schedule', e.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchSchedule()
    return () => {
      active = false
    }
  }, [branchFilter, toast])

  const columns = useMemo<Column<ClassroomScheduleItem>[]>(
    () => [
      {
        key: 'name',
        header: 'Classroom & Program',
        sortable: true,
        render: (row) => (
          <div className="py-1">
            <div className="font-semibold text-foreground text-sm leading-tight">{row.name}</div>
            <div className="text-[11.5px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <span className="font-mono px-1.5 py-0.2 rounded bg-muted/60 text-[11px] font-medium text-foreground">
                {row.code}
              </span>
              <span className="badge b-primary text-[10px] font-medium px-1.5 py-0">
                {row.programName || row.programType}
              </span>
            </div>
          </div>
        ),
      },
      {
        key: 'branchName',
        header: 'Campus',
        sortable: true,
        render: (row) => (
          <span className="text-xs text-foreground font-medium px-2 py-0.5 rounded bg-muted/30">
            {row.branchName}
          </span>
        ),
      },
      {
        key: 'primaryTeacher',
        header: 'Assigned Primary Educator',
        sortable: true,
        render: (row) => {
          if (!row.primaryTeacher) {
            return (
              <span className="badge b-warning text-xs font-semibold px-2 py-0.5 inline-flex items-center gap-1">
                <AlertTriangle size={11} />
                <span>Teacher Unassigned</span>
              </span>
            )
          }
          return (
            <div className="flex items-center gap-2.5 py-0.5">
              <Avatar name={row.primaryTeacher.name} size="sm" />
              <div>
                <div className="font-semibold text-foreground text-xs leading-tight">
                  {row.primaryTeacher.name}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {row.primaryTeacher.employeeCode} • {row.primaryTeacher.designation || 'Lead Teacher'}
                </div>
              </div>
            </div>
          )
        },
      },
      {
        key: 'enrolledCount',
        header: 'Classroom Capacity',
        align: 'center',
        render: (row) => {
          const pct = Math.min(100, Math.round((row.enrolledCount / Math.max(row.capacity, 1)) * 100))
          return (
            <div className="w-[120px] mx-auto space-y-1">
              <div className="flex items-center justify-between text-[11px] font-medium text-foreground">
                <span>{row.enrolledCount} enrolled</span>
                <span className="text-muted-foreground">{row.capacity} cap</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted/80 overflow-hidden">
                <div
                  style={{ width: `${pct}%` }}
                  className={`h-full rounded-full ${
                    pct >= 90 ? 'bg-danger' : pct >= 75 ? 'bg-warning' : 'bg-primary'
                  }`}
                />
              </div>
            </div>
          )
        },
      },
      {
        key: 'defaultShift',
        header: 'Work Shift',
        align: 'center',
        render: (row) => (
          <div className="text-xs">
            <span className="font-semibold text-foreground">{row.defaultShift}</span>
            <div className="text-[10.5px] text-muted-foreground">{row.workingHours}h daily teaching shift</div>
          </div>
        ),
      },
    ],
    []
  )

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} h={90} variant="card" />
          ))}
        </div>
        <Skeleton h={350} variant="card" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── 1. Scheduling Metric Counters ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Total Classrooms
            </span>
            <div className="w-7 h-7 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <GraduationCap size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {data.summary.totalClassrooms}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Active preschool cohorts
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Assigned Teachers
            </span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {data.summary.assignedClassrooms}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            With dedicated primary teachers
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Unassigned Rooms
            </span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertTriangle size={15} />
            </div>
          </div>
          <div className={`text-2xl font-bold ${data.summary.unassignedClassrooms > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
            {data.summary.unassignedClassrooms}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Pending educator allocation
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Substitute Coverages
            </span>
            <div className="w-7 h-7 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Clock size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {data.summary.activeCoveragesToday}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Active coverages today
          </div>
        </div>
      </div>

      {/* ── 2. Unassigned Notice Alert ── */}
      {data.summary.unassignedClassrooms > 0 && (
        <div className="p-3.5 rounded-xl bg-warning/10 border border-warning/30 flex items-center justify-between text-xs text-warning-foreground">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={16} className="text-warning shrink-0" />
            <span>
              <b>{data.summary.unassignedClassrooms} preschool classroom(s)</b> currently have no primary teacher assigned. Primary teachers are managed via Academics and reflected here automatically.
            </span>
          </div>
          <span className="badge b-warning text-[11px] font-semibold px-2 py-0.5">Academics Sync</span>
        </div>
      )}

      {/* ── 3. Classroom Allocations Table ── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Teacher – Classroom Allocations</h3>
        <DataTable
          columns={columns}
          data={data.classrooms}
          searchPlaceholder="Search by classroom name, code, or teacher..."
          emptyTitle="No Classrooms Found"
          emptyMessage="No classrooms found for the selected campus."
          paginate
          defaultPageSize={15}
          showExport
          exportFileName="preone-staff-schedule"
        />
      </div>

      {/* ── 4. Unassigned Available Educators Pool ── */}
      {data.unassignedTeachers.length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border/50">
            <Users size={16} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Available Teaching Staff ({data.unassignedTeachers.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {data.unassignedTeachers.map((t) => (
              <div key={t.id} className="p-3 rounded-lg border border-border/60 bg-muted/20 flex items-center gap-3 text-xs">
                <Avatar name={t.name} size="sm" />
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">{t.name}</div>
                  <div className="text-[11px] text-muted-foreground">{t.employeeCode} • {t.designation}</div>
                  <div className="text-[10.5px] text-primary mt-0.5">{t.branchName}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── 5. Today's Substitute Teacher Coverages ── */}
      {data.coveragesToday.length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border/50">
            <CheckCircle2 size={16} className="text-info" />
            <h3 className="text-sm font-semibold text-foreground">Today's Absence Coverages</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {data.coveragesToday.map((cov) => (
              <div key={cov.id} className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1 text-xs">
                <div className="font-semibold text-foreground">{cov.classroomName}</div>
                <div className="text-muted-foreground">
                  Absent: <span className="text-foreground font-medium">{cov.absentTeacherName}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <StatusBadge status={cov.status} />
                  {cov.notes && <span className="text-[11px] text-muted-foreground italic truncate max-w-[130px]">{cov.notes}</span>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
