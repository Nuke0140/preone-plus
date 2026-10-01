/**
 * Canonical Role Architecture for PreOne Enterprise Preschool OS
 * Single Source of Truth for Roles, Metadata, Categorization, and Normalization.
 */

export const CANONICAL_ROLES = [
  'PLATFORM_ADMIN',
  'OWNER',
  'PRINCIPAL',
  'TEACHER',
  'STAFF',
  'ACCOUNTS',
  'RECEPTIONIST',
  'ATTENDANT',
  'DRIVER',
  'PARENT',
  'GUARDIAN',
  'COORDINATOR',
] as const

export type CanonicalRole = (typeof CANONICAL_ROLES)[number]

/**
 * Legacy role mapping to ensure backward-compatibility with previously stored or requested roles.
 * Note: Explicitly locked HELPER -> STAFF per architecture review.
 */
export const LEGACY_ROLE_MAP: Record<string, CanonicalRole> = {
  HELPER: 'STAFF',
  ACCOUNTANT: 'ACCOUNTS',
  HR: 'STAFF',
  RECEPTION: 'RECEPTIONIST',
}

export type RoleCategory = 'LEADERSHIP' | 'ACADEMIC' | 'OPERATIONS' | 'FAMILY' | 'PLATFORM'

export interface RoleMeta {
  role: CanonicalRole
  label: string
  category: RoleCategory
  description: string
  hierarchyLevel: number
  isAssignableBySchool: boolean
}

export const ROLE_META: Record<CanonicalRole, RoleMeta> = {
  PLATFORM_ADMIN: {
    role: 'PLATFORM_ADMIN',
    label: 'Platform Administrator',
    category: 'PLATFORM',
    description: 'System-wide administrative and infrastructure privileges across all tenants.',
    hierarchyLevel: 100,
    isAssignableBySchool: false,
  },
  OWNER: {
    role: 'OWNER',
    label: 'School Owner / Trustee',
    category: 'LEADERSHIP',
    description: 'Institution-wide ownership authority, financial oversight, governance, and full access.',
    hierarchyLevel: 90,
    isAssignableBySchool: true,
  },
  PRINCIPAL: {
    role: 'PRINCIPAL',
    label: 'Principal / Center Head',
    category: 'LEADERSHIP',
    description: 'Campus operational and pedagogical head with administrative and supervisory permissions.',
    hierarchyLevel: 80,
    isAssignableBySchool: true,
  },
  COORDINATOR: {
    role: 'COORDINATOR',
    label: 'Academic Coordinator',
    category: 'ACADEMIC',
    description: 'Curriculum lead supervising classroom teachers, lesson planning, and assessments.',
    hierarchyLevel: 60,
    isAssignableBySchool: true,
  },
  TEACHER: {
    role: 'TEACHER',
    label: 'Classroom Educator',
    category: 'ACADEMIC',
    description: 'Class teacher managing daily learning, observations, activities, and attendance.',
    hierarchyLevel: 50,
    isAssignableBySchool: true,
  },
  ACCOUNTS: {
    role: 'ACCOUNTS',
    label: 'Accounts & Billing Officer',
    category: 'OPERATIONS',
    description: 'Finance officer managing fee collections, invoices, receipts, and expense tracking.',
    hierarchyLevel: 40,
    isAssignableBySchool: true,
  },
  RECEPTIONIST: {
    role: 'RECEPTIONIST',
    label: 'Front Desk / Receptionist',
    category: 'OPERATIONS',
    description: 'Front office administrator managing walk-in inquiries, visitor logs, and communications.',
    hierarchyLevel: 30,
    isAssignableBySchool: true,
  },
  STAFF: {
    role: 'STAFF',
    label: 'General Staff / Operations',
    category: 'OPERATIONS',
    description: 'Operational and HR support staff assisting across center administration.',
    hierarchyLevel: 20,
    isAssignableBySchool: true,
  },
  ATTENDANT: {
    role: 'ATTENDANT',
    label: 'Caregiver / Attendant',
    category: 'OPERATIONS',
    description: 'Childcare assistant assisting with hygiene, safety, nutrition, and child comfort.',
    hierarchyLevel: 10,
    isAssignableBySchool: true,
  },
  DRIVER: {
    role: 'DRIVER',
    label: 'Transport Driver',
    category: 'OPERATIONS',
    description: 'Vehicle operator managing student transit, route boarding, and transport safety.',
    hierarchyLevel: 10,
    isAssignableBySchool: true,
  },
  PARENT: {
    role: 'PARENT',
    label: 'Parent / Primary Guardian',
    category: 'FAMILY',
    description: 'Mother, father, or primary guardian linked to student records, updates, and fee payments.',
    hierarchyLevel: 5,
    isAssignableBySchool: true,
  },
  GUARDIAN: {
    role: 'GUARDIAN',
    label: 'Authorized Guardian',
    category: 'FAMILY',
    description: 'Authorized family member or secondary guardian with linked child access and pickup rights.',
    hierarchyLevel: 5,
    isAssignableBySchool: true,
  },
}

/**
 * Normalizes any role string (canonical or legacy) into its canonical representation.
 */
export function normalizeRole(role: string): CanonicalRole {
  if (!role) return 'STAFF'
  const upper = role.trim().toUpperCase()
  if (CANONICAL_ROLES.includes(upper as CanonicalRole)) {
    return upper as CanonicalRole
  }
  if (LEGACY_ROLE_MAP[upper]) {
    return LEGACY_ROLE_MAP[upper]
  }
  return 'STAFF'
}

/**
 * Validates whether a given string corresponds to a known canonical role.
 */
export function isCanonicalRole(role: string): role is CanonicalRole {
  return CANONICAL_ROLES.includes(role as CanonicalRole)
}
