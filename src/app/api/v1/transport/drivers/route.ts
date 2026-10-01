import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { db } from '@/lib/db'

/**
 * GET /api/v1/transport/drivers — List staff profiles eligible as drivers/attendants
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'transport:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const staff = await db.staffProfile.findMany({
      where: {
        tenantId: session.tenantId,
        deletedAt: null,
        designation: {
          in: ['DRIVER', 'TRANSPORT_DRIVER', 'ATTENDANT', 'HELPER', 'STAFF', 'BUS_DRIVER'],
          mode: 'insensitive',
        },
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, status: true },
        },
      },
      orderBy: { employeeCode: 'asc' },
    })

    return ok(staff)
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
