'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Inbox, CheckCircle2, XCircle, Clock, AlertCircle, CalendarCheck, CalendarDays, LogOut, User } from 'lucide-react'
import { Card, StatusBadge, Avatar, Skeleton, Field } from '@/components/preone/ui'
import { DataTable, Column } from '@/components/preone/DataTable'
import { Modal } from '@/components/preone/Modal'
import { useToast } from '@/components/preone/Toast'

interface RequestItem {
  id: string
  rawId: string
  type: 'LEAVE' | 'ATTENDANCE' | 'RESIGNATION'
  typeLabel: string
  staffProfileId: string
  employeeName: string
  employeeEmail: string
  employeeCode: string
  branchName: string
  submittedAt: string
  period: string
  reason: string
  status: string
  actionedByName?: string | null
  actionedAt?: string | null
  rejectionReason?: string | null
}

interface RequestsData {
  requests: RequestItem[]
  stats: {
    total: number
    pending: number
    approved: number
    rejected: number
  }
}

export function HRRequestsTab({
  canApprove,
  onLeaveAction,
}: {
  canApprove?: boolean
  onLeaveAction?: (leaveId: string, action: 'APPROVE' | 'REJECT', reason?: string) => Promise<void>
}) {
  const toast = useToast()
  const [data, setData] = useState<RequestsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'LEAVE' | 'ATTENDANCE' | 'RESIGNATION'>('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [actioningId, setActioningId] = useState<string | null>(null)

  // Rejection modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectTargetRow, setRejectTargetRow] = useState<RequestItem | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const loadRequests = async () => {
    setLoading(true)
    try {
      const sp = new URLSearchParams()
      if (typeFilter !== 'ALL') sp.set('type', typeFilter)
      if (statusFilter !== 'ALL') sp.set('status', statusFilter)
      const res = await fetch(`/api/v1/hr/requests?${sp.toString()}`).then((r) => r.json())
      if (res.success) {
        setData(res.data)
      }
    } catch (e: any) {
      toast.error('Failed to load requests', e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [typeFilter, statusFilter])

  const handleApprove = async (row: RequestItem) => {
    if (row.type === 'LEAVE' && onLeaveAction) {
      setActioningId(row.id)
      try {
        await onLeaveAction(row.rawId, 'APPROVE')
        loadRequests()
      } finally {
        setActioningId(null)
      }
    }
  }

  const handleOpenRejectModal = (row: RequestItem) => {
    setRejectTargetRow(row)
    setRejectReason('')
    setRejectModalOpen(true)
  }

  const handleConfirmReject = async () => {
    if (!rejectTargetRow || !rejectReason.trim()) return
    if (rejectTargetRow.type === 'LEAVE' && onLeaveAction) {
      setActioningId(rejectTargetRow.id)
      try {
        await onLeaveAction(rejectTargetRow.rawId, 'REJECT', rejectReason.trim())
        setRejectModalOpen(false)
        setRejectTargetRow(null)
        loadRequests()
      } finally {
        setActioningId(null)
      }
    }
  }

  // Count by type
  const typeCounts = useMemo(() => {
    if (!data || !data.requests) return { ALL: 0, LEAVE: 0, ATTENDANCE: 0, RESIGNATION: 0 }
    return {
      ALL: data.requests.length,
      LEAVE: data.requests.filter((r) => r.type === 'LEAVE').length,
      ATTENDANCE: data.requests.filter((r) => r.type === 'ATTENDANCE').length,
      RESIGNATION: data.requests.filter((r) => r.type === 'RESIGNATION').length,
    }
  }, [data])

  const columns = useMemo<Column<RequestItem>[]>(
    () => [
      {
        key: 'employee',
        header: 'Employee',
        sortable: true,
        render: (row) => (
          <div className="flex items-center gap-2.5 py-1">
            <Avatar name={row.employeeName} size="md" />
            <div>
              <div className="font-semibold text-foreground leading-tight text-sm">{row.employeeName}</div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <span className="font-mono">{row.employeeCode}</span>
                <span>• {row.branchName}</span>
              </div>
            </div>
          </div>
        ),
      },
      {
        key: 'typeLabel',
        header: 'Request Type',
        sortable: true,
        render: (row) => {
          let badgeClass = 'b-primary'
          if (row.type === 'ATTENDANCE') badgeClass = 'b-info'
          if (row.type === 'RESIGNATION') badgeClass = 'b-warning'
          return (
            <div>
              <span className={`badge ${badgeClass} text-xs font-semibold px-2 py-0.5`}>
                {row.typeLabel}
              </span>
              <div className="text-[11px] text-muted-foreground mt-0.5 font-medium">{row.period}</div>
            </div>
          )
        },
      },
      {
        key: 'reason',
        header: 'Remarks & Explanation',
        render: (row) => (
          <div className="text-xs text-muted-foreground truncate max-w-[260px]" title={row.reason}>
            {row.reason}
          </div>
        ),
      },
      {
        key: 'submittedAt',
        header: 'Submitted',
        sortable: true,
        render: (row) => (
          <span className="text-xs text-muted-foreground">
            {new Date(row.submittedAt).toLocaleDateString('en-IN')}
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
        header: 'Actions',
        align: 'right',
        render: (row) => {
          if (row.status !== 'PENDING') {
            return (
              <span className="text-[11px] text-muted-foreground">
                {row.actionedByName ? `By ${row.actionedByName}` : 'Completed'}
              </span>
            )
          }

          if (!canApprove || row.type !== 'LEAVE') {
            return <span className="text-[11px] text-muted-foreground italic">In Review</span>
          }

          const isBusy = actioningId === row.id
          return (
            <div className="flex items-center justify-end gap-1.5">
              <button
                disabled={isBusy}
                onClick={() => handleApprove(row)}
                className="btn btn-primary btn-sm py-1 px-2.5 text-xs flex items-center gap-1 shadow-xs"
                title="Approve Request"
              >
                <CheckCircle2 size={13} />
                <span>Approve</span>
              </button>
              <button
                disabled={isBusy}
                onClick={() => handleOpenRejectModal(row)}
                className="btn btn-ghost btn-sm py-1 px-2 text-xs text-danger hover:bg-danger/10 flex items-center gap-1"
                title="Reject Request"
              >
                <XCircle size={13} />
                <span>Reject</span>
              </button>
            </div>
          )
        },
      },
    ],
    [canApprove, actioningId]
  )

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton h={80} variant="card" />
        <Skeleton h={320} variant="card" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── 1. Summary Counters ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              All Requests
            </span>
            <div className="w-7 h-7 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Inbox size={14} />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">{data.stats.total}</div>
          <div className="text-[11px] text-muted-foreground mt-1">Historical staff requests</div>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Pending Review
            </span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertCircle size={14} />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{data.stats.pending}</div>
          <div className="text-[11px] text-muted-foreground mt-1">Require administrator action</div>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Approved
            </span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 size={14} />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{data.stats.approved}</div>
          <div className="text-[11px] text-muted-foreground mt-1">Signed off and active</div>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Declined
            </span>
            <div className="w-7 h-7 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400 flex items-center justify-center">
              <XCircle size={14} />
            </div>
          </div>
          <div className="text-2xl font-bold text-muted-foreground">{data.stats.rejected}</div>
          <div className="text-[11px] text-muted-foreground mt-1">Rejected with notes</div>
        </div>
      </div>

      {/* ── 2. Segment Filters & Requests Table ── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Segment Filter Buttons */}
          <div className="seg" role="tablist">
            {(
              [
                { key: 'ALL', label: 'All Requests' },
                { key: 'LEAVE', label: 'Leaves' },
                { key: 'ATTENDANCE', label: 'Attendance Punches' },
                { key: 'RESIGNATION', label: 'Exit / Resignations' },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={typeFilter === t.key}
                className={typeFilter === t.key ? 'on' : ''}
                onClick={() => setTypeFilter(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <select
            className="select text-xs py-1.5 px-2.5 h-8 font-medium"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Review Only</option>
            <option value="APPROVED">Approved Only</option>
            <option value="REJECTED">Declined Only</option>
          </select>
        </div>

        <DataTable
          columns={columns}
          data={data.requests}
          searchPlaceholder="Search request by staff name, reason, or code..."
          emptyTitle="Inbox Zero"
          emptyMessage="No staff requests match your current filters."
          emptyIcon={<Inbox size={36} className="text-muted-foreground opacity-50" />}
          paginate
          defaultPageSize={15}
          showExport
          exportFileName="preone-staff-requests"
        />
      </div>

      {/* ── Rejection Modal ── */}
      <Modal
        open={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Decline Staff Request"
        subtitle={
          rejectTargetRow
            ? `Declining ${rejectTargetRow.typeLabel} for ${rejectTargetRow.employeeName}`
            : 'Decline request'
        }
        icon={<XCircle size={18} />}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-destructive"
              disabled={!rejectReason.trim()}
              onClick={handleConfirmReject}
            >
              Confirm Decline
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <Field label="Mandatory Reason" required helper="Recorded in the audit trail and visible to the employee">
            <textarea
              className="input text-xs w-full min-h-[80px]"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Schedule clash with parent-teacher conference"
              required
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
