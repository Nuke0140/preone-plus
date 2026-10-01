'use client'

import React, { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/components/preone/Toast'
import { can } from '@/lib/auth'
import {
  HRHeader,
  HRDashboardTab,
  HREmployeesTab,
  HRAttendanceTab,
  HRLeaveTab,
  HRScheduleTab,
  HRPayrollTab,
  HRPerformanceTab,
  HRTrainingTab,
  HRRequestsTab,
  HRReportsTab,
  Staff360Drawer,
  AddStaffModal,
  EditStaffModal,
  AttendanceCorrectionModal,
  ProcessPayrollModal,
  DisbursePayrollModal,
  HRTabKey,
  HRMetrics,
  BranchOption,
  StaffListItem,
  AttendanceRecord,
  LeaveRecord,
  PayrollCycleItem,
} from '@/components/hr'

function HRPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()

  // 1. Navigation & Search State
  const initialTab = (searchParams.get('tab') as HRTabKey) || 'dashboard'
  const [tab, setTab] = useState<HRTabKey>(initialTab)
  const [searchQuery, setSearchQuery] = useState('')
  const [lastSyncTime, setLastSyncTime] = useState('')
  const [busy, setBusy] = useState(false)

  // 2. Auth & RBAC State
  const [role, setRole] = useState<string | null>(null)
  const canWrite = can(role as any, 'hr:write')
  const canApprove = can(role as any, 'hr:approve')
  const canPayroll = can(role as any, 'payroll:process')

  // 3. Shared Data
  const [metrics, setMetrics] = useState<HRMetrics | null>(null)
  const [branches, setBranches] = useState<BranchOption[]>([])

  // 4. Tab Specific Data
  const [staffList, setStaffList] = useState<StaffListItem[] | null>(null)
  const [staffBranch, setStaffBranch] = useState('ALL')
  const [staffStatus, setStaffStatus] = useState('ALL')
  const [staffDept, setStaffDept] = useState('ALL')

  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0])
  const [attendanceBranch, setAttendanceBranch] = useState('ALL')
  const [attendanceStatus, setAttendanceStatus] = useState('ALL')
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[] | null>(null)

  const [leaves, setLeaves] = useState<LeaveRecord[] | null>(null)
  const [leaveStatus, setLeaveStatus] = useState('ALL')
  const [leaveActionLoading, setLeaveActionLoading] = useState(false)

  const [payrollCycles, setPayrollCycles] = useState<PayrollCycleItem[] | null>(null)

  // 5. Drawer & Modal States
  const [is360Open, setIs360Open] = useState(false)
  const [staff360, setStaff360] = useState<any>(null)
  const [loading360, setLoading360] = useState(false)

  const [isOnboardOpen, setIsOnboardOpen] = useState(false)
  const [isEditStaffOpen, setIsEditStaffOpen] = useState(false)
  const [editStaffData, setEditStaffData] = useState<any>(null)

  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false)
  const [correctionTarget, setCorrectionTarget] = useState<AttendanceRecord | null>(null)

  const [isProcessPayrollOpen, setIsProcessPayrollOpen] = useState(false)
  const [isDisburseOpen, setIsDisburseOpen] = useState(false)
  const [disburseTarget, setDisburseTarget] = useState<PayrollCycleItem | null>(null)

  // Sync tab with URL
  const handleTabChange = (newTab: HRTabKey) => {
    setTab(newTab)
    const params = new URLSearchParams(window.location.search)
    params.set('tab', newTab)
    router.replace(`/app/hr?${params.toString()}`, { scroll: false })
  }

  // ── Data Loaders ──────────────────────────────────────────────

  const loadOverview = useCallback(async () => {
    try {
      setBusy(true)
      const [resHr, resBranches] = await Promise.all([
        fetch('/api/v1/hr').then((r) => r.json()),
        fetch('/api/v1/branches').then((r) => r.json()).catch(() => ({ success: false })),
      ])
      if (resHr.success) {
        setMetrics(resHr.data.metrics)
        setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      }
      if (resBranches.success) {
        setBranches(resBranches.data || [])
      }
    } catch (e: any) {
      toast.error('Failed to load HR dashboard', e.message)
    } finally {
      setBusy(false)
    }
  }, [toast])

  const loadStaff = useCallback(async () => {
    try {
      setStaffList(null)
      const sp = new URLSearchParams()
      if (staffBranch !== 'ALL') sp.set('branchId', staffBranch)
      if (staffStatus !== 'ALL') sp.set('status', staffStatus)
      if (staffDept !== 'ALL') sp.set('department', staffDept)
      if (searchQuery.trim()) sp.set('search', searchQuery.trim())

      const res = await fetch(`/api/v1/hr/staff?${sp.toString()}`).then((r) => r.json())
      if (res.success) setStaffList(res.data)
    } catch (e: any) {
      toast.error('Failed to load staff directory', e.message)
    }
  }, [staffBranch, staffStatus, staffDept, searchQuery, toast])

  const loadAttendance = useCallback(async () => {
    try {
      setAttendanceRecords(null)
      const sp = new URLSearchParams({ date: attendanceDate })
      if (attendanceBranch !== 'ALL') sp.set('branchId', attendanceBranch)

      const res = await fetch(`/api/v1/hr/attendance?${sp.toString()}`).then((r) => r.json())
      if (res.success) setAttendanceRecords(res.data.records)
    } catch (e: any) {
      toast.error('Failed to load attendance', e.message)
    }
  }, [attendanceDate, attendanceBranch, toast])

  const loadLeaves = useCallback(async () => {
    try {
      setLeaves(null)
      const sp = new URLSearchParams()
      if (leaveStatus !== 'ALL') sp.set('status', leaveStatus)
      const res = await fetch(`/api/v1/hr/leaves?${sp.toString()}`).then((r) => r.json())
      if (res.success) setLeaves(res.data)
    } catch (e: any) {
      toast.error('Failed to load leaves', e.message)
    }
  }, [leaveStatus, toast])

  const loadPayroll = useCallback(async () => {
    try {
      setPayrollCycles(null)
      const res = await fetch('/api/v1/hr/payroll').then((r) => r.json())
      if (res.success) setPayrollCycles(res.data)
    } catch (e: any) {
      toast.error('Failed to load payroll cycles', e.message)
    }
  }, [toast])

  // Initial load
  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  // Tab switch loader
  useEffect(() => {
    if (tab === 'dashboard') loadOverview()
    else if (tab === 'employees') loadStaff()
    else if (tab === 'attendance') loadAttendance()
    else if (tab === 'leave') loadLeaves()
    else if (tab === 'payroll') loadPayroll()
  }, [tab, loadOverview, loadStaff, loadAttendance, loadLeaves, loadPayroll])

  // ── Actions ───────────────────────────────────────────────────

  const handleOpenStaff360 = async (staffId: string) => {
    setIs360Open(true)
    setLoading360(true)
    try {
      const res = await fetch(`/api/v1/hr/staff/${staffId}`).then((r) => r.json())
      if (res.success) {
        setStaff360(res.data)
      } else {
        toast.error('Failed to load staff profile', res.error?.message)
      }
    } catch (e: any) {
      toast.error('Error', e.message)
    } finally {
      setLoading360(false)
    }
  }

  const handleCreateStaff = async (formData: any) => {
    setBusy(true)
    try {
      const res = await fetch('/api/v1/hr/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          salary: {
            basicSalary: Number(formData.basicSalary),
            hra: Math.round(Number(formData.basicSalary) * 0.4),
            specialAllowance: Math.round(Number(formData.basicSalary) * 0.2),
          },
        }),
      }).then((r) => r.json())

      if (res.success) {
        toast.success('Staff Onboarded Successfully')
        setIsOnboardOpen(false)
        loadOverview()
        if (tab === 'employees') loadStaff()
      } else {
        toast.error('Onboarding Failed', res.error?.message)
      }
    } catch (e: any) {
      toast.error('Error', e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleSaveStaffEdit = async (formData: any) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/hr/staff/${formData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          phone: formData.phone,
          designation: formData.designation,
          department: formData.department,
          qualification: formData.qualification,
          employmentType: formData.employmentType,
          branchId: formData.branchId || null,
          salary: {
            basicSalary: parseFloat(formData.basicSalary) || 0,
            hra: parseFloat(formData.hra) || 0,
            specialAllowance: parseFloat(formData.specialAllowance) || 0,
          },
        }),
      }).then((r) => r.json())

      if (res.success) {
        toast.success('Staff profile updated')
        setIsEditStaffOpen(false)
        if (is360Open && staff360?.id === formData.id) {
          handleOpenStaff360(formData.id)
        }
        loadStaff()
      } else {
        toast.error('Update failed', res.error?.message)
      }
    } catch (e: any) {
      toast.error('Error', e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleSaveCorrection = async (payload: any) => {
    setBusy(true)
    try {
      const res = await fetch('/api/v1/hr/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((r) => r.json())

      if (res.success) {
        toast.success('Attendance correction recorded with audit trail')
        setIsCorrectionOpen(false)
        loadAttendance()
        loadOverview()
      } else {
        toast.error('Correction Failed', res.error?.message)
      }
    } catch (e: any) {
      toast.error('Error', e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleActionLeave = async (id: string, action: 'APPROVE' | 'REJECT', reason?: string) => {
    setLeaveActionLoading(true)
    try {
      const res = await fetch(`/api/v1/hr/leaves/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rejectionReason: reason }),
      }).then((r) => r.json())

      if (res.success) {
        toast.success(action === 'APPROVE' ? 'Leave Approved & Coverage Routed' : 'Leave Rejected')
        loadLeaves()
        loadOverview()
      } else {
        toast.error('Failed to action leave', res.error?.message)
      }
    } catch (e: any) {
      toast.error('Error', e.message)
    } finally {
      setLeaveActionLoading(false)
    }
  }

  const handleProcessPayroll = async (payload: any) => {
    setBusy(true)
    try {
      const res = await fetch('/api/v1/hr/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((r) => r.json())

      if (res.success) {
        toast.success('Payroll Calculation Completed', `Status: ${res.data.status}`)
        setIsProcessPayrollOpen(false)
        loadPayroll()
        loadOverview()
      } else {
        toast.error('Payroll Calculation Failed', res.error?.message)
      }
    } catch (e: any) {
      toast.error('Error', e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleDisbursePayroll = async (cycleId: string, reference: string) => {
    setBusy(true)
    try {
      const res = await fetch('/api/v1/hr/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DISBURSE',
          cycleId,
          paymentReference: reference,
        }),
      }).then((r) => r.json())

      if (res.success) {
        toast.success('Payroll Disbursed & Locked')
        setIsDisburseOpen(false)
        loadPayroll()
        loadOverview()
      } else {
        toast.error('Disbursement Failed', res.error?.message)
      }
    } catch (e: any) {
      toast.error('Error', e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleExportBankFile = (cycleId: string) => {
    try {
      const link = document.createElement('a')
      link.href = `/api/v1/hr/payroll?export=true&cycleId=${cycleId}`
      link.download = `bank-payout-${cycleId}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('Downloading Bank NEFT CSV')
    } catch (e: any) {
      toast.error('Failed to export bank file', e.message)
    }
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 40 }} className="p-4 md:p-6 space-y-6">
      {/* ── Top Header & Tab Navigation ── */}
      <HRHeader
        activeTab={tab}
        onTabChange={handleTabChange}
        lastSyncTime={lastSyncTime}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefresh={() => {
          loadOverview()
          if (tab === 'employees') loadStaff()
          if (tab === 'attendance') loadAttendance()
          if (tab === 'leave') loadLeaves()
          if (tab === 'payroll') loadPayroll()
        }}
        busy={busy}
        pendingRequestsCount={metrics?.pendingLeaves || 0}
        onOpenOnboard={() => setIsOnboardOpen(true)}
        canWrite={canWrite}
        canPayroll={canPayroll}
        canApprove={canApprove}
        onOpenProcessPayroll={() => setIsProcessPayrollOpen(true)}
      />

      {/* ── Tab Workspace ── */}
      <main className="min-h-[400px]">
        {tab === 'dashboard' && (
          <HRDashboardTab
            metrics={metrics}
            loading={busy && !metrics}
            onNavigateTab={handleTabChange}
            onOpenOnboard={() => setIsOnboardOpen(true)}
            canWrite={canWrite}
          />
        )}

        {tab === 'employees' && (
          <HREmployeesTab
            staffList={staffList}
            branches={branches}
            branchFilter={staffBranch}
            onBranchFilterChange={setStaffBranch}
            statusFilter={staffStatus}
            onStatusFilterChange={setStaffStatus}
            departmentFilter={staffDept}
            onDepartmentFilterChange={setStaffDept}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onViewStaff={handleOpenStaff360}
            onEditStaff={(s) => {
              setEditStaffData(s)
              setIsEditStaffOpen(true)
            }}
            onOpenOnboard={() => setIsOnboardOpen(true)}
            canWrite={canWrite}
          />
        )}

        {tab === 'attendance' && (
          <HRAttendanceTab
            attendanceRecords={attendanceRecords}
            date={attendanceDate}
            onDateChange={setAttendanceDate}
            branches={branches}
            branchFilter={attendanceBranch}
            onBranchFilterChange={setAttendanceBranch}
            statusFilter={attendanceStatus}
            onStatusFilterChange={setAttendanceStatus}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onOpenCorrection={(rec) => {
              setCorrectionTarget(rec)
              setIsCorrectionOpen(true)
            }}
            canWrite={canWrite}
          />
        )}

        {tab === 'leave' && (
          <HRLeaveTab
            leaves={leaves}
            statusFilter={leaveStatus}
            onStatusFilterChange={setLeaveStatus}
            onActionLeave={handleActionLeave}
            canApprove={canApprove}
            canWrite={canWrite}
            loadingAction={leaveActionLoading}
          />
        )}

        {tab === 'schedule' && <HRScheduleTab branchFilter={staffBranch} />}

        {tab === 'payroll' && (
          <HRPayrollTab
            cycles={payrollCycles}
            onOpenProcessPayroll={() => setIsProcessPayrollOpen(true)}
            onOpenDisburse={(c) => {
              setDisburseTarget(c)
              setIsDisburseOpen(true)
            }}
            onExportBankFile={handleExportBankFile}
            canPayroll={canPayroll}
          />
        )}

        {tab === 'performance' && <HRPerformanceTab canWrite={canWrite} />}

        {tab === 'training' && <HRTrainingTab canWrite={canWrite} />}

        {tab === 'requests' && (
          <HRRequestsTab
            canApprove={canApprove}
            onLeaveAction={handleActionLeave}
          />
        )}

        {tab === 'reports' && <HRReportsTab branches={branches} />}
      </main>

      {/* ── Modals & Drawers ── */}
      <Staff360Drawer
        open={is360Open}
        onClose={() => setIs360Open(false)}
        staff={staff360}
        loading={loading360}
      />

      <AddStaffModal
        open={isOnboardOpen}
        onClose={() => setIsOnboardOpen(false)}
        branches={branches}
        onSubmit={handleCreateStaff}
        loading={busy}
      />

      <EditStaffModal
        open={isEditStaffOpen}
        onClose={() => setIsEditStaffOpen(false)}
        staff={editStaffData}
        branches={branches}
        onSave={handleSaveStaffEdit}
        loading={busy}
      />

      <AttendanceCorrectionModal
        open={isCorrectionOpen}
        onClose={() => setIsCorrectionOpen(false)}
        record={correctionTarget}
        date={attendanceDate}
        onSave={handleSaveCorrection}
        loading={busy}
      />

      <ProcessPayrollModal
        open={isProcessPayrollOpen}
        onClose={() => setIsProcessPayrollOpen(false)}
        branches={branches}
        onProcess={handleProcessPayroll}
        loading={busy}
      />

      <DisbursePayrollModal
        open={isDisburseOpen}
        onClose={() => setIsDisburseOpen(false)}
        cycle={disburseTarget}
        onDisburse={handleDisbursePayroll}
        loading={busy}
      />
    </div>
  )
}

export default function HRPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-muted-foreground">Loading HR workspace...</div>}>
      <HRPageContent />
    </Suspense>
  )
}
