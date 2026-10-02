import { NextRequest } from 'next/server'
import { ok, withApi, errPermission, errValidation } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { FeeService } from '@/lib/fees/fee-service'

export const POST = withApi(async (req: NextRequest) => {
  const session = await requireApi(req, 'finance:read')
  if (isResponse(session)) return session
  if (!session.tenantId) {
    throw errPermission('No tenant context found in active session')
  }

  const body = await req.json()
  const { studentId } = body
  if (!studentId) {
    throw errValidation('studentId is required', 'studentId')
  }

  const siblingResult = await FeeService.calculateSiblingDiscount(session.tenantId, studentId)
  return ok(siblingResult)
}, { module: 'fees' })
