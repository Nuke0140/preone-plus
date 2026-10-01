'use client'

import React, { useMemo, useState } from 'react'
import {
  CreditCard,
  Download,
  Plus,
  Lock,
  HandCoins,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Search,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react'
import { Card, StatusBadge, Skeleton, Avatar } from '@/components/preone/ui'
import { DataTable, Column } from '@/components/preone/DataTable'
import type { PayrollCycleItem } from './types'
import { money } from './types'

interface HRPayrollTabProps {
  cycles: PayrollCycleItem[] | null
  onOpenProcessPayroll: () => void
  onOpenDisburse: (cycle: PayrollCycleItem) => void
  onExportBankFile: (cycleId: string) => void
  canPayroll?: boolean
}

export function HRPayrollTab({
  cycles,
  onOpenProcessPayroll,
  onOpenDisburse,
  onExportBankFile,
  canPayroll,
}: HRPayrollTabProps) {
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null)
  const [payslipSearch, setPayslipSearch] = useState('')
  const [payslipFilter, setPayslipFilter] = useState<'ALL' | 'HELD' | 'ACTIVE'>('ALL')

  const activeCycle = useMemo(() => {
    if (!cycles || cycles.length === 0) return null
    if (selectedCycleId) return cycles.find((c) => c.id === selectedCycleId) || cycles[0]
    return cycles[0]
  }, [cycles, selectedCycleId])

  const filteredPayslips = useMemo(() => {
    if (!activeCycle || !activeCycle.payslips) return []
    let list = activeCycle.payslips
    if (payslipFilter === 'HELD') {
      list = list.filter((p: any) => p.isHeld)
    } else if (payslipFilter === 'ACTIVE') {
      list = list.filter((p: any) => !p.isHeld)
    }
    if (payslipSearch.trim()) {
      const q = payslipSearch.toLowerCase()
      list = list.filter(
        (p: any) =>
          (p.staffProfile?.user?.fullName || '').toLowerCase().includes(q) ||
          (p.staffProfile?.employeeCode || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [activeCycle, payslipSearch, payslipFilter])

  const columns = useMemo<Column<PayrollCycleItem>[]>(
    () => [
      {
        key: 'period',
        header: 'Payroll Period',
        sortable: true,
        render: (row) => {
          const date = new Date(row.year, row.month - 1)
          const monthName = date.toLocaleString('default', { month: 'long', year: 'numeric' })
          return (
            <div className="py-1">
              <div className="font-semibold text-foreground text-sm">{monthName}</div>
              <div className="text-[11px] text-muted-foreground">{row.branch?.name || 'All Campuses (Consolidated)'}</div>
            </div>
          )
        },
      },
      {
        key: 'totalStaff',
        header: 'Staff Count',
        sortable: true,
        align: 'center',
        render: (row) => <span className="text-xs font-semibold text-foreground">{row.totalStaff} staff</span>,
      },
      {
        key: 'totalGross',
        header: 'Total Gross',
        sortable: true,
        align: 'right',
        render: (row) => <span className="text-xs font-mono text-muted-foreground">{money(row.totalGross)}</span>,
      },
      {
        key: 'totalDeductions',
        header: 'Statutory Deductions (PF/ESI/PT)',
        sortable: true,
        align: 'right',
        render: (row) => (
          <span className="text-xs font-mono font-medium text-danger">-{money(row.totalDeductions)}</span>
        ),
      },
      {
        key: 'totalNetPayable',
        header: 'Net Payable',
        sortable: true,
        align: 'right',
        render: (row) => (
          <span className="text-xs font-mono font-bold text-success text-sm">{money(row.totalNetPayable)}</span>
        ),
      },
      {
        key: 'status',
        header: 'Cycle Status',
        sortable: true,
        align: 'center',
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: 'actions',
        header: 'Actions',
        align: 'right',
        render: (row) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => setSelectedCycleId(row.id)}
              className={`btn btn-sm py-1 px-2.5 text-xs font-medium ${
                activeCycle?.id === row.id ? 'btn-secondary' : 'btn-ghost'
              }`}
              title="View Individual Payslips"
            >
              Payslips ({row.payslips?.length || 0})
            </button>
            <button
              onClick={() => onExportBankFile(row.id)}
              className="btn btn-ghost btn-sm py-1 px-2 text-xs flex items-center gap-1"
              title="Export NEFT CSV"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Bank CSV</span>
            </button>
            {canPayroll && row.status !== 'DISBURSED' && (
              <button
                onClick={() => onOpenDisburse(row)}
                className="btn btn-primary btn-sm py-1 px-2.5 text-xs flex items-center gap-1 shadow-xs"
                title="Disburse Payouts & Lock Cycle"
              >
                <HandCoins size={13} />
                <span>Disburse</span>
              </button>
            )}
          </div>
        ),
      },
    ],
    [canPayroll, activeCycle, onExportBankFile, onOpenDisburse]
  )

  const heldCount = useMemo(() => {
    if (!activeCycle || !activeCycle.payslips) return 0
    return activeCycle.payslips.filter((p: any) => p.isHeld).length
  }, [activeCycle])

  const payrollStats = useMemo(() => {
    if (!cycles || cycles.length === 0) {
      return { latestPeriod: '—', totalNet: 0, totalDeductions: 0, heldCount: 0 }
    }
    const latest = cycles[0]
    const date = new Date(latest.year, latest.month - 1)
    const latestPeriod = date.toLocaleString('default', { month: 'short', year: 'numeric' })
    const allHeld = cycles.reduce((acc, c) => acc + (c.payslips?.filter((p: any) => p.isHeld).length || 0), 0)
    return {
      latestPeriod,
      totalNet: latest.totalNet || 0,
      totalDeductions: latest.totalDeductions || 0,
      heldCount: allHeld,
    }
  }, [cycles])

  return (
    <div className="space-y-6">
      {/* ── 1. Top Payroll Metric Counters ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Latest Period
            </span>
            <div className="w-7 h-7 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <CreditCard size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {payrollStats.latestPeriod}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Most recent payroll run
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Net Payout
            </span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {money(payrollStats.totalNet)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Net bank disbursements
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Statutory Remittances
            </span>
            <div className="w-7 h-7 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileSpreadsheet size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {money(payrollStats.totalDeductions)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            PF (12%) + ESI (0.75%) + PT
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Safety Held Payslips
            </span>
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${payrollStats.heldCount > 0 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
              {payrollStats.heldCount > 0 ? (
                <ShieldAlert size={15} />
              ) : (
                <ShieldCheck size={15} />
              )}
            </div>
          </div>
          <div className={`text-2xl font-bold ${payrollStats.heldCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
            {payrollStats.heldCount}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {payrollStats.heldCount > 0 ? 'Locked pending POSH renewal' : 'All staff compliant'}
          </div>
        </div>
      </div>

      {/* ── 2. Top Summary Strip & Action Button ── */}
      <div className="p-4 rounded-xl border border-border/80 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-foreground">Monthly Payroll & Compensation</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Attendance-calculated monthly cycles with Indian statutory deductions (PF @ 12%, ESI @ 0.75%, PT, TDS) and automated POSH child-safety hold verification.
          </p>
        </div>
        {canPayroll && (
          <button
            onClick={onOpenProcessPayroll}
            className="btn btn-primary btn-sm flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-xs"
          >
            <Plus size={14} />
            <span>Process Monthly Payroll</span>
          </button>
        )}
      </div>

      {/* ── 2. Payroll Cycles Table ── */}
      <div className="space-y-3">
        <DataTable
          columns={columns}
          data={cycles}
          loading={cycles === null}
          emptyTitle="No Payroll Cycles"
          emptyMessage="No payroll cycles have been processed yet."
          emptyIcon={<CreditCard size={36} className="text-muted-foreground opacity-50" />}
          paginate
          defaultPageSize={10}
        />
      </div>

      {/* ── 3. Individual Payslips Breakdown for Selected Cycle ── */}
      {activeCycle && (
        <Card className="p-4 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-foreground">
                  Payslips Register — {new Date(activeCycle.year, activeCycle.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h3>
                <StatusBadge status={activeCycle.status} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Staff earnings, payable days, and statutory deduction details
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Search payslips */}
              <div className="relative min-w-[180px]">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  className="input text-xs h-8"
                  style={{ paddingLeft: '2rem' }}
                  placeholder="Filter staff in cycle..."
                  value={payslipSearch}
                  onChange={(e) => setPayslipSearch(e.target.value)}
                />
              </div>

              {/* Status segment */}
              <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg">
                <button
                  onClick={() => setPayslipFilter('ALL')}
                  className={`px-2 py-0.5 text-xs font-medium rounded ${
                    payslipFilter === 'ALL' ? 'bg-card text-foreground shadow-xs font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  All ({activeCycle.payslips?.length || 0})
                </button>
                <button
                  onClick={() => setPayslipFilter('ACTIVE')}
                  className={`px-2 py-0.5 text-xs font-medium rounded ${
                    payslipFilter === 'ACTIVE' ? 'bg-card text-foreground shadow-xs font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  Payable ({Math.max(0, (activeCycle.payslips?.length || 0) - heldCount)})
                </button>
                {heldCount > 0 && (
                  <button
                    onClick={() => setPayslipFilter('HELD')}
                    className={`px-2 py-0.5 text-xs font-medium rounded ${
                      payslipFilter === 'HELD' ? 'bg-danger text-white font-semibold' : 'text-danger'
                    }`}
                  >
                    Held ({heldCount})
                  </button>
                )}
              </div>

              <button
                onClick={() => onExportBankFile(activeCycle.id)}
                className="btn btn-ghost btn-sm text-xs flex items-center gap-1 h-8"
                title="Download bank format NEFT payout CSV"
              >
                <Download size={13} />
                <span>Export Bank NEFT</span>
              </button>
            </div>
          </div>

          {/* Held Alert Notice */}
          {heldCount > 0 && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 flex items-center justify-between text-xs text-danger">
              <div className="flex items-center gap-2">
                <ShieldAlert size={16} className="shrink-0" />
                <span>
                  <b>{heldCount} staff payout(s)</b> are currently on hold due to missing or expired mandatory Child Safety / POSH training.
                </span>
              </div>
              <span className="text-[11px] font-semibold underline cursor-pointer" onClick={() => setPayslipFilter('HELD')}>
                View Held Payslips
              </span>
            </div>
          )}

          {/* Payslips Table */}
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-xs text-left">
              <thead className="text-[11px] uppercase bg-muted/40 text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-2 text-center">Days (Paid / Unpaid)</th>
                  <th className="py-2.5 px-2 text-right">Basic</th>
                  <th className="py-2.5 px-2 text-right">HRA</th>
                  <th className="py-2.5 px-2 text-right font-medium">Gross</th>
                  <th className="py-2.5 px-2 text-right">PF (12%)</th>
                  <th className="py-2.5 px-2 text-right">ESI / PT</th>
                  <th className="py-2.5 px-2 text-right font-bold">Net Pay</th>
                  <th className="py-2.5 px-3 text-center">Payout Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredPayslips.length > 0 ? (
                  filteredPayslips.map((p: any) => (
                    <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-foreground">
                          {p.staffProfile?.user?.fullName || 'Staff Member'}
                        </div>
                        <div className="text-[10.5px] font-mono text-muted-foreground">
                          {p.staffProfile?.employeeCode || '—'}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="text-success font-semibold">{p.paidLeaveDays + p.presentDays}d paid</span>
                        {p.unpaidLeaveDays > 0 && (
                          <span className="text-danger ml-1 font-medium">({p.unpaidLeaveDays}d unpaid)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-muted-foreground">
                        {money(p.basicEarned)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-muted-foreground">
                        {money(p.hraEarned)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-semibold text-foreground">
                        {money(p.grossEarnings)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-danger">
                        -{money(p.pfDeduction)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-danger">
                        -{money(Number(p.esiDeduction) + Number(p.ptDeduction))}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-success text-sm">
                        {money(p.netSalary)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {p.isHeld ? (
                          <span className="badge b-danger text-[10px] font-semibold px-2 py-0.5" title={p.holdReason || 'POSH Lapsed'}>
                            Hold: {p.holdReason || 'POSH Lapsed'}
                          </span>
                        ) : (
                          <StatusBadge status={p.status} />
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-muted-foreground">
                      No payslips found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
