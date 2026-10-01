import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { audit } from '@/lib/sequence'
import bcrypt from 'bcryptjs'
import type { UserRole } from '@prisma/client'
import { CANONICAL_ROLES, type CanonicalRole, normalizeRole } from '@/lib/roles'

const ASSIGNABLE_ROLES: CanonicalRole[] = CANONICAL_ROLES.filter(
  (r) => r !== 'PLATFORM_ADMIN' && r !== 'OWNER' && r !== 'PARENT' && r !== 'GUARDIAN'
)

/** GET /api/v1/staff — staff foundation list (profile + assignment state) */
async function _GET(req: NextRequest) {
  const session = await requireApi(req)
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const profiles = await db.staffProfile.findMany({
      where: { tenantId: session.tenantId, deletedAt: null },
      include: {
        user: { select: { id: true, fullName: true, email: true, status: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    const memberships = await db.tenantUser.findMany({ where: { tenantId: session.tenantId, deletedAt: null } })
    const mByUser = new Map<string, any>(memberships.map((m) => [m.userId, m]))
    const taughtCounts = await db.classroom.groupBy({
      by: ['primaryTeacherId'],
      where: { tenantId: session.tenantId, isActive: true, primaryTeacherId: { not: null } },
      _count: { _all: true },
    })
    const taught = new Map(taughtCounts.map((t) => [t.primaryTeacherId!, t._count._all]))

    return ok(profiles.map((p) => {
      const m = mByUser.get(p.userId)
      return {
        id: p.id, userId: p.userId, name: p.user.fullName, email: p.user.email,
        role: m?.role ?? null, branchId: p.branchId, branchName: p.branch?.name ?? null,
        employeeCode: p.employeeCode, designation: p.designation, qualification: p.qualification,
        joiningDate: p.joiningDate, employmentType: p.employmentType,
        emergencyContactName: p.emergencyContactName, emergencyContactPhone: p.emergencyContactPhone,
        status: p.status,
        membershipStatus: m?.status ?? 'NO_MEMBERSHIP',
        branchAssigned: p.branchId != null && m?.branchId != null,
        classesAssigned: taught.get(p.userId) ?? 0,
      }
    }))
  } catch (e) {
    return Errors.system(e)
  }
}

/**
 * POST /api/v1/staff — create staff member (M00 Step 8)
 * Two modes:
 *  - { mode:'link', userId } — attach StaffProfile to an existing tenant member
 *  - { mode:'new', fullName, email, password, role } — create User + TenantUser + StaffProfile in one transaction
 * "created ≠ assigned": operational assignment requires branchId.
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { mode = 'new', fullName, email, password, role, userId, branchId, employeeCode, designation, qualification, joiningDate, employmentType, emergencyContactName, emergencyContactPhone } = body

    if (!employeeCode) return Errors.validation('employeeCode is required')
    const dupCode = await db.staffProfile.findFirst({ where: { tenantId: session.tenantId, employeeCode, deletedAt: null } })
    if (dupCode) return Errors.conflict(`Employee code "${employeeCode}" already exists`)
    if (branchId) {
      const branch = await db.branch.findFirst({ where: { id: branchId, tenantId: session.tenantId, deletedAt: null } })
      if (!branch) return Errors.notFound('Branch')
    }

    let profile: { id: string }
    if (mode === 'link') {
      if (!userId) return Errors.validation('userId required for link mode')
      const m = await db.tenantUser.findFirst({ where: { tenantId: session.tenantId, userId, deletedAt: null } })
      if (!m) return Errors.notFound('Tenant member — create the account first')
      const existingProfile = await db.staffProfile.findFirst({ where: { userId, deletedAt: null } })
      if (existingProfile) return Errors.conflict('This user already has a staff profile')

      profile = await db.staffProfile.create({
        data: {
          tenantId: session.tenantId,
          userId,
          branchId: branchId || null,
          employeeCode,
          designation: designation || null,
          qualification: qualification || null,
          joiningDate: joiningDate ? new Date(joiningDate) : null,
          employmentType: employmentType || 'REGULAR',
          emergencyContactName: emergencyContactName || null,
          emergencyContactPhone: emergencyContactPhone || null,
        },
      })
    } else {
      if (!fullName || !email || !password || !role) {
        return Errors.validation('fullName, email, password and role are required for new staff')
      }
      const canonicalRole = normalizeRole(role)
      if (!ASSIGNABLE_ROLES.includes(canonicalRole)) {
        return Errors.validation(`role must be one of: ${ASSIGNABLE_ROLES.join(', ')}`)
      }
      if (password.length < 6) return Errors.validation('Password must be at least 6 characters', 'password')
      const existingUser = await db.user.findUnique({ where: { email: String(email).toLowerCase() } })
      if (existingUser) return Errors.conflict('A user with this email already exists')

      profile = await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: String(email).toLowerCase(),
            fullName,
            phone: body.phone || null,
            passwordHash: await bcrypt.hash(password, 10),
            status: 'ACTIVE',
          },
        })
        await tx.tenantUser.create({
          data: { tenantId: session.tenantId!, userId: user.id, role: canonicalRole as UserRole, branchId: branchId || null },
        })
        const p = await tx.staffProfile.create({
          data: {
            tenantId: session.tenantId!,
            userId: user.id,
            branchId: branchId || null,
            employeeCode,
            designation: designation || null,
            qualification: qualification || null,
            joiningDate: joiningDate ? new Date(joiningDate) : null,
            employmentType: employmentType || 'REGULAR',
            emergencyContactName: emergencyContactName || null,
            emergencyContactPhone: emergencyContactPhone || null,
          },
        })
        return p
      })
    }
    await audit({
      tenantId: session.tenantId, actorId: session.uid, actorName: session.name,
      action: 'CREATE', entity: 'StaffProfile', entityId: profile.id,
      summary: `Created staff profile ${employeeCode}${branchId ? ' with branch assignment' : ' (no branch assigned yet)'}`,
    })
    return ok({ id: profile.id, employeeCode, branchAssigned: !!branchId }, undefined, 201)
  } catch (e) {
    return Errors.system(e)
  }
}

/** PATCH /api/v1/staff — assign / update staff (branch assignment completes "Staff Foundation") */
async function _PATCH(req: NextRequest) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { id, branchId, designation, qualification, employmentType, emergencyContactName, emergencyContactPhone, membershipRole } = body
    if (!id) return Errors.validation('id is required')
    const profile = await db.staffProfile.findFirst({ where: { id, tenantId: session.tenantId, deletedAt: null } })
    if (!profile) return Errors.notFound('Staff profile')

    const data: Record<string, unknown> = {}
    if ('branchId' in body) data.branchId = branchId || null
    if (designation !== undefined) data.designation = designation || null
    if (qualification !== undefined) data.qualification = qualification || null
    if (employmentType) data.employmentType = employmentType
    if (emergencyContactName !== undefined) data.emergencyContactName = emergencyContactName || null
    if (emergencyContactPhone !== undefined) data.emergencyContactPhone = emergencyContactPhone || null
    const updated = await db.staffProfile.update({ where: { id }, data })

    if (branchId) {
      await db.tenantUser.updateMany({
        where: { tenantId: session.tenantId, userId: profile.userId },
        data: { branchId },
      })
    }
    if (membershipRole) {
      if (!ASSIGNABLE_ROLES.includes(membershipRole)) return Errors.validation(`membershipRole must be one of: ${ASSIGNABLE_ROLES.join(', ')}`)
      await db.tenantUser.updateMany({
        where: { tenantId: session.tenantId, userId: profile.userId },
        data: { role: membershipRole },
      })
    }
    await audit({
      tenantId: session.tenantId, actorId: session.uid, actorName: session.name,
      action: 'UPDATE', entity: 'StaffProfile', entityId: id,
      summary: `Updated staff ${profile.employeeCode}${branchId ? ' — operationally assigned to branch' : ''}`,
    })
    return ok({ id: updated.id, branchAssigned: updated.branchId != null })
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
export const PATCH = withApi(_PATCH)
