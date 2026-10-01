'use client'

import React, { useMemo } from 'react'
import {
  CalendarCheck,
  Clock,
  Edit3,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Save,
} from 'lucide-react'
import { Avatar, StatusBadge, IconButton } from '@/components/preone/ui'
import { DataTable, Column } from '@/components/preone/DataTable'
import type { AttendanceRecord, BranchOption } from './types'
import { timeOf } from './types'

interface HRAttendanceTabProps {
  attendanceRecords: AttendanceRecord[] | null
  date: string
  onDateChange: (d: string) => void
  branches: BranchOption[]
  branchFilter: string
  onBranchFilterChange: (b: string) => void
  statusFilter: string
  onStatusFilterChange: (s: string) => void
  searchQuery: string
  onSearchQueryChange: (q: string) => void
  onOpenCorrection: (record: AttendanceRecord) => void
  canWrite?: boolean
}

export function HRAttendanceTab({
  attendanceRecords,
  date,
  onDateChange,
  branches,
  branchFilter,
  onBranchFilterChange,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchQueryChange,
  onOpenCorrection,
  canWrite,
}: HRAttendanceTabProps) {
  const isToday = date === new Date().toISOString().split('T')[0]

  // Quick date navigator helpers
  const handlePrevDay = () => {
    const d = new Date(date)
    d.setDate(d.getDate() - 1)
    onDateChange(d.toISOString().split('T')[0])
  }

  const handleNextDay = () => {
    const d = new Date(date)
    d.setDate(d.getDate() + 1)
    onDateChange(d.toISOString().split('T')[0])
  }

  const handleToday = () => {
    onDateChange(new Date().toISOString().split('T')[0])
  }

  // Summary counts for the selected date
  const summary = useMemo(() => {
    if (!attendanceRecords) return { total: 0, present: 0, late: 0, halfDay: 0, onLeave: 0, absent: 0 }
    let present = 0
    let late = 0
    let halfDay = 0
    let onLeave = 0
    let absent = 0

    for (const r of attendanceRecords) {
      if (r.status === 'PRESENT') present++
      else if (r.status === 'LATE') late++
      else if (r.status === 'HALF_DAY') halfDay++
      else if (r.status === 'ON_LEAVE') onLeave++
      else if (r.status === 'ABSENT' || r.status === 'UNMARKED') absent++
    }

    return {
      total: attendanceRecords.length,
      present,
      late,
      halfDay,
      onLeave,
      absent,
    }
  }, [attendanceRecords])

  // Columns definition
  const columns = useMemo<Column<AttendanceRecord>[]>(
    () => [
      {
        key: 'name',
        header: 'Employee',
        sortable: true,
        render: (row) => (
          <div className="flex items-center gap-2.5 py-1">
            <Avatar name={row.name} size="md" />
            <div>
              <div className="font-semibold text-foreground leading-tight text-sm">{row.name}</div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <span className="font-mono">{row.employeeCode}</span>
                <span>• {row.designation || 'Staff'}</span>
              </div>
            </div>
          </div>
        ),
      },
      {
        key: 'branchName',
        header: 'Campus',
        sortable: true,
        render: (row) => (
          <span className="text-xs text-foreground font-medium px-2 py-0.5 rounded bg-muted/40">
            {row.branchName || 'Main Campus'}
          </span>
        ),
      },
      {
        key: 'checkIn',
        header: 'Check-In',
        sortable: true,
        render: (row) => (
          <div className="text-xs">
            <span className="font-mono text-foreground font-semibold">
              {timeOf(row.checkIn)}
            </span>
            {row.lateMinutes > 0 && (
              <span className="ml-1.5 badge b-warning text-[10px] px-1 py-0">
                +{row.lateMinutes}m
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'checkOut',
        header: 'Check-Out',
        sortable: true,
        render: (row) => (
          <span className="text-xs font-mono text-foreground font-semibold">
            {timeOf(row.checkOut)}
          </span>
        ),
      },
      {
        key: 'workedHours',
        header: 'Worked Hours',
        sortable: true,
        align: 'center',
        render: (row) => (
          <div className="text-xs">
            <span className="font-medium text-foreground">
              {row.workedHours > 0 ? `${row.workedHours} hrs` : '—'}
            </span>
            <div className="text-[10px] text-muted-foreground">Standard 8h shift</div>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        align: 'center',
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: 'actions',
        header: 'Actions',
        align: 'right',
        render: (row) =>
          canWrite ? (
            <IconButton
              icon={<Edit3 size={14} />}
              label="Attendance Correction"
              title="Audit-backed Correction"
              size="sm"
              onClick={() => onOpenCorrection(row)}
            />
          ) : null,
      },
    ],
    [canWrite, onOpenCorrection]
  )

  const recordsToDisplay = useMemo(() => {
    if (!attendanceRecords) return null
    if (statusFilter === 'ALL') return attendanceRecords
    return attendanceRecords.filter((r) => r.status === statusFilter)
  }, [attendanceRecords, statusFilter])

  return (
    <div className="space-y-4">
      {/* ── 1. Daily Roll Call Context & Navigation Bar ── */}
      <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Date Navigator */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevDay}
            className="btn btn-ghost btn-sm p-1.5 h-9 w-9 rounded-xl border border-border/70 hover:bg-muted/50"
            title="Previous Day"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-center gap-1.5">
            <Calendar size={15} className="text-primary shrink-0" />
            <input
              type="date"
              className="input text-xs py-1 px-3 h-9 font-medium cursor-pointer rounded-xl bg-background/80 border border-border/80"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </div>

          <button
            onClick={handleNextDay}
            className="btn btn-ghost btn-sm p-1.5 h-9 w-9 rounded-xl border border-border/70 hover:bg-muted/50"
            title="Next Day"
          >
            <ChevronRight size={16} />
          </button>

          <button
            onClick={handleToday}
            className={`btn btn-sm text-xs font-semibold px-3 h-9 rounded-xl ${
              isToday ? 'btn-primary' : 'btn-ghost border border-border/70'
            }`}
          >
            Today
          </button>
        </div>

        {/* Live Status Counter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="badge b-success text-xs font-semibold px-2.5 py-1">
            Present: {summary.present}
          </span>
          <span className="badge b-warning text-xs font-semibold px-2.5 py-1">
            Late: {summary.late}
          </span>
          <span className="badge b-info text-xs font-semibold px-2.5 py-1">
            Half Day: {summary.halfDay}
          </span>
          <span className="badge b-primary text-xs font-semibold px-2.5 py-1">
            On Leave: {summary.onLeave}
          </span>
          <span className="badge b-danger text-xs font-semibold px-2.5 py-1">
            Absent: {summary.absent}
          </span>
        </div>
      </div>

      {/* ── 2. Filters & Attendance Table ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Campus Filter */}
        <select
          className="select text-xs py-1.5 px-3 h-9 font-medium rounded-xl bg-background/80 border border-border/80"
          value={branchFilter}
          onChange={(e) => onBranchFilterChange(e.target.value)}
        >
          <option value="ALL">All Campuses</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          className="select text-xs py-1.5 px-3 h-9 font-medium rounded-xl bg-background/80 border border-border/80"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          <option value="PRESENT">Present Only</option>
          <option value="LATE">Late Arrivals</option>
          <option value="HALF_DAY">Half Day</option>
          <option value="ON_LEAVE">On Leave</option>
          <option value="ABSENT">Absent / Unmarked</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={recordsToDisplay}
        loading={attendanceRecords === null}
        searchPlaceholder="Search staff by name or code..."
        searchValue={searchQuery}
        onSearch={onSearchQueryChange}
        emptyTitle="No Attendance Records"
        emptyMessage={`No staff attendance entries found for ${new Date(date).toLocaleDateString('en-IN')}.`}
        emptyIcon={<CalendarCheck size={36} className="text-muted-foreground opacity-50" />}
        paginate
        defaultPageSize={20}
        showExport
        exportFileName={`preone-staff-attendance-${date}`}
      />
    </div>
  )
}
