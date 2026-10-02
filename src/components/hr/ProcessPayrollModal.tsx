'use client'

import React, { useState } from 'react'
import { CreditCard, AlertCircle } from 'lucide-react'
import { Modal } from '@/components/preone/Modal'
import { Field } from '@/components/preone/ui'
import type { BranchOption } from './types'

interface ProcessPayrollModalProps {
  open: boolean
  onClose: () => void
  branches: BranchOption[]
  onProcess: (payload: { month: number; year: number; branchId?: string }) => Promise<void>
  loading?: boolean
}

export function ProcessPayrollModal({
  open,
  onClose,
  branches,
  onProcess,
  loading,
}: ProcessPayrollModalProps) {
  const currentDate = new Date()
  const [month, setMonth] = useState(currentDate.getMonth() + 1)
  const [year, setYear] = useState(currentDate.getFullYear())
  const [branchId, setBranchId] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onProcess({
      month,
      year,
      branchId: branchId || undefined,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Process Monthly Payroll"
      subtitle="Calculate attendance days, earnings, statutory deductions, and POSH compliance"
      icon={<CreditCard size={18} />}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading}
            onClick={handleSubmit}
          >
            {loading ? 'Calculating...' : 'Run Payroll Calculation'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="p-3 rounded-lg bg-info/10 border border-info/30 flex items-start gap-2 text-info-foreground">
          <AlertCircle size={15} className="shrink-0 mt-0.5 text-info" />
          <span>
            The system automatically scans daily punches, deducts unpaid leaves, applies statutory PF (12%), ESI (0.75%), PT, and places non-POSH compliant staff on hold.
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Payroll Month" required>
            <select
              className="select text-xs w-full"
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
            >
              {[
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
              ].map((m, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Fiscal Year" required>
            <select
              className="select text-xs w-full"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
            >
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
              <option value={2025}>2025</option>
            </select>
          </Field>
        </div>

        <Field label="Target Campus / Branch">
          <select
            className="select text-xs w-full"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            <option value="">All Campuses (Consolidated)</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
      </form>
    </Modal>
  )
}
