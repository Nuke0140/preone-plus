'use client'

import React, { useState } from 'react'
import { HandCoins, ShieldCheck, AlertCircle } from 'lucide-react'
import { Modal } from '@/components/preone/Modal'
import { Field } from '@/components/preone/ui'
import type { PayrollCycleItem } from './types'
import { money } from './types'

interface DisbursePayrollModalProps {
  open: boolean
  onClose: () => void
  cycle: PayrollCycleItem | null
  onDisburse: (cycleId: string, reference: string) => Promise<void>
  loading?: boolean
}

export function DisbursePayrollModal({
  open,
  onClose,
  cycle,
  onDisburse,
  loading,
}: DisbursePayrollModalProps) {
  const [reference, setReference] = useState(`NEFT-SAL-${Date.now()}`)

  if (!cycle) return null

  const monthName = new Date(cycle.year, cycle.month - 1).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reference.trim()) return
    await onDisburse(cycle.id, reference.trim())
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Disburse Payroll — ${monthName}`}
      subtitle="Finalize bank transfer payout and lock the monthly payroll cycle"
      icon={<HandCoins size={18} />}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading || !reference.trim()}
            onClick={handleSubmit}
          >
            {loading ? 'Disbursing...' : 'Confirm Disbursement & Lock'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 space-y-1 text-warning-foreground">
          <div className="font-semibold flex items-center gap-1">
            <AlertCircle size={14} className="text-warning" />
            <span>Permanent Cycle Locking</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Once marked as disbursed, this payroll cycle is permanently locked against further adjustments and payslips are signed off.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-border/60 bg-muted/20">
          <div>
            <span className="text-muted-foreground">Total Staff:</span>
            <div className="font-bold text-foreground">{cycle.totalStaff} staff members</div>
          </div>
          <div>
            <span className="text-muted-foreground">Net Payout Amount:</span>
            <div className="font-bold text-success font-mono">{money(cycle.totalNetPayable)}</div>
          </div>
        </div>

        <Field label="Bank Payout / NEFT UTR Reference" required helper="Reference provided by your bank after payout execution">
          <input
            className="input text-xs w-full font-mono"
            placeholder="e.g. UTR-HDFC-982347102938"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            required
          />
        </Field>
      </form>
    </Modal>
  )
}
