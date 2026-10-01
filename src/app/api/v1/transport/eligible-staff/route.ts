import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { db } from '@/lib/db'

/**
 * GET /api/v1/transport/eligible-staff â€” Fetches active StaffProfile records eligible as Driver or Attendant
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'transport:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('Tenant context required')

  try {
    const staff = await db.staffProfile.findMany({
      where: {
        tenantId: session.tenantId,
        status: 'ACTIVE',
        deletedAt: null,
        user: { status: 'ACTIVE' },
      },
      include: {
        user: { select: { id: true, fullName: true, phone: true, email: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return ok(
      staff.map((s) => ({
        id: s.id,
        userId: s.userId,
        employeeCode: s.employeeCode,
        fullName: s.user.fullName,
        email: s.user.email,
        phone: s.user.phone,
        designation: s.designation || 'Staff',
        branchId: s.branchId,
        branchName: s.branch?.name || null,
      }))
    )
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
