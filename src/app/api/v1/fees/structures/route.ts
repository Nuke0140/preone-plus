import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { FeeService } from '@/lib/fees/fee-service'
import type { ProgramType } from '@prisma/client'

async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'finance:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const sp = req.nextUrl.searchParams
    const programType = (sp.get('programType') as ProgramType) || undefined

    const plans = await FeeService.getFeePlans(session.tenantId, programType)
    return ok(plans)
  } catch (e: any) {
    return Errors.system(e)
  }
}

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'finance:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { name, programType, installmentCount, items, branchId } = body
    if (!name || !programType || !items || !Array.isArray(items)) {
      return Errors.validation('name, programType, and items are required')
    }

    const plan = await FeeService.createFeePlan(
      {
        tenantId: session.tenantId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      {
        name,
        programType,
        branchId,
        installmentCount,
        items,
      }
    )

    return ok(plan, undefined, 201)
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
