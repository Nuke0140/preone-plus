'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Award, Plus, Star, CheckCircle2, Clock, UserCheck } from 'lucide-react'
import { Card, StatusBadge, Avatar, Skeleton, Field } from '@/components/preone/ui'
import { DataTable, Column } from '@/components/preone/DataTable'
import { Modal } from '@/components/preone/Modal'
import { useToast } from '@/components/preone/Toast'

interface ReviewItem {
  id: string
  staffProfileId: string
  employeeName: string
  employeeCode: string
  designation: string | null
  branchName: string | null
  cycleId: string
  cycleTitle: string
  cycleType: string
  selfRating: number | null
  selfComments: string | null
  reviewerRating: number | null
  reviewerComments: string | null
  finalRating: number | null
  recommendation: string
  status: string
  completedAt: string | null
}

interface PerformanceData {
  cycles: any[]
  reviews: ReviewItem[]
  staffList: Array<{
    id: string
    employeeCode: string
    designation: string | null
    user: { fullName: string }
  }>
}

export function HRPerformanceTab({ canWrite }: { canWrite?: boolean }) {
  const toast = useToast()
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    staffProfileId: '',
    reviewerRating: 5,
    reviewerComments: 'Demonstrated excellent pedagogical dedication and child-care empathy.',
    recommendation: 'INCREMENT',
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/hr/performance').then((r) => r.json())
      if (res.success) {
        setData(res.data)
      }
    } catch (e: any) {
      toast.error('Failed to load performance appraisals', e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSubmitReview = async () => {
    if (!form.staffProfileId) {
      toast.error('Validation Error', 'Please select an employee.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/hr/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SUBMIT_REVIEW',
          ...form,
          status: 'COMPLETED',
        }),
      }).then((r) => r.json())

      if (res.success) {
        toast.success('Appraisal Review Recorded')
        setIsModalOpen(false)
        loadData()
      } else {
        toast.error('Failed to record review', res.error?.message)
      }
    } catch (e: any) {
      toast.error('Error', e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const columns = useMemo<Column<ReviewItem>[]>(
    () => [
      {
        key: 'employee',
        header: 'Employee',
        sortable: true,
        render: (row) => (
          <div className="flex items-center gap-2.5 py-0.5">
            <Avatar name={row.employeeName} size="md" />
            <div>
              <div className="font-semibold text-foreground leading-tight">{row.employeeName}</div>
              <div className="text-[11px] text-muted-foreground">
                {row.employeeCode} • {row.designation || 'Staff'}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: 'cycleTitle',
        header: 'Appraisal Cycle',
        sortable: true,
        render: (row) => (
          <div>
            <div className="text-xs font-medium text-foreground">{row.cycleTitle}</div>
            <div className="text-[10px] text-muted-foreground">{row.cycleType}</div>
          </div>
        ),
      },
      {
        key: 'rating',
        header: 'Rating (out of 5)',
        sortable: true,
        align: 'center',
        render: (row) => {
          const rating = row.finalRating || row.reviewerRating
          if (!rating) return <span className="text-xs text-muted-foreground">—</span>
          return (
            <span className="badge b-warning text-xs font-bold px-2 py-0.5 inline-flex items-center gap-1">
              <Star size={11} className="fill-warning text-warning" />
              <span>{rating.toFixed(1)}</span>
            </span>
          )
        },
      },
      {
        key: 'recommendation',
        header: 'Recommendation',
        sortable: true,
        render: (row) => (
          <span className="badge b-primary text-xs font-medium px-2 py-0.5">
            {row.recommendation.replace('_', ' ')}
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
        key: 'comments',
        header: 'Reviewer Feedback',
        render: (row) => (
          <span className="text-xs text-muted-foreground italic truncate max-w-[220px] block" title={row.reviewerComments || ''}>
            {row.reviewerComments || '—'}
          </span>
        ),
      },
    ],
    []
  )

  const reviewStats = useMemo(() => {
    if (!data || !data.reviews) {
      return { total: 0, avgRating: '—', increments: 0, confirmationCount: 0 }
    }
    const total = data.reviews.length
    const avg =
      total > 0
        ? (
            data.reviews.reduce((acc, r) => acc + (r.finalRating || r.reviewerRating || 0), 0) /
            total
          ).toFixed(1)
        : '—'
    const increments = data.reviews.filter(
      (r) => r.recommendation === 'INCREMENT' || r.recommendation === 'PROMOTION'
    ).length
    const confirmationCount = data.reviews.filter(
      (r) => r.recommendation === 'CONFIRMATION'
    ).length
    return { total, avgRating: avg, increments, confirmationCount }
  }, [data])

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} h={90} variant="card" />
          ))}
        </div>
        <Skeleton h={300} variant="card" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── 1. Performance Metric Counters ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Total Reviews
            </span>
            <div className="w-7 h-7 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Award size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {reviewStats.total}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Appraisal records logged
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Average Rating
            </span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Star size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {reviewStats.avgRating} <span className="text-sm font-normal text-muted-foreground">/ 5.0</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Classroom & pedagogical score
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Increments / Promotions
            </span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {reviewStats.increments}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Recommended salary increments
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Permanent Confirmations
            </span>
            <div className="w-7 h-7 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <UserCheck size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {reviewStats.confirmationCount}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Probation completion approvals
          </div>
        </div>
      </div>

      {/* ── 2. Top Action Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card">
        <div>
          <h2 className="text-base font-bold text-foreground">Staff Performance & Appraisals</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Preschool teacher reviews, observation notes, peer feedback, and statutory salary increment recommendations.
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary btn-sm flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-xs"
          >
            <Plus size={14} />
            <span>Record Appraisal</span>
          </button>
        )}
      </div>

      {/* ── Reviews Table ── */}
      <DataTable
        columns={columns}
        data={data.reviews}
        searchPlaceholder="Search appraisal by staff name or cycle..."
        emptyTitle="No Performance Reviews"
        emptyMessage="No staff appraisal reviews have been recorded yet."
        emptyIcon={<Award size={36} className="text-muted-foreground opacity-50" />}
        paginate
        defaultPageSize={15}
        showExport
        exportFileName="preone-staff-performance"
      />

      {/* ── Record Appraisal Modal ── */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Staff Appraisal"
        subtitle="Submit feedback and recommendation for employee performance"
        icon={<Award size={18} />}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={submitting} onClick={handleSubmitReview}>
              {submitting ? 'Recording...' : 'Submit Appraisal'}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <Field label="Employee" required>
            <select
              className="select text-xs w-full"
              value={form.staffProfileId}
              onChange={(e) => setForm({ ...form, staffProfileId: e.target.value })}
            >
              <option value="">Select Employee...</option>
              {data.staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.user.fullName} ({s.employeeCode} - {s.designation || 'Staff'})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Performance Rating (1.0 to 5.0)" required>
            <select
              className="select text-xs w-full"
              value={form.reviewerRating}
              onChange={(e) => setForm({ ...form, reviewerRating: parseFloat(e.target.value) })}
            >
              <option value={5}>5.0 — Outstanding / Exceptional</option>
              <option value={4.5}>4.5 — Very Good</option>
              <option value={4}>4.0 — Good / Meets Expectations</option>
              <option value={3.5}>3.5 — Satisfactory</option>
              <option value={3}>3.0 — Needs Improvement</option>
            </select>
          </Field>

          <Field label="Appraisal Recommendation" required>
            <select
              className="select text-xs w-full"
              value={form.recommendation}
              onChange={(e) => setForm({ ...form, recommendation: e.target.value })}
            >
              <option value="INCREMENT">Annual Increment</option>
              <option value="PROMOTION">Role Promotion / Lead Teacher</option>
              <option value="CONFIRMATION">Permanent Confirmation</option>
              <option value="EXTEND_PROBATION">Extend Probation</option>
              <option value="NONE">Maintain Current</option>
            </select>
          </Field>

          <Field label="Reviewer Notes & Feedback" required>
            <textarea
              className="input text-xs w-full min-h-[80px]"
              rows={3}
              value={form.reviewerComments}
              onChange={(e) => setForm({ ...form, reviewerComments: e.target.value })}
              placeholder="Enter observations regarding classroom management, parent communication, and punctuality..."
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
