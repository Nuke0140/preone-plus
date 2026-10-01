import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { PayrollService } from '@/lib/hr/payroll-service'

async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'payroll:process')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const sp = req.nextUrl.searchParams
    const exportParam = sp.get('export')
    const cycleId = sp.get('cycleId')

    if (exportParam === 'true' && cycleId) {
      const csv = await PayrollService.generateBankPayoutFile(session.tenantId, cycleId)
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="bank-neft-payout-${cycleId}.csv"`,
        },
      })
    }

    const cycles = await db.payrollCycle.findMany({
      where: { tenantId: session.tenantId },
      include: {
        branch: { select: { id: true, name: true } },
        payslips: {
          include: {
            staffProfile: {
              include: { user: { select: { id: true, fullName: true, email: true } } },
            },
          },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })

    return ok(cycles)
  } catch (e) {
    return Errors.system(e)
  }
}

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'payroll:process')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { action = 'CALCULATE', month, year, branchId, cycleId, paymentReference } = body

    if (action === 'EXPORT_BANK_FILE') {
      if (!cycleId) return Errors.validation('cycleId is required for bank export')
      const csv = await PayrollService.generateBankPayoutFile(session.tenantId, cycleId)
      return ok({
        fileContent: csv,
        fileName: `neft-payout-${cycleId}.csv`,
      })
    }

    if (action === 'DISBURSE') {
      if (!cycleId) return Errors.validation('cycleId is required for disbursement')
      const cycle = await PayrollService.disbursePayroll(
        session.tenantId,
        cycleId,
        paymentReference || `NEFT-${Date.now()}`,
        {
          id: session.uid,
          name: session.name,
          role: session.role,
        }
      )
      return ok(cycle)
    }

    if (!month || !year) return Errors.validation('month and year are required')

    const cycle = await PayrollService.processPayroll(
      session.tenantId,
      Number(month),
      Number(year),
      branchId || null,
      {
        id: session.uid,
        name: session.name,
        role: session.role,
      }
    )

    return ok(cycle)
  } catch (e: any) {
    return Errors.validation(e.message || 'Failed to process payroll')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
