export type HRTabKey =
  | 'dashboard'
  | 'employees'
  | 'attendance'
  | 'leave'
  | 'schedule'
  | 'payroll'
  | 'performance'
  | 'training'
  | 'requests'
  | 'reports'

export interface HRMetrics {
  totalStaff: number
  activeStaff: number
  onProbation: number
  presentToday: number
  absentToday: number
  onLeaveToday: number
  pendingLeaves: number
  openPositions: number
  pendingResignations: number
  poshDue: number
  latestPayrollStatus: string
  latestPayrollNet: number
  totalTeachers?: number
}

export interface BranchOption {
  id: string
  name: string
  code?: string
}

export interface StaffListItem {
  id: string
  userId: string
  name: string
  email: string
  phone: string | null
  employeeCode: string
  designation: string | null
  department: string | null
  qualification: string | null
  employmentType: string
  status: string
  branchId: string | null
  branchName: string | null
  role: string | null
  roles: string[]
  joiningDate: string | null
  probationEndDate: string | null
  noticePeriodDays: number
  assignedClassrooms: string[]
}

export interface AttendanceRecord {
  staffProfileId: string
  employeeCode: string
  name: string
  designation: string | null
  branchName: string | null
  status: string
  checkIn: string | null
  checkOut: string | null
  workedHours: number
  lateMinutes: number
  source: string
  notes: string | null
}

export interface LeaveRecord {
  id: string
  staffProfileId: string
  leaveTypeId: string
  startDate: string
  endDate: string
  totalDays: number
  reason: string
  status: string
  appliedAt: string
  actionedByName?: string | null
  actionedAt?: string | null
  rejectionReason?: string | null
  staffProfile: {
    employeeCode: string
    branch?: { name: string } | null
    user: { fullName: string; email: string }
  }
  leaveType: {
    name: string
    code: string
  }
  coverages?: Array<{
    id: string
    classroom: { name: string }
  }>
}

export interface PayrollCycleItem {
  id: string
  month: number
  year: number
  status: string
  totalStaff: number
  totalGross: number | string
  totalDeductions: number | string
  totalNetPayable: number | string
  lockedAt: string | null
  disbursedAt: string | null
  branch?: { id: string; name: string } | null
  payslips?: any[]
}

export const money = (n?: number | string | null) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`
export const timeOf = (d?: string | null) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—')
