import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AuditService } from '@/lib/audit/audit-service'

/**
 * GET /api/v1/hr/compliance
 * Single-query aggregated compliance radar for all active staff
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'hr:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const sp = req.nextUrl.searchParams
    const branchId = sp.get('branchId') || undefined
    const statusFilter = sp.get('status') || undefined // ALL, EXPIRED, EXPIRING_SOON, COMPLIANT, NOT_CERTIFIED

    // Fetch active staff with their POSH trainings and documents in ONE optimized query
    const staffList = await db.staffProfile.findMany({
      where: {
        tenantId: session.tenantId,
        ...(branchId ? { branchId } : {}),
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        branch: { select: { id: true, name: true } },
        trainings: {
          orderBy: { completionDate: 'desc' },
        },
        documents: true,
      },
      orderBy: { employeeCode: 'asc' },
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const in30Days = new Date(today)
    in30Days.setDate(in30Days.getDate() + 30)

    const rows = staffList.map((s) => {
      // Find latest POSH training
      const posh = s.trainings.find(
        (t) => (t.trainingType || t.title || '').toUpperCase().includes('POSH')
      )

      let poshStatus = 'NOT_CERTIFIED'
      let poshExpiry: string | null = null
      let daysRemaining: number | null = null

      if (posh) {
        if (posh.expiryDate) {
          const exp = new Date(posh.expiryDate)
          poshExpiry = exp.toISOString().split('T')[0]
          daysRemaining = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

          if (daysRemaining < 0 || posh.status === 'EXPIRED') {
            poshStatus = 'EXPIRED'
          } else if (daysRemaining <= 30) {
            poshStatus = 'EXPIRING_SOON'
          } else {
            poshStatus = 'COMPLIANT'
          }
        } else if (posh.status === 'VALID') {
          poshStatus = 'COMPLIANT'
        }
      }

      // Check background verification and medical fitness documents
      const policeDoc = s.documents.find(
        (d) => d.documentType === 'POLICE_VERIFICATION' || d.title.toLowerCase().includes('police')
      )
      const medicalDoc = s.documents.find(
        (d) => d.documentType === 'MEDICAL_FITNESS' || d.title.toLowerCase().includes('medical')
      )

      return {
        id: s.id,
        staffProfileId: s.id,
        userId: s.userId,
        name: s.user.fullName,
        email: s.user.email,
        employeeCode: s.employeeCode,
        designation: s.designation,
        branchId: s.branchId,
        branchName: s.branch?.name || null,
        poshTrainingId: posh?.id || null,
        poshStatus,
        poshScore: posh?.score || null,
        poshCompletedAt: posh?.completionDate ? posh.completionDate.toISOString().split('T')[0] : null,
        poshExpiry,
        daysRemaining,
        policeVerificationStatus: policeDoc ? (policeDoc.verified ? 'VERIFIED' : 'PENDING') : 'MISSING',
        medicalFitnessStatus: medicalDoc ? (medicalDoc.verified ? 'VERIFIED' : 'PENDING') : 'MISSING',
      }
    })

    // Filter by status if provided
    let filtered = rows
    if (statusFilter && statusFilter !== 'ALL') {
      filtered = rows.filter((r) => r.poshStatus === statusFilter)
    }

    // Sort by urgency: EXPIRED (1) -> EXPIRING_SOON (2) -> NOT_CERTIFIED (3) -> COMPLIANT (4)
    const priorityMap: Record<string, number> = {
      EXPIRED: 1,
      EXPIRING_SOON: 2,
      NOT_CERTIFIED: 3,
      COMPLIANT: 4,
    }
    filtered.sort((a, b) => (priorityMap[a.poshStatus] || 5) - (priorityMap[b.poshStatus] || 5))

    const stats = {
      total: rows.length,
      compliant: rows.filter((r) => r.poshStatus === 'COMPLIANT').length,
      expiringSoon: rows.filter((r) => r.poshStatus === 'EXPIRING_SOON').length,
      expired: rows.filter((r) => r.poshStatus === 'EXPIRED').length,
      notCertified: rows.filter((r) => r.poshStatus === 'NOT_CERTIFIED').length,
    }

    return ok({ records: filtered, stats })
  } catch (e) {
    return Errors.system(e)
  }
}

/**
 * POST /api/v1/hr/compliance
 * Record new training or compliance certificate (e.g. POSH, Police Verification)
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'hr:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const {
      staffProfileId,
      trainingType = 'POSH',
      title,
      score,
      completionDate,
      expiryDate,
      certificateUrl,
      remarks,
    } = body

    if (!staffProfileId) {
      return Errors.validation('staffProfileId is required')
    }

    const staff = await db.staffProfile.findFirst({
      where: { id: staffProfileId, tenantId: session.tenantId, deletedAt: null },
      include: { user: true },
    })
    if (!staff) return Errors.notFound('Staff profile')

    const compDate = completionDate ? new Date(completionDate) : new Date()
    // Default 1-year validity for POSH if not specified
    const expDate = expiryDate
      ? new Date(expiryDate)
      : new Date(new Date(compDate).setFullYear(compDate.getFullYear() + 1))

    const training = await db.$transaction(async (tx) => {
      const record = await tx.staffTraining.create({
        data: {
          tenantId: session.tenantId!,
          staffProfileId,
          trainingType,
          title: title || `${trainingType} Certification`,
          completionDate: compDate,
          expiryDate: expDate,
          score: score ? parseFloat(String(score)) : 100,
          certificateUrl: certificateUrl || null,
          status: 'VALID',
          remarks: remarks || 'Recorded via Compliance Workspace',
        },
      })

      // If there are held payslips for this staff in any active cycle due to POSH, check and release hold!
      if (trainingType.toUpperCase().includes('POSH')) {
        const heldPayslips = await tx.payslip.findMany({
          where: {
            staffProfileId,
            isHeld: true,
            holdReason: { contains: 'POSH' },
          },
          include: { payrollCycle: true },
        })

        for (const p of heldPayslips) {
          // Only release if cycle is not already disbursed or locked
          if (p.payrollCycle.status !== 'DISBURSED') {
            await tx.payslip.update({
              where: { id: p.id },
              data: {
                isHeld: false,
                holdReason: null,
                poshCompliant: true,
              },
            })

            await AuditService.record({
              tenantId: session.tenantId!,
              actorId: session.uid,
              actorName: session.name,
              actorRole: session.role,
              action: 'PAYROLL_HOLD_RELEASED',
              entity: 'Payslip',
              entityId: p.id,
              module: 'HR',
              summary: `Released POSH salary hold for ${staff.user.fullName} following valid certification`,
              severity: 'INFO',
            }, tx)
          }
        }
      }

      await AuditService.record({
        tenantId: session.tenantId!,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
        action: 'COMPLIANCE_CERTIFICATE_RECORDED',
        entity: 'StaffTraining',
        entityId: record.id,
        module: 'HR',
        summary: `Recorded ${trainingType} certification for ${staff.user.fullName} (${staff.employeeCode})`,
        severity: 'INFO',
        newValues: {
          trainingType,
          completionDate: compDate.toISOString().split('T')[0],
          expiryDate: expDate.toISOString().split('T')[0],
          score,
        },
      }, tx)

      return record
    })

    return ok(training)
  } catch (e: any) {
    return Errors.validation(e.message || 'Failed to record compliance certification')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
