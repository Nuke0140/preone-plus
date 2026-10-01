import { withApi } from '@/lib/with-api'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bad, serverError } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { recordAudit, getRequestMeta } from '@/lib/audit'
import { UserRole } from '@prisma/client'

/** Sanitize cell against spreadsheet formula injection (=, +, -, @, \t, \r) */
function sanitizeCsvCell(val: string | null | undefined): string {
  if (val === null || val === undefined) return '""'
  let s = String(val).trim()
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`
  }
  return `"${s.replace(/"/g, '""')}"`
}

/**
 * POST /api/v1/users/export — secure CSV export
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'users:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return bad('Tenant required', 'TENANT_REQUIRED')

  try {
    const body = await req.json().catch(() => ({}))
    const { userIds, role, branchId, status, userType, search } = body as {
      userIds?: string[]
      role?: UserRole
      branchId?: string
      status?: string
      userType?: string
      search?: string
    }

    const where: any = {
      tenantId: session.tenantId,
      deletedAt: null,
      ...(userIds && userIds.length > 0 ? { userId: { in: userIds } } : {}),
      ...(role
        ? {
            OR: [{ role }, { roles: { has: role } }],
          }
        : {}),
      ...(status ? { status } : {}),
      ...(branchId ? { branchId } : {}),
      ...(userType === 'PARENT'
        ? { OR: [{ role: 'PARENT' }, { roles: { has: 'PARENT' } }] }
        : userType === 'GUARDIAN'
        ? { OR: [{ role: 'GUARDIAN' }, { roles: { has: 'GUARDIAN' } }] }
        : userType === 'STAFF'
        ? { AND: [{ role: { notIn: ['PARENT', 'GUARDIAN'] } }, { NOT: { roles: { hasSome: ['PARENT', 'GUARDIAN'] } } }] }
        : {}),
      ...(search
        ? {
            user: {
              OR: [
                { fullName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
              ],
            },
          }
        : {}),
    }

    const members = await db.tenantUser.findMany({
      where,
      include: {
        user: {
          include: {
            staffProfile: true,
            guardianProfile: {
              include: {
                studentLinks: {
                  include: {
                    student: {
                      select: { firstName: true, lastName: true, admissionNo: true },
                    },
                  },
                },
              },
            },
            taughtClasses: {
              select: { name: true, code: true },
            },
          },
        },
        tenant: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    })

    const headers = [
      'User ID',
      'Full Name',
      'Email',
      'Phone',
      'Primary Role',
      'All Roles',
      'Status',
      'Branch ID',
      'Employee Code',
      'Designation',
      'Department',
      'Employment Type',
      'Assigned Classrooms',
      'Linked Students',
      'Created At',
      'Last Login',
    ]

    const rows = members.map((m) => {
      const assignedRoles = m.roles && m.roles.length > 0 ? m.roles : [m.role]
      const taughtClasses = m.user.taughtClasses?.map((c) => c.name).join('; ') || ''
      const linkedStudents =
        m.user.guardianProfile?.studentLinks
          ?.map((sl) => `${sl.student.firstName} ${sl.student.lastName || ''} (${sl.student.admissionNo})`)
          .join('; ') || ''

      return [
        sanitizeCsvCell(m.userId),
        sanitizeCsvCell(m.user.fullName),
        sanitizeCsvCell(m.user.email),
        sanitizeCsvCell(m.user.phone),
        sanitizeCsvCell(m.role),
        sanitizeCsvCell(assignedRoles.join(', ')),
        sanitizeCsvCell(m.status),
        sanitizeCsvCell(m.branchId),
        sanitizeCsvCell(m.user.staffProfile?.employeeCode),
        sanitizeCsvCell(m.user.staffProfile?.designation),
        sanitizeCsvCell(m.user.staffProfile?.department),
        sanitizeCsvCell(m.user.staffProfile?.employmentType),
        sanitizeCsvCell(taughtClasses),
        sanitizeCsvCell(linkedStudents),
        sanitizeCsvCell(m.createdAt.toISOString()),
        sanitizeCsvCell(m.user.lastLoginAt ? m.user.lastLoginAt.toISOString() : ''),
      ].join(',')
    })

    const csvContent = [headers.map((h) => `"${h}"`).join(','), ...rows].join('\r\n')

    const meta = getRequestMeta(req)
    await recordAudit({
      tenantId: session.tenantId,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
      action: 'EXPORT_USERS_CSV',
      entity: 'User',
      module: 'Users',
      severity: 'INFO',
      summary: `Exported ${members.length} user records to CSV`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      newValues: { count: members.length, userIdsFilterCount: userIds?.length || 0 },
    })

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="preone_users_export_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (err: any) {
    return serverError(err.message)
  }
}

export const POST = withApi(_POST)
