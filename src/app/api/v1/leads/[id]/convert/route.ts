import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { db } from '@/lib/db'
import { AdmissionService } from '@/lib/admissions/admission-service'

/**
 * POST /api/v1/leads/{id}/convert — Start Admission Form from Enquiry
 */
async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApi(req, 'admissions:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  const { id } = await params

  try {
    const lead = await db.lead.findFirst({
      where: { id, tenantId: session.tenantId, deletedAt: null },
    })
    if (!lead) return Errors.notFound('Enquiry')
    if (lead.status === 'CONVERTED') {
      return Errors.conflict('Enquiry is already converted')
    }

    const app = await AdmissionService.submitApplication(
      {
        tenantId: session.tenantId,
        branchId: lead.branchId || session.branchId || '',
        academicYearId: '',
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      {
        leadId: lead.id,
        programType: lead.interestedProgram || 'NURSERY',
        childFirstName: lead.childName || lead.parentName.split(' ')[0] || 'Child',
        childDob: lead.childDob || new Date(new Date().getFullYear() - 3, 0, 1),
        parentName: lead.parentName,
        parentPhone: lead.phone,
        parentEmail: lead.email,
        notes: `Converted from Enquiry ${lead.leadNumber}`,
      }
    )

    return ok({ applicationId: app.id, applicationNumber: app.applicationNumber }, undefined, 201)
  } catch (e: any) {
    return Errors.business('CONVERT_FAILED', e.message || 'Failed to convert enquiry to application', 422)
  }
}

export const POST = withApi(_POST)
