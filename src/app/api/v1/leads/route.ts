import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AdmissionService } from '@/lib/admissions/admission-service'

/**
 * GET /api/v1/leads — Enquiries list
 * Required Scopes: tenantId (from session), branchId, academicYearId
 * Filters: status, interestedProgram, source, search
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'admissions:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const sp = req.nextUrl.searchParams
    const branchId = sp.get('branchId') || session.branchId
    const academicYearId = sp.get('academicYearId') || sp.get('academicSessionId')
    const status = sp.get('status')
    const program = sp.get('program') || sp.get('interestedProgram')
    const source = sp.get('source')
    const search = sp.get('q')?.trim()

    const scope = await AdmissionService.verifyScope(session.tenantId, branchId, academicYearId)

    const where: any = {
      tenantId: scope.tenantId,
      deletedAt: null,
      branchId: scope.branchId,
      ...(status ? { status } : {}),
      ...(program ? { interestedProgram: program } : {}),
      ...(source ? { source } : {}),
    }

    if (search) {
      where.OR = [
        { leadNumber: { contains: search, mode: 'insensitive' } },
        { childName: { contains: search, mode: 'insensitive' } },
        { parentName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ]
    }

    const leads = await db.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return ok(leads, {
      total: leads.length,
      scope: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        academicYearId: scope.academicYearId,
      },
    })
  } catch (e) {
    return Errors.system(e)
  }
}

/**
 * POST /api/v1/leads — Capture a new Enquiry with duplicate detection
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'admissions:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const {
      parentName,
      phone,
      source,
      childName,
      childDob,
      interestedProgram,
      notes,
      email,
      branchId,
      academicYearId,
      assignedToId,
      childGender,
      previousSchool,
      relationship,
      parentPhotoUrl,
      enquiryDate,
      overrideDuplicate,
    } = body

    const result = await AdmissionService.createEnquiry(
      {
        tenantId: session.tenantId,
        branchId: branchId || session.branchId,
        academicYearId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      {
        parentName,
        phone,
        email,
        childName,
        childDob,
        interestedProgram,
        source,
        notes,
        assignedToId,
        childGender,
        previousSchool,
        relationship,
        parentPhotoUrl,
        enquiryDate,
        overrideDuplicate,
      }
    )

    if (result.isDuplicate) {
      return ok(result.enquiry, { warning: result.message, isDuplicate: true }, 200)
    }

    return ok(result.enquiry, undefined, 201)
  } catch (e: any) {
    return Errors.business('ENQUIRY_CREATE_FAILED', e.message || 'Failed to capture enquiry', 422)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
