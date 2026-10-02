import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { StaffService } from '@/lib/hr/staff-service'

async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApi(req, 'hr:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const { id } = await params
    const profile = await StaffService.getStaff360(session.tenantId, id)
    if (!profile) return Errors.notFound('Staff profile')

    return ok(profile)
  } catch (e) {
    return Errors.system(e)
  }
}

async function _PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApi(req, 'hr:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const { id } = await params
    const body = await req.json()
    const { branchId, designation, department, ...rest } = body

    const actor = {
      id: session.uid,
      name: session.name,
      role: session.role,
    }

    let result
    // If only branchId was provided without any other fields, treat as direct branch transfer
    if (branchId && designation === undefined && department === undefined && Object.keys(rest).length === 0) {
      result = await StaffService.transferBranch(session.tenantId, id, branchId, actor)
    } else if (Object.keys(body).length > 0) {
      // Full or partial profile update
      result = await StaffService.updateStaffProfile(
        session.tenantId,
        id,
        { branchId, designation, department, ...rest },
        actor
      )
    } else {
      return Errors.validation('No valid update fields provided')
    }

    return ok(result)
  } catch (e: any) {
    return Errors.validation(e.message || 'Failed to update staff profile')
  }
}

export const GET = withApi(_GET)
export const PATCH = withApi(_PATCH)
