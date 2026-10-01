/**
 * PreOne — Canonical Report Registry
 *
 * Single catalog defining approved reports across all 12 PreOne domains.
 * Defines access permissions, domain sources, supported scopes, and column schemas.
 */

import { ReportDefinition } from './report-types'

export const REPORT_REGISTRY: ReportDefinition[] = [
  // 1. EXECUTIVE
  {
    id: 'exec-overview',
    title: 'Executive School Overview',
    description: 'High-level operational snapshot of student strength, attendance, fees, and staffing.',
    domain: 'EXECUTIVE',
    canonicalSource: 'Student, Attendance, Invoice, StaffProfile',
    requiredPermission: 'reports:read',
    allowedRoles: ['PLATFORM_ADMIN', 'OWNER', 'PRINCIPAL', 'COORDINATOR'],
    freshness: 'REAL_TIME',
    columns: [
      { key: 'metric', label: 'Metric', type: 'STRING' },
      { key: 'category', label: 'Category', type: 'STRING' },
      { key: 'value', label: 'Current Value', type: 'STRING', align: 'right' },
      { key: 'target', label: 'Target / Baseline', type: 'STRING', align: 'right' },
      { key: 'status', label: 'Status', type: 'ENUM', align: 'center' },
    ],
    availableFilters: ['branchId', 'academicSessionId'],
    drilldownTarget: 'students-strength',
  },

  // 2. STUDENTS
  {
    id: 'students-strength',
    title: 'Student Strength & Enrollment Directory',
    description: 'Enrolled students with classroom allocations, programs, and admission status.',
    domain: 'STUDENTS',
    canonicalSource: 'Student, StudentAllocation, Classroom',
    requiredPermission: 'reports:read',
    allowedRoles: ['PLATFORM_ADMIN', 'OWNER', 'PRINCIPAL', 'COORDINATOR', 'TEACHER', 'PARENT'],
    supportsClassroomScope: true,
    supportsParentScope: true,
    freshness: 'REAL_TIME',
    columns: [
      { key: 'admissionNumber', label: 'Adm #', type: 'STRING', sortable: true },
      { key: 'fullName', label: 'Student Name', type: 'STRING', sortable: true },
      { key: 'classroom', label: 'Classroom', type: 'STRING', sortable: true },
      { key: 'program', label: 'Program', type: 'STRING' },
      { key: 'status', label: 'Status', type: 'ENUM', align: 'center' },
      { key: 'gender', label: 'Gender', type: 'ENUM' },
      { key: 'dob', label: 'Date of Birth', type: 'DATE' },
    ],
    defaultSort: { field: 'fullName', order: 'asc' },
    availableFilters: ['branchId', 'academicSessionId', 'classroomId', 'status', 'programType'],
  },

  // 3. ADMISSIONS
  {
    id: 'admissions-funnel',
    title: 'Admissions Funnel & Enquiry Conversion',
    description: 'Tracking prospective leads through enquiry, application, offer, and enrollment.',
    domain: 'ADMISSIONS',
    canonicalSource: 'Lead, AdmissionApplication, AdmissionOffer',
    requiredPermission: 'reports:read',
    allowedRoles: ['PLATFORM_ADMIN', 'OWNER', 'PRINCIPAL', 'COORDINATOR', 'RECEPTIONIST'],
    freshness: 'REAL_TIME',
    columns: [
      { key: 'leadNumber', label: 'Enquiry / App #', type: 'STRING', sortable: true },
      { key: 'parentName', label: 'Parent Name', type: 'STRING' },
      { key: 'childName', label: 'Child Name', type: 'STRING' },
      { key: 'source', label: 'Source', type: 'STRING' },
      { key: 'stage', label: 'Funnel Stage', type: 'ENUM', align: 'center' },
      { key: 'status', label: 'Status', type: 'ENUM', align: 'center' },
      { key: 'createdAt', label: 'Date', type: 'DATE', sortable: true },
    ],
    defaultSort: { field: 'createdAt', order: 'desc' },
    availableFilters: ['branchId', 'academicSessionId', 'source', 'status'],
  },

  // 4. ATTENDANCE
  {
    id: 'attendance-daily',
    title: 'Daily Attendance Register & Analysis',
    description: 'Attendance statuses, arrival times, and late logs for students.',
    domain: 'ATTENDANCE',
    canonicalSource: 'Attendance, Student, Classroom',
    requiredPermission: 'reports:read',
    allowedRoles: ['PLATFORM_ADMIN', 'OWNER', 'PRINCIPAL', 'COORDINATOR', 'TEACHER', 'ACCOUNTS', 'PARENT'],
    supportsClassroomScope: true,
    supportsParentScope: true,
    freshness: 'REAL_TIME',
    columns: [
      { key: 'date', label: 'Date', type: 'DATE', sortable: true },
      { key: 'admissionNumber', label: 'Adm #', type: 'STRING' },
      { key: 'studentName', label: 'Student Name', type: 'STRING', sortable: true },
      { key: 'classroom', label: 'Classroom', type: 'STRING' },
      { key: 'status', label: 'Attendance', type: 'ENUM', align: 'center' },
      { key: 'arrivalTime', label: 'Check-in Time', type: 'STRING', align: 'center' },
      { key: 'notes', label: 'Notes', type: 'STRING' },
    ],
    defaultSort: { field: 'date', order: 'desc' },
    availableFilters: ['date', 'classroomId', 'status', 'branchId', 'academicSessionId'],
  },

  // 5. OPERATIONS
  {
    id: 'operations-daily',
    title: 'Daily Operations & Care Activity Report',
    description: 'Care sheet entries, meals, rest times, health checks, and safety incidents.',
    domain: 'OPERATIONS',
    canonicalSource: 'TimelineEntry, Classroom',
    requiredPermission: 'reports:read',
    allowedRoles: ['PLATFORM_ADMIN', 'OWNER', 'PRINCIPAL', 'COORDINATOR', 'TEACHER', 'PARENT'],
    supportsClassroomScope: true,
    supportsParentScope: true,
    freshness: 'REAL_TIME',
    columns: [
      { key: 'time', label: 'Time', type: 'STRING', sortable: true },
      { key: 'studentName', label: 'Student', type: 'STRING' },
      { key: 'type', label: 'Activity Type', type: 'STRING' },
      { key: 'title', label: 'Title', type: 'STRING' },
      { key: 'description', label: 'Details', type: 'STRING' },
      { key: 'isImportant', label: 'Alert Flag', type: 'BOOLEAN', align: 'center' },
    ],
    defaultSort: { field: 'time', order: 'desc' },
    availableFilters: ['date', 'classroomId', 'type', 'branchId'],
  },

  // 6. ACADEMICS
  {
    id: 'academics-milestones',
    title: 'Academic Milestone Progress & Observations',
    description: 'Observation records, learning goals achieved, and developmental milestones.',
    domain: 'ACADEMICS',
    canonicalSource: 'Observation, StudentProgress, ClassroomActivity',
    requiredPermission: 'reports:read',
    allowedRoles: ['PLATFORM_ADMIN', 'OWNER', 'PRINCIPAL', 'COORDINATOR', 'TEACHER', 'PARENT'],
    supportsClassroomScope: true,
    supportsParentScope: true,
    freshness: 'NEAR_REAL_TIME',
    columns: [
      { key: 'studentName', label: 'Student', type: 'STRING', sortable: true },
      { key: 'classroom', label: 'Classroom', type: 'STRING' },
      { key: 'learningArea', label: 'Learning Area', type: 'STRING' },
      { key: 'milestone', label: 'Milestone / Goal', type: 'STRING' },
      { key: 'status', label: 'Status', type: 'ENUM', align: 'center' },
      { key: 'assessedAt', label: 'Observed Date', type: 'DATE' },
    ],
    defaultSort: { field: 'assessedAt', order: 'desc' },
    availableFilters: ['classroomId', 'academicSessionId', 'learningAreaId', 'status'],
  },

  // 7. FINANCE - COLLECTIONS
  {
    id: 'finance-collections',
    title: 'Fee Collections & Payments Register',
    description: 'Payments received, receipt numbers, payment modes, and clearance status.',
    domain: 'FINANCE',
    canonicalSource: 'Payment, Receipt, Invoice',
    requiredPermission: 'reports:read',
    allowedRoles: ['PLATFORM_ADMIN', 'OWNER', 'PRINCIPAL', 'COORDINATOR', 'ACCOUNTS', 'PARENT'],
    supportsParentScope: true,
    freshness: 'REAL_TIME',
    columns: [
      { key: 'receiptNumber', label: 'Receipt #', type: 'STRING', sortable: true },
      { key: 'invoiceNumber', label: 'Invoice #', type: 'STRING' },
      { key: 'studentName', label: 'Student', type: 'STRING' },
      { key: 'amount', label: 'Amount Paid (₹)', type: 'CURRENCY', align: 'right', sortable: true },
      { key: 'paymentMethod', label: 'Payment Mode', type: 'ENUM', align: 'center' },
      { key: 'transactionRef', label: 'Ref / Cheque #', type: 'STRING' },
      { key: 'paymentDate', label: 'Payment Date', type: 'DATE', sortable: true },
      { key: 'status', label: 'Status', type: 'ENUM', align: 'center' },
    ],
    defaultSort: { field: 'paymentDate', order: 'desc' },
    availableFilters: ['startDate', 'endDate', 'paymentMethod', 'branchId', 'academicSessionId'],
  },

  // 8. FINANCE - OUTSTANDING & AGING
  {
    id: 'finance-outstanding',
    title: 'Fee Outstanding & Aging Analysis',
    description: 'Overdue invoices, aging buckets (0-30, 31-60, 61-90, 90+ days), and balances.',
    domain: 'FINANCE',
    canonicalSource: 'Invoice, Student, Classroom',
    requiredPermission: 'reports:read',
    allowedRoles: ['PLATFORM_ADMIN', 'OWNER', 'PRINCIPAL', 'COORDINATOR', 'ACCOUNTS', 'PARENT'],
    supportsParentScope: true,
    freshness: 'REAL_TIME',
    columns: [
      { key: 'invoiceNumber', label: 'Invoice #', type: 'STRING', sortable: true },
      { key: 'studentName', label: 'Student', type: 'STRING', sortable: true },
      { key: 'classroom', label: 'Classroom', type: 'STRING' },
      { key: 'totalAmount', label: 'Billed (₹)', type: 'CURRENCY', align: 'right' },
      { key: 'paidAmount', label: 'Paid (₹)', type: 'CURRENCY', align: 'right' },
      { key: 'balance', label: 'Balance Due (₹)', type: 'CURRENCY', align: 'right', sortable: true },
      { key: 'dueDate', label: 'Due Date', type: 'DATE', sortable: true },
      { key: 'agingDays', label: 'Overdue Days', type: 'NUMBER', align: 'right' },
      { key: 'status', label: 'Status', type: 'ENUM', align: 'center' },
    ],
    defaultSort: { field: 'dueDate', order: 'asc' },
    availableFilters: ['classroomId', 'branchId', 'status', 'academicSessionId'],
  },

  // 9. HR & WORKFORCE
  {
    id: 'hr-headcount',
    title: 'Workforce Headcount & Attendance Register',
    description: 'Staff directory, designations, attendance logs, and leave utilization.',
    domain: 'HR',
    canonicalSource: 'StaffProfile, AttendanceStaff, User',
    requiredPermission: 'reports:read',
    allowedRoles: ['PLATFORM_ADMIN', 'OWNER', 'PRINCIPAL', 'COORDINATOR'],
    freshness: 'REAL_TIME',
    columns: [
      { key: 'employeeCode', label: 'Emp Code', type: 'STRING', sortable: true },
      { key: 'fullName', label: 'Staff Name', type: 'STRING', sortable: true },
      { key: 'designation', label: 'Designation', type: 'STRING' },
      { key: 'department', label: 'Department', type: 'STRING' },
      { key: 'employmentType', label: 'Type', type: 'ENUM' },
      { key: 'attendanceToday', label: "Today's Status", type: 'ENUM', align: 'center' },
      { key: 'joiningDate', label: 'Joining Date', type: 'DATE' },
    ],
    defaultSort: { field: 'fullName', order: 'asc' },
    availableFilters: ['branchId', 'designation', 'department', 'employmentType'],
  },

  // 10. TRANSPORT & FLEET
  {
    id: 'transport-utilization',
    title: 'Transport Fleet, Ridership & Route Utilization',
    description: 'Vehicle capacity, active student riders, stops, and trip safety completion.',
    domain: 'TRANSPORT',
    canonicalSource: 'Vehicle, TransportRoute, TransportTrip, TripManifestItem',
    requiredPermission: 'reports:read',
    allowedRoles: ['PLATFORM_ADMIN', 'OWNER', 'PRINCIPAL', 'COORDINATOR', 'PARENT'],
    supportsParentScope: true,
    freshness: 'REAL_TIME',
    columns: [
      { key: 'routeCode', label: 'Route Code', type: 'STRING', sortable: true },
      { key: 'routeName', label: 'Route Name', type: 'STRING' },
      { key: 'vehicleReg', label: 'Vehicle Reg #', type: 'STRING' },
      { key: 'capacity', label: 'Seat Capacity', type: 'NUMBER', align: 'right' },
      { key: 'activeRiders', label: 'Assigned Riders', type: 'NUMBER', align: 'right' },
      { key: 'utilizationPercent', label: 'Capacity Utilized', type: 'PERCENTAGE', align: 'right' },
      { key: 'status', label: 'Status', type: 'ENUM', align: 'center' },
    ],
    defaultSort: { field: 'routeCode', order: 'asc' },
    availableFilters: ['branchId', 'status'],
  },

  // 11. INVENTORY & STOCK
  {
    id: 'inventory-valuation',
    title: 'Inventory Stock Valuation & Low Stock Alerts',
    description: 'Current item quantities, minimum thresholds, 30-day expiries, and reorder levels.',
    domain: 'INVENTORY',
    canonicalSource: 'InventoryItem, InventoryStock',
    requiredPermission: 'reports:read',
    allowedRoles: ['PLATFORM_ADMIN', 'OWNER', 'PRINCIPAL', 'COORDINATOR', 'ACCOUNTS'],
    freshness: 'REAL_TIME',
    columns: [
      { key: 'itemCode', label: 'Item Code', type: 'STRING', sortable: true },
      { key: 'itemName', label: 'Item Name', type: 'STRING', sortable: true },
      { key: 'category', label: 'Category', type: 'STRING' },
      { key: 'quantity', label: 'Current Qty', type: 'NUMBER', align: 'right' },
      { key: 'minThreshold', label: 'Min Level', type: 'NUMBER', align: 'right' },
      { key: 'unitPrice', label: 'Unit Price (₹)', type: 'CURRENCY', align: 'right' },
      { key: 'totalValue', label: 'Stock Value (₹)', type: 'CURRENCY', align: 'right', sortable: true },
      { key: 'stockStatus', label: 'Alert Status', type: 'ENUM', align: 'center' },
    ],
    defaultSort: { field: 'itemName', order: 'asc' },
    availableFilters: ['branchId', 'categoryId', 'stockStatus'],
  },
]

export function getReportById(id: string): ReportDefinition | undefined {
  return REPORT_REGISTRY.find((r) => r.id === id)
}

export function getReportsForRole(role: string, roles: string[] = []): ReportDefinition[] {
  const allRoles = roles.length > 0 ? roles : [role]
  return REPORT_REGISTRY.filter((report) => {
    if (allRoles.includes('PLATFORM_ADMIN') || allRoles.includes('OWNER')) return true
    return report.allowedRoles.some((allowed) => allRoles.includes(allowed))
  })
}
