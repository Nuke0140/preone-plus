import { Role } from '@/lib/auth'
import { CANONICAL_ROLES, CanonicalRole, ROLE_META } from '@/lib/roles'

export type { Role }

export interface ClassroomOption {
  id: string
  name: string
  programType?: string
  code?: string
  branchId?: string | null
}

export interface BranchOption {
  id: string
  name: string
  code: string
  isMain?: boolean
}

export interface GuardianChild {
  id: string
  name: string
  admissionNo: string
  canPickup: boolean
  receivesComm?: boolean
  pickupPin?: string | null
  relationship?: string
  classroom?: string
}

export type UserLifecycleStatus =
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'LOCKED'
  | 'DEACTIVATED'
  | 'ARCHIVED'
  | 'INACTIVE'
  | 'PENDING'

export interface UserRecord {
  id: string
  userId: string
  username?: string | null
  avatarUrl?: string | null
  name: string
  email: string | null
  phone: string | null
  role: Role
  roles?: Role[]
  status: UserLifecycleStatus
  branchId: string | null
  lastLoginAt: string | null
  createdAt: string
  staffProfile?: {
    employeeCode: string
    designation: string | null
    department: string | null
    qualification: string | null
    employmentType: string
    joiningDate?: string | null
    dateOfBirth?: string | null
    gender?: string | null
    currentAddress?: string | null
  } | null
  taughtClasses?: Array<{ id: string; name: string; programType: string; capacity?: number }>
  guardianProfile?: {
    id: string
    relationship: string
    students: GuardianChild[]
  } | null
}

export const CANONICAL_STAFF_ROLES: Role[] = [
  'OWNER',
  'PRINCIPAL',
  'VICE_PRINCIPAL',
  'COORDINATOR',
  'TEACHER',
  'EXAM_CELL',
  'COUNSELOR',
  'LIBRARIAN',
  'LAB_ASSISTANT',
  'STAFF',
  'ACCOUNTS',
  'RECEPTIONIST',
  'ATTENDANT',
  'DRIVER',
  'TRANSPORT_INCHARGE',
]

export const CANONICAL_FAMILY_ROLES: Role[] = ['PARENT', 'GUARDIAN']

export const CANONICAL_RELATIONSHIPS = [
  'FATHER',
  'MOTHER',
  'GUARDIAN',
  'SIBLING',
  'GRANDPARENT',
  'OTHER',
] as const

export const ROLE_BADGE: Record<string, { cls: string; label: string }> = {
  OWNER: { cls: 'b-primary', label: 'Owner / Trust Head' },
  PRINCIPAL: { cls: 'b-info', label: 'Principal / Center Head' },
  VICE_PRINCIPAL: { cls: 'b-info', label: 'Vice Principal' },
  COORDINATOR: { cls: 'b-cyan', label: 'Academic Coordinator' },
  TEACHER: { cls: 'b-success', label: 'Teacher / Educator' },
  STAFF: { cls: 'b-neutral', label: 'General Staff / Operations' },
  ACCOUNTS: { cls: 'b-warning', label: 'Accounts & Finance' },
  RECEPTIONIST: { cls: 'b-pink', label: 'Front Desk / Reception' },
  ATTENDANT: { cls: 'b-teal-soft', label: 'Attendant / Caregiver' },
  DRIVER: { cls: 'b-orange', label: 'Driver / Transport' },
  TRANSPORT_INCHARGE: { cls: 'b-orange-soft', label: 'Transport In-charge' },
  LIBRARIAN: { cls: 'b-amber', label: 'Librarian' },
  LAB_ASSISTANT: { cls: 'b-teal', label: 'Lab Assistant' },
  EXAM_CELL: { cls: 'b-purple', label: 'Exam Cell' },
  COUNSELOR: { cls: 'b-cyan', label: 'Counselor / Wellness' },
  PARENT: { cls: 'b-primary', label: 'Parent' },
  GUARDIAN: { cls: 'b-amber', label: 'Guardian' },
}

export interface RoleMatrixItem {
  role: string
  label: string
  description: string
  scope: string
  userCount: number
  permissions: string[]
}

export const DEFAULT_ROLES_MATRIX: RoleMatrixItem[] = [
  {
    role: 'OWNER',
    label: 'Owner',
    description: 'Full institutional control across all campuses, finances, configurations, and user accounts',
    scope: 'Institution / Multi-Branch',
    userCount: 1,
    permissions: ['*'],
  },
  {
    role: 'PRINCIPAL',
    label: 'Principal',
    description: 'Complete academic, admissions, operational, attendance, and branch staff management',
    scope: 'Campus / Branch',
    userCount: 1,
    permissions: ['students:read', 'students:write', 'admissions:approve', 'attendance:approve', 'finance:read', 'academics:approve', 'users:write'],
  },
  {
    role: 'VICE_PRINCIPAL',
    label: 'Vice Principal',
    description: 'Deputy campus head — academic + administrative authority across admissions, staff, and operations when the Principal is unavailable',
    scope: 'Campus / Branch (Deputy Authority)',
    userCount: 0,
    permissions: ['students:read', 'students:write', 'admissions:approve', 'attendance:approve', 'users:write', 'exams:write', 'results:publish', 'timetable:write', 'reports:read'],
  },
  {
    role: 'COORDINATOR',
    label: 'Academic Coordinator',
    description: 'Pedagogical supervisor coordinating classroom activities, lesson plans, and teaching staff',
    scope: 'Academic Programs & Classrooms',
    userCount: 0,
    permissions: ['students:read', 'attendance:mark', 'academics:write', 'academics:approve', 'timeline:read', 'reports:read'],
  },
  {
    role: 'TEACHER',
    label: 'Teacher',
    description: 'Assigned classroom management, student attendance, daily activity timeline, and learning observations',
    scope: 'Assigned Classroom & Students',
    userCount: 5,
    permissions: ['students:read', 'attendance:mark', 'academics:read', 'timeline:read', 'reports:read'],
  },
  {
    role: 'STAFF',
    label: 'Staff',
    description: 'General administrative support, human resources assistance, and operations',
    scope: 'Campus / Operations',
    userCount: 0,
    permissions: ['users:read', 'attendance:read', 'operations:write', 'hr:read', 'reports:read'],
  },
  {
    role: 'ACCOUNTS',
    label: 'Accounts',
    description: 'Fee schedules, student invoicing, collections, receipts, and financial records',
    scope: 'Campus / Branch Finance',
    userCount: 1,
    permissions: ['finance:read', 'finance:write', 'payroll:process', 'reports:export'],
  },
  {
    role: 'RECEPTIONIST',
    label: 'Receptionist',
    description: 'Front-desk admissions inquiries, phone calls, walk-in logs, and daily communications',
    scope: 'Front Office & Visitor Desk',
    userCount: 0,
    permissions: ['admissions:read', 'admissions:write', 'attendance:mark', 'communication:broadcast', 'operations:read'],
  },
  {
    role: 'ATTENDANT',
    label: 'Attendant / Helper',
    description: 'Classroom caretaking, student hygiene assistance, meal monitoring, and child welfare support',
    scope: 'Classroom & Childcare Support',
    userCount: 0,
    permissions: ['attendance:read', 'operations:read', 'inventory:request', 'hr:self'],
  },
  {
    role: 'LIBRARIAN',
    label: 'Librarian',
    description: 'Library in-charge — catalog management, book issue/return, fines, and overdue follow-ups',
    scope: 'Library & Catalog',
    userCount: 0,
    permissions: ['library:read', 'library:write', 'students:read', 'attendance:read', 'reports:read'],
  },
  {
    role: 'LAB_ASSISTANT',
    label: 'Lab Assistant',
    description: 'Laboratory support — lab equipment inventory, material requests, and classroom assistance',
    scope: 'Laboratory & Equipment',
    userCount: 0,
    permissions: ['inventory:read', 'inventory:request', 'inventory:issue', 'students:read', 'attendance:read'],
  },
  {
    role: 'EXAM_CELL',
    label: 'Exam Cell',
    description: 'Examination department — exam scheduling, marks management, results publication, and report cards',
    scope: 'Examinations & Results',
    userCount: 0,
    permissions: ['exams:read', 'exams:write', 'results:publish', 'students:read', 'timetable:read', 'reports:export'],
  },
  {
    role: 'TRANSPORT_INCHARGE',
    label: 'Transport In-charge',
    description: 'Transport coordinator — routes, vehicles, driver assignment, trips, and student transport allocation',
    scope: 'Transport Fleet & Routes',
    userCount: 0,
    permissions: ['transport:read', 'transport:write', 'transport:assign', 'transport:trip', 'students:read', 'reports:read'],
  },
  {
    role: 'COUNSELOR',
    label: 'Counselor',
    description: 'Student counselor — wellbeing observations, follow-ups, and parent communication for assigned cases',
    scope: 'Student Wellness & Follow-ups',
    userCount: 0,
    permissions: ['students:read', 'attendance:read', 'timeline:read', 'operations:write', 'communication:broadcast'],
  },
  {
    role: 'DRIVER',
    label: 'Driver',
    description: 'Student transit runs, vehicle boarding/deboarding verification, and transit route safety',
    scope: 'Assigned Transport Routes',
    userCount: 0,
    permissions: ['transport:read', 'transport:trip', 'transport:board', 'transport:drop', 'transport:incident'],
  },
  {
    role: 'PARENT',
    label: 'Parent',
    description: 'Family account with child daily timeline, notices, fee payments, and communication (Max 2 per student)',
    scope: 'Enrolled Children Only',
    userCount: 2,
    permissions: ['timeline:read', 'communication:read', 'finance:read', 'transport:read', 'reports:read'],
  },
  {
    role: 'GUARDIAN',
    label: 'Guardian',
    description: 'Authorized caregiver account with relationship-scoped child access (pickup authorization, attendance, diary)',
    scope: 'Linked Children Only (Relationship-Scoped)',
    userCount: 0,
    permissions: ['timeline:read', 'communication:read', 'students:read-linked', 'attendance:read-linked', 'diary:read-linked', 'milestones:read-linked', 'documents:read-linked', 'pickup:read-linked', 'pickup:verify-linked', 'transport:read'],
  },
]
