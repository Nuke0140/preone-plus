import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, bad, serverError } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { SCHOOL_ROLES, SchoolRole, ROLE_PERMISSIONS } from '@/lib/auth'
import { normalizeRole, CanonicalRole } from '@/lib/roles'

const ROLE_METADATA: Record<
  Exclude<CanonicalRole, 'PLATFORM_ADMIN'>,
  { label: string; description: string; category: 'EXECUTIVE' | 'ACADEMIC' | 'OPERATIONS' | 'PORTAL' }
> = {
  OWNER: {
    label: 'Owner / Trust Head',
    description: 'Full institutional control across all branches, finance, and system settings',
    category: 'EXECUTIVE',
  },
  PRINCIPAL: {
    label: 'Principal / Center Head',
    description: 'Complete academic, admissions, operational, and staff management',
    category: 'EXECUTIVE',
  },
  COORDINATOR: {
    label: 'Academic Coordinator',
    description: 'Curriculum supervision, lesson planning, and academic coordination',
    category: 'ACADEMIC',
  },
  TEACHER: {
    label: 'Teacher / Educator',
    description: 'Assigned classroom management, daily student attendance, activities, and logs',
    category: 'ACADEMIC',
  },
  STAFF: {
    label: 'Staff / Operations Support',
    description: 'General center administration, HR support, and operations',
    category: 'OPERATIONS',
  },
  ACCOUNTS: {
    label: 'Accounts / Billing Officer',
    description: 'Fee schedules, collections, invoicing, receipts, and financial ledgers',
    category: 'OPERATIONS',
  },
  RECEPTIONIST: {
    label: 'Front Desk / Receptionist',
    description: 'Inquiries, visitors, admissions front office, and school communications',
    category: 'OPERATIONS',
  },
  ATTENDANT: {
    label: 'Attendant / Caregiver',
    description: 'Classroom caretaking, student hygiene assistance, and meal support',
    category: 'OPERATIONS',
  },
  DRIVER: {
    label: 'Driver / Transport Operator',
    description: 'Route navigation, student boarding/drop verification, and vehicle logs',
    category: 'OPERATIONS',
  },
  PARENT: {
    label: 'Parent',
    description: 'Student daily timeline, notices, fee payments, and school communication',
    category: 'PORTAL',
  },
  GUARDIAN: {
    label: 'Guardian / Authorized Caregiver',
    description: 'Authorized pickup, child diary, updates, and verified attendance access',
    category: 'PORTAL',
  },
}

/**
 * GET /api/v1/users/roles — roles directory with user counts and permission matrix
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'users:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return bad('Tenant required', 'TENANT_REQUIRED')

  try {
    // Count active users per role
    const members = await db.tenantUser.findMany({
      where: { tenantId: session.tenantId, deletedAt: null },
      select: { role: true, roles: true },
    })

    const roleCounts: Record<string, number> = {}
    for (const r of SCHOOL_ROLES) {
      roleCounts[r] = 0
    }

    for (const m of members) {
      const allRoles = (m.roles && m.roles.length > 0 ? m.roles : [m.role]) as string[]
      for (const r of allRoles) {
        const canonical = normalizeRole(r)
        if (roleCounts[canonical] !== undefined) {
          roleCounts[canonical]++
        }
      }
    }

    const rolesList = SCHOOL_ROLES.map((role) => {
      const meta = ROLE_METADATA[role as SchoolRole] || {
        label: role,
        description: 'System role',
        category: 'OPERATIONS',
      }
      const permissions = ROLE_PERMISSIONS[role] || []

      return {
        role,
        label: meta.label,
        category: meta.category,
        description: meta.description,
        userCount: roleCounts[role] || 0,
        permissionsCount: permissions.includes('*') ? 'All Permissions' : permissions.length,
        permissions,
      }
    })

    return ok({ roles: rolesList })
  } catch (err: any) {
    return serverError(err.message)
  }
}

export const GET = withApi(_GET)
