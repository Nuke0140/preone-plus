import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { FeeService } from '@/lib/fees/fee-service'
import { db } from '@/lib/db'

async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'finance:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')
  const { id } = await params

  try {
    if (session.role === 'PARENT') {
      const isLinked = await db.studentGuardian.findFirst({
        where: {
          studentId: id,
          guardian: { userId: session.uid },
        },
      })
      if (!isLinked) return Errors.forbidden('Not authorized to view this student financial records')
    }

    const summary = await FeeService.getStudentFinancialSummary(session.tenantId, id)
    if (!summary) return Errors.notFound('Student')

    return ok(summary)
  } catch (e: any) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
