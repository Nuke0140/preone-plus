import { SignJWT, jwtVerify } from 'jose'

export const SESSION_COOKIE = 'preone_session'
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'preone-dev-jwt-secret-2f8b7c9d4e6a1f3b5c8d0e'
)

import { CANONICAL_ROLES, CanonicalRole, normalizeRole, LEGACY_ROLE_MAP } from './roles'

export const SCHOOL_ROLES = CANONICAL_ROLES.filter((r) => r !== 'PLATFORM_ADMIN')

export type SchoolRole = Exclude<CanonicalRole, 'PLATFORM_ADMIN'> | keyof typeof LEGACY_ROLE_MAP

export type Role = CanonicalRole | keyof typeof LEGACY_ROLE_MAP

export interface SessionPayload {
  uid: string
  email: string
  name: string
  tenantId: string | null
  branchId?: string | null
  role: Role // Canonical primary role
  roles?: Role[] // All assigned roles
}

// ── RBAC — permission bundles per role (PRD §7 + API Catalog §5.3) ──
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  PLATFORM_ADMIN: ['platform:manage', 'audit:read'],
  OWNER: ['*'],
  PRINCIPAL: [
    'students:read', 'students:write',
    'admissions:read', 'admissions:write', 'admissions:approve',
    'attendance:read', 'attendance:mark', 'attendance:approve',
    'finance:read', 'finance:write',
    'communication:read', 'communication:broadcast',
    'academics:read', 'academics:write', 'academics:approve',
    'timeline:read',
    'settings:read', 'settings:write',
    'users:read', 'users:write',
    'audit:read',
    'operations:read', 'operations:write', // M01 command centre + follow-up actions
    'inventory:read', 'inventory:write', 'inventory:request', 'inventory:approve', 'inventory:order', 'inventory:receive', 'inventory:issue', 'inventory:adjust',
    'hr:read', 'hr:write', 'hr:approve', 'payroll:process', 'hr:self',
    'transport:read', 'transport:write', 'transport:assign', 'transport:trip', 'transport:board', 'transport:drop', 'transport:incident',
    'exams:read', 'exams:write', 'results:publish',
    'timetable:read', 'timetable:write',
    'library:read', 'library:write',
    'hostel:read', 'hostel:write',
    'reports:read', 'reports:write', 'reports:export', 'reports:custom',
  ],
  COORDINATOR: [
    'students:read',
    'attendance:read', 'attendance:mark',
    'academics:read', 'academics:write', 'academics:approve',
    'communication:read', 'communication:broadcast',
    'timeline:read',
    'operations:read', 'operations:write',
    'inventory:read', 'inventory:request',
    'hr:self',
    'exams:read', 'exams:write',
    'timetable:read', 'timetable:write',
    'library:read', 'library:write',
    'hostel:read',
    'reports:read', 'reports:export',
  ],
  TEACHER: [
    'students:read',
    'attendance:read', 'attendance:mark',
    'academics:read', 'academics:write',
    'communication:read',
    'timeline:read',
    'operations:read', 'operations:write', // M01 own follow-ups + daily ops
    'inventory:read', 'inventory:request',
    'hr:self',
    'transport:read',
    'exams:read', 'exams:write', // marks entry for own classes
    'timetable:read', 'timetable:write', // own class timetable management
    'library:read',
    'hostel:read',
    'reports:read', 'reports:export',
  ],
  STAFF: [
    'users:read',
    'attendance:read',
    'operations:read', 'operations:write',
    'inventory:read', 'inventory:request',
    'hr:read', 'hr:self',
    'communication:read',
    'exams:read', 'timetable:read', 'library:read', 'hostel:read',
    'reports:read',
  ],
  ACCOUNTS: [
    'students:read',
    'finance:read', 'finance:write',
    'attendance:read',
    'audit:read',
    'operations:read', // M01 fee follow-ups visibility
    'inventory:read', 'inventory:order', 'inventory:receive',
    'hr:read', 'payroll:process', 'hr:self',
    'transport:read',
    'library:read', 'hostel:read',
    'reports:read', 'reports:export',
  ],
  RECEPTIONIST: [
    'students:read',
    'admissions:read', 'admissions:write',
    'attendance:read', 'attendance:mark',
    'communication:read', 'communication:broadcast',
    'operations:read', 'operations:write',
    'timeline:read',
    'inventory:read', 'inventory:request',
    'hr:self',
    'exams:read', 'timetable:read', 'library:read',
  ],
  ATTENDANT: [
    'attendance:read',
    'operations:read',
    'inventory:request',
    'hr:self',
  ],
  DRIVER: [
    'transport:read', 'transport:trip', 'transport:board', 'transport:drop', 'transport:incident',
    'students:read',
    'hr:self',
  ],
  PARENT: [
    'timeline:read',
    'communication:read',
    'finance:read',
    'transport:read',
    'reports:read',
    'students:read-linked',
    'attendance:read-linked',
    'diary:read-linked',
    'milestones:read-linked',
    'documents:read-linked',
    'pickup:read-linked',
    'exams:read-linked',      // child's exam schedule + report cards
    'timetable:read-linked',  // child's class timetable
    'library:read-linked',    // child's book issues
  ],
  GUARDIAN: [
    'timeline:read',
    'communication:read',
    'students:read-linked',
    'attendance:read-linked',
    'diary:read-linked',
    'milestones:read-linked',
    'documents:read-linked',
    'pickup:read-linked',
    'pickup:verify-linked',
    'transport:read',
    'exams:read-linked',
    'timetable:read-linked',
    'library:read-linked',
  ],
  // Legacy aliases
  HELPER: [
    'attendance:read',
    'operations:read',
    'inventory:request',
    'hr:self',
  ],
  ACCOUNTANT: [
    'students:read',
    'finance:read', 'finance:write',
    'attendance:read',
    'audit:read',
    'operations:read',
    'inventory:read', 'inventory:order', 'inventory:receive',
    'hr:read', 'payroll:process', 'hr:self',
    'transport:read',
    'reports:read', 'reports:export',
  ],
  HR: [
    'users:read', 'users:write',
    'hr:read', 'hr:write', 'hr:approve', 'payroll:process', 'hr:self',
    'audit:read',
    'reports:read', 'reports:export',
  ],
  RECEPTION: [
    'students:read',
    'admissions:read', 'admissions:write',
    'attendance:read', 'attendance:mark',
    'communication:read', 'communication:broadcast',
    'operations:read', 'operations:write',
    'timeline:read',
    'inventory:read', 'inventory:request',
    'hr:self',
  ],
}

/**
 * Evaluates whether a role or set of roles has a specific permission.
 * When an array of roles is provided, effective permissions are calculated
 * as the UNION of all permissions granted across the roles.
 */
export function can(roleOrRoles: Role | Role[] | undefined | null, permission: string): boolean {
  if (!roleOrRoles) return false
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles]
  if (roles.length === 0) return false

  return roles.some((role) => {
    const normalized = normalizeRole(role)
    const perms = ROLE_PERMISSIONS[role] || (ROLE_PERMISSIONS as Record<string, string[]>)[normalized] || []
    if (perms.includes(permission)) return true
    // '*' grants every SCHOOL-scope permission, but never platform-scope ones —
    // platform:* is reserved for PLATFORM_ADMIN (tenant plane ≠ school plane).
    if (perms.includes('*')) return !permission.startsWith('platform:')
    return false
  })
}

// ── JWT ──
export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('preone')
    .setExpirationTime('7d')
    .sign(SECRET)
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, { issuer: 'preone' })
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days
