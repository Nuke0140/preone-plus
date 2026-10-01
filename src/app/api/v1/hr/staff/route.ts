import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, withApi, errPermission } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { StaffService } from '@/lib/hr/staff-service'

/**
 * GET /api/v1/hr/staff — Search & Filter Staff Directory
 */
export const GET = withApi(async (req: NextRequest) => {
  const session = await requireApi(req, 'hr:read')
  if (isResponse(session)) return session
  if (!session.tenantId) {
    throw errPermission('No tenant context found in active session')
  }

  const sp = req.nextUrl.searchParams
  const search = sp.get('search') || ''
  const branchId = sp.get('branchId') || undefined
  const designation = sp.get('designation') || undefined
  const department = sp.get('department') || undefined
  const employmentType = sp.get('employmentType') || undefined
  const status = sp.get('status') || undefined

  const whereClause: any = {
    tenantId: session.tenantId,
    deletedAt: null,
    ...(branchId ? { branchId } : {}),
    ...(designation ? { designation } : {}),
    ...(department ? { department } : {}),
    ...(employmentType ? { employmentType: employmentType as any } : {}),
    ...(status ? { status: status as any } : {}),
  }

  if (search) {
    whereClause.OR = [
      { employeeCode: { contains: search, mode: 'insensitive' } },
      { user: { fullName: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
      { user: { phone: { contains: search, mode: 'insensitive' } } },
    ]
  }

  const profiles = await db.staffProfile.findMany({
    where: whereClause,
    include: {
      user: { select: { id: true, fullName: true, email: true, phone: true, status: true } },
      branch: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Map memberships and assigned classrooms
  const memberships = await db.tenantUser.findMany({
    where: { tenantId: session.tenantId, deletedAt: null },
  })
  const mByUser = new Map<string, any>(memberships.map((m) => [m.userId, m]))

  const classrooms = await db.classroom.findMany({
    where: { tenantId: session.tenantId, isActive: true, primaryTeacherId: { not: null } },
    select: { id: true, name: true, primaryTeacherId: true },
  })
  const clsByTeacher = new Map<string, string[]>()
  for (const c of classrooms) {
    if (!c.primaryTeacherId) continue
    const arr = clsByTeacher.get(c.primaryTeacherId) || []
    arr.push(c.name)
    clsByTeacher.set(c.primaryTeacherId, arr)
  }

  return ok(
    profiles.map((p) => {
      const m = mByUser.get(p.userId)
      return {
        id: p.id,
        userId: p.userId,
        name: p.user.fullName,
        email: p.user.email,
        phone: p.user.phone,
        employeeCode: p.employeeCode,
        designation: p.designation,
        department: p.department,
        qualification: p.qualification,
        employmentType: p.employmentType,
        status: p.status,
        branchId: p.branchId,
        branchName: p.branch?.name || null,
        role: m?.role || null,
        roles: m?.roles || [],
        joiningDate: p.joiningDate,
        probationEndDate: p.probationEndDate,
        noticePeriodDays: p.noticePeriodDays,
        assignedClassrooms: clsByTeacher.get(p.userId) || [],
      }
    })
  )
}, { module: 'hr' })

/**
 * POST /api/v1/hr/staff — Atomic Staff Onboarding
 */
export const POST = withApi(async (req: NextRequest) => {
  const session = await requireApi(req, 'hr:write')
  if (isResponse(session)) return session
  if (!session.tenantId) {
    throw errPermission('No tenant context found in active session')
  }

  const body = await req.json()
  const staff = await StaffService.createStaff(
    {
      ...body,
      tenantId: session.tenantId,
    },
    {
      id: session.uid,
      name: session.name,
      role: session.role,
    }
  )

  return ok(staff)
}, { module: 'hr' })
