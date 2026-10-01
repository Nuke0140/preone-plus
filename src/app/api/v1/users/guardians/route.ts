import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, withApi, errPermission } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'

/** GET /api/v1/users/guardians — fetch guardians available for account linking */
export const GET = withApi(async (req: NextRequest) => {
  const session = await requireApi(req, 'users:read')
  if (isResponse(session)) return session
  if (!session.tenantId) {
    throw errPermission('Tenant context required')
  }

  const guardians = await db.guardian.findMany({
    where: {
      tenantId: session.tenantId,
      deletedAt: null,
    },
    include: {
      user: { select: { id: true, email: true, status: true } },
      studentLinks: {
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, admissionNo: true },
          },
        },
      },
    },
    orderBy: { fullName: 'asc' },
    take: 200,
  })

  return ok(
    guardians.map((g) => ({
      id: g.id,
      fullName: g.fullName,
      relationship: g.relationship,
      phone: g.phone,
      email: g.email,
      hasAccount: !!g.userId,
      linkedUser: g.user ? { id: g.user.id, email: g.user.email, status: g.user.status } : null,
      children: g.studentLinks.map((sl) => ({
        id: sl.student.id,
        name: `${sl.student.firstName} ${sl.student.lastName || ''}`.trim(),
        admissionNo: sl.student.admissionNo,
        canPickup: sl.canPickup,
      })),
    }))
  )
}, { module: 'users' })
