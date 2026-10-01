'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  FileBarChart,
  Users,
  CalendarCheck,
  CalendarDays,
  CreditCard,
  Award,
  Building,
  CheckCircle2,
} from 'lucide-react'
import { Card, StatusBadge, Skeleton } from '@/components/preone/ui'
import { DataTable, Column } from '@/components/preone/DataTable'
import type { BranchOption } from './types'
import { money } from './types'

type ReportType = 'headcount' | 'attendance' | 'leave' | 'payroll' | 'performance'

interface HRReportsTabProps {
  branches: BranchOption[]
}

export function HRReportsTab({ branches }: HRReportsTabProps) {
  const [reportType, setReportType] = useState<ReportType>('headcount')
  const [branchFilter, setBranchFilter] = useState('ALL')
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<any[] | null>(null)

  const reportPresets: Array<{
    id: ReportType
    title: string
    subtitle: string
    icon: React.ComponentType<{ size?: number; className?: string }>
  }> = [
    {
      id: 'headcount',
      title: 'Employee Directory',
      subtitle: 'Staff headcount, roles, and contacts',
      icon: Users,
    },
    {
      id: 'attendance',
      title: 'Daily Attendance',
      subtitle: 'Today’s roll-call, hours, and punch logs',
      icon: CalendarCheck,
    },
    {
      id: 'leave',
      title: 'Leave Ledgers',
      subtitle: 'Utilization, types, and approval history',
      icon: CalendarDays,
    },
    {
      id: 'payroll',
      title: 'Payroll Payouts',
      subtitle: 'Gross salary, PF/ESI deductions, net pay',
      icon: CreditCard,
    },
    {
      id: 'performance',
      title: 'Appraisal Reviews',
      subtitle: 'Star ratings and increment recommendations',
      icon: Award,
    },
  ]

  const loadReportData = async () => {
    setLoading(true)
    try {
      if (reportType === 'headcount') {
        const sp = new URLSearchParams()
        if (branchFilter !== 'ALL') sp.set('branchId', branchFilter)
        const res = await fetch(`/api/v1/hr/staff?${sp.toString()}`).then((r) => r.json())
        if (res.success) setReportData(res.data)
      } else if (reportType === 'attendance') {
        const today = new Date().toISOString().split('T')[0]
        const sp = new URLSearchParams({ date: today })
        if (branchFilter !== 'ALL') sp.set('branchId', branchFilter)
        const res = await fetch(`/api/v1/hr/attendance?${sp.toString()}`).then((r) => r.json())
        if (res.success) setReportData(res.data.records)
      } else if (reportType === 'leave') {
        const res = await fetch('/api/v1/hr/leaves').then((r) => r.json())
        if (res.success) {
          setReportData(
            res.data.map((l: any) => ({
              id: l.id,
              employeeName: l.staffProfile.user.fullName,
              employeeCode: l.staffProfile.employeeCode,
              branchName: l.staffProfile.branch?.name || 'Main Campus',
              leaveType: l.leaveType.name,
              totalDays: l.totalDays,
              startDate: new Date(l.startDate).toLocaleDateString('en-IN'),
              endDate: new Date(l.endDate).toLocaleDateString('en-IN'),
              status: l.status,
              reason: l.reason,
            }))
          )
        }
      } else if (reportType === 'payroll') {
        const res = await fetch('/api/v1/hr/payroll').then((r) => r.json())
        if (res.success) {
          const flatPayslips: any[] = []
          for (const c of res.data) {
            const period = `${c.month}/${c.year}`
            for (const p of c.payslips || []) {
              flatPayslips.push({
                id: p.id,
                period,
                employeeName: p.staffProfile?.user?.fullName || 'Staff',
                employeeCode: p.staffProfile?.employeeCode || '—',
                grossEarnings: p.grossEarnings,
                pfDeduction: p.pfDeduction,
                esiDeduction: p.esiDeduction,
                ptDeduction: p.ptDeduction,
                netSalary: p.netSalary,
                status: p.isHeld ? 'HELD' : p.status,
              })
            }
          }
          setReportData(flatPayslips)
        }
      } else if (reportType === 'performance') {
        const res = await fetch('/api/v1/hr/performance').then((r) => r.json())
        if (res.success) {
          setReportData(
            res.data.reviews.map((r: any) => ({
              id: r.id,
              employeeName: r.employeeName,
              employeeCode: r.employeeCode,
              designation: r.designation || 'Staff',
              cycleTitle: r.cycleTitle,
              rating: r.finalRating || r.reviewerRating || '—',
              recommendation: r.recommendation,
              status: r.status,
              comments: r.reviewerComments || '—',
            }))
          )
        }
      }
    } catch (e) {
      setReportData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReportData()
  }, [reportType, branchFilter])

  // Dynamic columns per report type
  const columns = useMemo<Column<any>[]>(() => {
    if (reportType === 'headcount') {
      return [
        { key: 'employeeCode', header: 'Emp Code', sortable: true },
        { key: 'name', header: 'Staff Name', sortable: true },
        { key: 'designation', header: 'Designation', sortable: true },
        { key: 'department', header: 'Department', sortable: true },
        { key: 'branchName', header: 'Branch', sortable: true },
        { key: 'employmentType', header: 'Type', sortable: true },
        {
          key: 'joiningDate',
          header: 'Joining Date',
          sortable: true,
          render: (row) => (row.joiningDate ? new Date(row.joiningDate).toLocaleDateString('en-IN') : '—'),
        },
        { key: 'status', header: 'Status', align: 'center', render: (row) => <StatusBadge status={row.status} /> },
      ]
    }
    if (reportType === 'attendance') {
      return [
        { key: 'employeeCode', header: 'Emp Code', sortable: true },
        { key: 'name', header: 'Staff Name', sortable: true },
        { key: 'designation', header: 'Designation' },
        { key: 'branchName', header: 'Branch' },
        { key: 'checkIn', header: 'Check In', render: (row) => (row.checkIn ? new Date(row.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—') },
        { key: 'checkOut', header: 'Check Out', render: (row) => (row.checkOut ? new Date(row.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—') },
        { key: 'workedHours', header: 'Worked Hours', align: 'center', render: (row) => `${row.workedHours}h` },
        { key: 'status', header: 'Status', align: 'center', render: (row) => <StatusBadge status={row.status} /> },
      ]
    }
    if (reportType === 'leave') {
      return [
        { key: 'employeeCode', header: 'Emp Code', sortable: true },
        { key: 'employeeName', header: 'Staff Name', sortable: true },
        { key: 'branchName', header: 'Branch' },
        { key: 'leaveType', header: 'Leave Type', sortable: true },
        { key: 'totalDays', header: 'Days', align: 'center', sortable: true },
        { key: 'startDate', header: 'From' },
        { key: 'endDate', header: 'To' },
        { key: 'status', header: 'Status', align: 'center', render: (row) => <StatusBadge status={row.status} /> },
      ]
    }
    if (reportType === 'payroll') {
      return [
        { key: 'period', header: 'Period', sortable: true },
        { key: 'employeeCode', header: 'Emp Code', sortable: true },
        { key: 'employeeName', header: 'Staff Name', sortable: true },
        { key: 'grossEarnings', header: 'Gross Earnings', align: 'right', render: (row) => money(row.grossEarnings) },
        { key: 'pfDeduction', header: 'PF', align: 'right', render: (row) => money(row.pfDeduction) },
        { key: 'esiDeduction', header: 'ESI / PT', align: 'right', render: (row) => money(row.esiDeduction) },
        { key: 'netSalary', header: 'Net Salary', align: 'right', render: (row) => money(row.netSalary) },
        { key: 'status', header: 'Status', align: 'center', render: (row) => <StatusBadge status={row.status} /> },
      ]
    }
    // Performance
    return [
      { key: 'employeeCode', header: 'Emp Code', sortable: true },
      { key: 'employeeName', header: 'Staff Name', sortable: true },
      { key: 'designation', header: 'Designation' },
      { key: 'cycleTitle', header: 'Review Cycle' },
      { key: 'rating', header: 'Rating (out of 5)', align: 'center' },
      { key: 'recommendation', header: 'Recommendation', render: (row) => row.recommendation.replace('_', ' ') },
      { key: 'status', header: 'Status', align: 'center', render: (row) => <StatusBadge status={row.status} /> },
    ]
  }, [reportType])

  return (
    <div className="space-y-6">
      {/* ── 1. Report Selector Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {reportPresets.map((preset) => {
          const Icon = preset.icon
          const isSelected = reportType === preset.id

          return (
            <div
              key={preset.id}
              role="button"
              tabIndex={0}
              onClick={() => setReportType(preset.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setReportType(preset.id)
                }
              }}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between shadow-xs ${
                isSelected
                  ? 'border-primary/60 bg-primary/5 dark:bg-primary/10 ring-1 ring-primary/20 shadow-sm'
                  : 'border-border/80 bg-card hover:border-border hover:bg-card/90'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    isSelected ? 'bg-primary text-white' : 'bg-primary/10 text-primary'
                  }`}
                >
                  <Icon size={15} />
                </div>
                {isSelected && (
                  <span className="badge b-primary text-[10px] font-bold px-1.5 py-0">Active</span>
                )}
              </div>
              <div className="space-y-0.5">
                <div className={`text-xs font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                  {preset.title}
                </div>
                <div className="text-[11px] text-muted-foreground line-clamp-1">
                  {preset.subtitle}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── 2. Report Context & Filter Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-card">
        <div>
          <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <FileBarChart size={14} className="text-primary" />
            <span>
              {reportPresets.find((p) => p.id === reportType)?.title || 'Workforce Report'}
            </span>
            {reportData && (
              <span className="badge b-muted text-[10px] font-semibold px-2 py-0.5">
                {reportData.length} records
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Real-time verified data extracted directly from PreOne preschool workforce database.
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Campus Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building size={13} />
            <select
              className="select text-xs py-1 px-2.5 h-8 font-medium"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            >
              <option value="ALL">All Campuses</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Reports DataTable ── */}
      <DataTable
        columns={columns}
        data={reportData}
        loading={loading}
        emptyTitle="No Report Data"
        emptyMessage="No records available for this report configuration."
        emptyIcon={<FileBarChart size={36} className="text-muted-foreground opacity-50" />}
        paginate
        defaultPageSize={15}
        showExport
        exportFileName={`preone-hr-report-${reportType}`}
      />
    </div>
  )
}
