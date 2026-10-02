'use client'

import React, { useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  Plus,
  Clock,
  ShieldAlert,
  GraduationCap,
} from 'lucide-react'
import { Card, StatusBadge, Avatar, Field } from '@/components/preone/ui'
import { DataTable, Column } from '@/components/preone/DataTable'
import { Modal } from '@/components/preone/Modal'
import type { LeaveRecord } from './types'

interface HRLeaveTabProps {
  leaves: LeaveRecord[] | null
  statusFilter: string
  onStatusFilterChange: (s: string) => void
  onActionLeave: (id: string, action: 'APPROVE' | 'REJECT', reason?: string) => Promise<void>
  onApplyLeave?: (payload: any) => Promise<void>
  staffList?: Array<{ id: string; name: string; employeeCode: string; designation?: string | null }>
  canApprove?: boolean
  canWrite?: boolean
  loadingAction?: boolean
}

export function HRLeaveTab({
  leaves,
  statusFilter,
  onStatusFilterChange,
  onActionLeave,
  onApplyLeave,
  staffList,
  canApprove,
  canWrite,
  loadingAction,
}: HRLeaveTabProps) {
  // Reject Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Apply Leave Modal State
  const [applyModalOpen, setApplyModalOpen] = useState(false)
  const [applyForm, setApplyForm] = useState({
    staffProfileId: '',
    leaveTypeId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reason: '',
  })
  const [submittingLeave, setSubmittingLeave] = useState(false)

  const handleOpenReject = (id: string) => {
    setRejectTargetId(id)
    setRejectReason('')
    setRejectModalOpen(true)
  }

  const handleConfirmReject = async () => {
    if (!rejectTargetId || !rejectReason.trim()) return
    await onActionLeave(rejectTargetId, 'REJECT', rejectReason.trim())
    setRejectModalOpen(false)
    setRejectTargetId(null)
  }

  const handleConfirmApply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!applyForm.staffProfileId || !applyForm.reason.trim()) return
    setSubmittingLeave(true)
    try {
      if (onApplyLeave) {
        await onApplyLeave(applyForm)
        setApplyModalOpen(false)
      }
    } finally {
      setSubmittingLeave(false)
    }
  }

  // Columns definition
  const columns = useMemo<Column<LeaveRecord>[]>(
    () => [
      {
        key: 'employee',
        header: 'Employee',
        sortable: true,
        render: (row) => (
          <div className="flex items-center gap-2.5 py-1">
            <Avatar name={row.staffProfile.user.fullName} size="md" />
            <div>
              <div className="font-semibold text-foreground leading-tight text-sm">
                {row.staffProfile.user.fullName}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <span className="font-mono">{row.staffProfile.employeeCode}</span>
                <span>• {row.staffProfile.branch?.name || 'Main Campus'}</span>
              </div>
            </div>
          </div>
        ),
      },
      {
        key: 'leaveType',
        header: 'Leave Type',
        sortable: true,
        render: (row) => (
          <div>
            <span className="badge b-primary text-xs font-semibold px-2 py-0.5">
              {row.leaveType.name}
            </span>
            <div className="text-[11px] text-muted-foreground mt-0.5 font-medium">
              {row.totalDays} day{row.totalDays > 1 ? 's' : ''} requested
            </div>
          </div>
        ),
      },
      {
        key: 'dates',
        header: 'Leave Period & Reason',
        sortable: true,
        render: (row) => (
          <div className="text-xs space-y-0.5">
            <div className="font-semibold text-foreground">
              {new Date(row.startDate).toLocaleDateString('en-IN')} –{' '}
              {new Date(row.endDate).toLocaleDateString('en-IN')}
            </div>
            <div className="text-[11px] text-muted-foreground truncate max-w-[240px]" title={row.reason}>
              {row.reason}
            </div>
          </div>
        ),
      },
      {
        key: 'coverage',
        header: 'Classroom Coverage',
        render: (row) => {
          if (row.coverages && row.coverages.length > 0) {
            return (
              <span className="badge b-info text-[10px] font-semibold px-2 py-0.5 inline-flex items-center gap-1">
                <GraduationCap size={11} />
                <span>{row.coverages[0].classroom.name} (Routed)</span>
              </span>
            )
          }
          return <span className="text-[11px] text-muted-foreground">General Staff</span>
        },
      },
      {
        key: 'appliedAt',
        header: 'Applied On',
        sortable: true,
        render: (row) => (
          <span className="text-xs text-muted-foreground">
            {new Date(row.appliedAt).toLocaleDateString('en-IN')}
          </span>
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
        header: 'Decision',
        align: 'right',
        render: (row) => {
          if (row.status !== 'PENDING') {
            return (
              <span className="text-[11px] text-muted-foreground">
                {row.actionedByName ? `Signed by ${row.actionedByName}` : 'Actioned'}
              </span>
            )
          }

          if (!canApprove) {
            return <span className="text-[11px] text-muted-foreground italic">Awaiting Approval</span>
          }

          return (
            <div className="flex items-center justify-end gap-1.5">
              <button
                disabled={loadingAction}
                onClick={() => onActionLeave(row.id, 'APPROVE')}
                className="btn btn-primary btn-sm py-1 px-2.5 text-xs flex items-center gap-1 shadow-xs"
                title="Approve & Route Substitute Coverage"
              >
                <CheckCircle2 size={13} />
                <span>Approve</span>
              </button>
              <button
                disabled={loadingAction}
                onClick={() => handleOpenReject(row.id)}
                className="btn btn-ghost btn-sm py-1 px-2 text-xs text-danger hover:bg-danger/10 flex items-center gap-1"
                title="Reject Leave"
              >
                <XCircle size={13} />
                <span>Reject</span>
              </button>
            </div>
          )
        },
      },
    ],
    [canApprove, loadingAction, onActionLeave]
  )

  // Filter toolbar
  const filterToolbar = (
    <div className="flex items-center gap-2">
      <select
        className="select text-xs py-1.5 px-2.5 h-8 font-medium"
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value)}
      >
        <option value="ALL">All Statuses</option>
        <option value="PENDING">Pending Review Only</option>
        <option value="APPROVED">Approved Leaves</option>
        <option value="REJECTED">Rejected Leaves</option>
      </select>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* ── 1. Standard Preschool Leave Quota Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Casual Leave (CL)
            </span>
            <div className="w-7 h-7 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <CalendarDays size={14} />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">12 Days</div>
          <div className="text-[11px] text-muted-foreground mt-1">Monthly preschool entitlement</div>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Sick Leave (SL)
            </span>
            <div className="w-7 h-7 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Clock size={14} />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">10 Days</div>
          <div className="text-[11px] text-muted-foreground mt-1">Carry forward up to 5 days</div>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Earned Leave (EL)
            </span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <CheckCircle2 size={14} />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">15 Days</div>
          <div className="text-[11px] text-muted-foreground mt-1">Annual vacation leave</div>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Maternity (ML)
            </span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldAlert size={14} />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">180 Days</div>
          <div className="text-[11px] text-muted-foreground mt-1">Statutory maternity leave</div>
        </div>
      </div>

      {/* ── 2. Applications Table ── */}
      <DataTable
        columns={columns}
        data={leaves}
        loading={leaves === null}
        filters={filterToolbar}
        searchPlaceholder="Search leave requests by staff name, reason, or date..."
        emptyTitle="No Leave Requests Found"
        emptyMessage="There are currently no leave applications matching this status."
        emptyIcon={<CalendarDays size={36} className="text-muted-foreground opacity-50" />}
        paginate
        defaultPageSize={15}
        showExport
        exportFileName="preone-staff-leaves"
      />

      {/* ── Rejection Modal ── */}
      <Modal
        open={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Leave Application"
        subtitle="Provide a mandatory reason for declining this request"
        icon={<XCircle size={18} />}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-destructive"
              disabled={loadingAction || !rejectReason.trim()}
              onClick={handleConfirmReject}
            >
              {loadingAction ? 'Declining...' : 'Confirm Rejection'}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <Field label="Rejection Reason" required helper="Explain why the leave cannot be approved at this time">
            <textarea
              className="input text-xs w-full min-h-[80px]"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Critical preschool exam week / insufficient teacher classroom coverage available"
              required
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
