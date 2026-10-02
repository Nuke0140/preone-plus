'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ShieldCheck, Plus, AlertTriangle, CheckCircle2, Clock, FileCheck } from 'lucide-react'
import { Card, StatusBadge, Avatar, Skeleton, Field } from '@/components/preone/ui'
import { DataTable, Column } from '@/components/preone/DataTable'
import { Modal } from '@/components/preone/Modal'
import { useToast } from '@/components/preone/Toast'

interface TrainingRow {
  id: string
  staffProfileId: string
  name: string
  email: string
  employeeCode: string
  designation: string | null
  branchName: string | null
  poshStatus: string
  poshScore: number | null
  poshCompletedAt: string | null
  poshExpiry: string | null
  daysRemaining: number | null
  policeVerificationStatus: string
  medicalFitnessStatus: string
}

interface TrainingData {
  records: TrainingRow[]
  stats: {
    total: number
    compliant: number
    expiringSoon: number
    expired: number
    notCertified: number
  }
}

export function HRTrainingTab({ canWrite }: { canWrite?: boolean }) {
  const toast = useToast()
  const [data, setData] = useState<TrainingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    staffProfileId: '',
    trainingType: 'POSH',
    title: 'Annual Child Safety & POSH Training 2026',
    score: 95,
    completionDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    remarks: 'Annual child-safety certification verified',
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const sp = new URLSearchParams()
      if (statusFilter !== 'ALL') sp.set('status', statusFilter)
      const res = await fetch(`/api/v1/hr/training?${sp.toString()}`).then((r) => r.json())
      if (res.success) {
        setData(res.data)
      }
    } catch (e: any) {
      toast.error('Failed to load trainings', e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [statusFilter])

  const handleRecordTraining = async () => {
    if (!form.staffProfileId) {
      toast.error('Validation Error', 'Please select an employee.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/hr/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }).then((r) => r.json())

      if (res.success) {
        toast.success('Training certificate recorded. Any held salary released.')
        setIsModalOpen(false)
        loadData()
      } else {
        toast.error('Failed to record training', res.error?.message)
      }
    } catch (e: any) {
      toast.error('Error', e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const columns = useMemo<Column<TrainingRow>[]>(
    () => [
      {
        key: 'employee',
        header: 'Employee',
        sortable: true,
        render: (row) => (
          <div className="flex items-center gap-2.5 py-0.5">
            <Avatar name={row.name} size="md" />
            <div>
              <div className="font-semibold text-foreground leading-tight">{row.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {row.employeeCode} • {row.branchName || 'Main Campus'}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: 'training',
        header: 'Statutory Training',
        render: () => (
          <div>
            <div className="text-xs font-medium text-foreground">POSH & Child Protection</div>
            <div className="text-[10px] text-muted-foreground">Preschool Mandate</div>
          </div>
        ),
      },
      {
        key: 'completedAt',
        header: 'Completed On',
        sortable: true,
        render: (row) => (
          <span className="text-xs text-muted-foreground">
            {row.poshCompletedAt ? new Date(row.poshCompletedAt).toLocaleDateString('en-IN') : 'Not Completed'}
          </span>
        ),
      },
      {
        key: 'expiry',
        header: 'Valid Until',
        sortable: true,
        render: (row) => {
          if (!row.poshExpiry) return <span className="text-xs text-muted-foreground">—</span>
          return (
            <div className="text-xs">
              <span className="font-medium text-foreground">
                {new Date(row.poshExpiry).toLocaleDateString('en-IN')}
              </span>
              {row.daysRemaining !== null && (
                <div
                  className={`text-[10px] font-semibold ${
                    row.daysRemaining < 0
                      ? 'text-danger'
                      : row.daysRemaining <= 30
                      ? 'text-warning'
                      : 'text-success'
                  }`}
                >
                  {row.daysRemaining < 0
                    ? `Expired ${Math.abs(row.daysRemaining)}d ago`
                    : `${row.daysRemaining} days remaining`}
                </div>
              )}
            </div>
          )
        },
      },
      {
        key: 'status',
        header: 'Compliance Status',
        sortable: true,
        align: 'center',
        render: (row) => {
          if (row.poshStatus === 'COMPLIANT') {
            return (
              <span className="badge b-success text-xs font-semibold px-2 py-0.5 inline-flex items-center gap-1">
                <CheckCircle2 size={11} />
                <span>Compliant</span>
              </span>
            )
          }
          if (row.poshStatus === 'EXPIRING_SOON') {
            return (
              <span className="badge b-warning text-xs font-semibold px-2 py-0.5 inline-flex items-center gap-1">
                <AlertTriangle size={11} />
                <span>Expiring Soon</span>
              </span>
            )
          }
          return (
            <span className="badge b-danger text-xs font-semibold px-2 py-0.5 inline-flex items-center gap-1">
              <Clock size={11} />
              <span>{row.poshStatus === 'EXPIRED' ? 'Expired' : 'Not Certified'}</span>
            </span>
          )
        },
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
        <Skeleton h={320} variant="card" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── 1. Statutory Compliance Metric Counters ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Tracked Workforce
            </span>
            <div className="w-7 h-7 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <ShieldCheck size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {data.stats.total}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Staff under child protection radar
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Compliant
            </span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {data.stats.compliant}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Valid POSH & safety certificates
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Expiring Soon
            </span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertTriangle size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {data.stats.expiringSoon}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Renewal due within 30 days
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Expired / Missing
            </span>
            <div className="w-7 h-7 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Clock size={15} />
            </div>
          </div>
          <div className={`text-2xl font-bold ${data.stats.expired + data.stats.notCertified > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
            {data.stats.expired + data.stats.notCertified}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Automatically locks payroll payout
          </div>
        </div>
      </div>

      {/* ── 2. Action Toolbar & Table ── */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="seg">
              <button
                className={statusFilter === 'ALL' ? 'on' : ''}
                onClick={() => setStatusFilter('ALL')}
              >
                All ({data.stats.total})
              </button>
              <button
                className={statusFilter === 'COMPLIANT' ? 'on' : ''}
                onClick={() => setStatusFilter('COMPLIANT')}
              >
                Compliant ({data.stats.compliant})
              </button>
              <button
                className={statusFilter === 'EXPIRING_SOON' ? 'on' : ''}
                onClick={() => setStatusFilter('EXPIRING_SOON')}
              >
                Expiring ({data.stats.expiringSoon})
              </button>
              <button
                className={statusFilter === 'EXPIRED' ? 'on' : ''}
                onClick={() => setStatusFilter('EXPIRED')}
              >
                Expired ({data.stats.expired + data.stats.notCertified})
              </button>
            </div>
          </div>
          {canWrite && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn btn-primary btn-sm flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
            >
              <Plus size={14} />
              <span>Record Certificate</span>
            </button>
          )}
        </div>

        <DataTable
          columns={columns}
          data={data.records}
          searchPlaceholder="Search by staff name or employee code..."
          emptyTitle="No Training Records"
          emptyMessage="No training records match this filter."
          emptyIcon={<FileCheck size={36} className="text-muted-foreground opacity-50" />}
          paginate
          defaultPageSize={15}
          showExport
          exportFileName="preone-staff-trainings"
        />
      </div>

      {/* ── Record Certificate Modal ── */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Statutory Certificate"
        subtitle="Log employee training and update compliance status"
        icon={<ShieldCheck size={18} />}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={submitting} onClick={handleRecordTraining}>
              {submitting ? 'Recording...' : 'Record Certificate'}
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
              {data.records.map((r) => (
                <option key={r.staffProfileId} value={r.staffProfileId}>
                  {r.name} ({r.employeeCode})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Training Type" required>
            <select
              className="select text-xs w-full"
              value={form.trainingType}
              onChange={(e) => setForm({ ...form, trainingType: e.target.value })}
            >
              <option value="POSH">POSH (Prevention of Sexual Harassment)</option>
              <option value="CHILD_SAFETY">Child Protection & Safety</option>
              <option value="FIRST_AID">Pediatric First Aid & CPR</option>
              <option value="ECCE_PEDAGOGY">ECCE Montessori Pedagogy</option>
              <option value="FOOD_HANDLER">Food Handler Medical Fitness</option>
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Completion Date" required>
              <input
                type="date"
                className="input text-xs w-full"
                value={form.completionDate}
                onChange={(e) => setForm({ ...form, completionDate: e.target.value })}
              />
            </Field>
            <Field label="Expiry Date" required>
              <input
                type="date"
                className="input text-xs w-full"
                value={form.expiryDate}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Assessment Score (%)">
            <input
              type="number"
              className="input text-xs w-full"
              min={0}
              max={100}
              value={form.score}
              onChange={(e) => setForm({ ...form, score: parseFloat(e.target.value) || 0 })}
            />
          </Field>

          <Field label="Verification Notes">
            <textarea
              className="input text-xs w-full"
              rows={2}
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
