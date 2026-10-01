import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AdmissionService } from '@/lib/admissions/admission-service'

/**
 * POST /api/v1/applications/{id}/verify — Document Verification & Correction
 * Body: { documentId?: string, action?: 'VERIFY' | 'NEEDS_CORRECTION', remarks?: string }
 * If documentId is omitted, verifies all pending documents for the application.
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
    const body = await req.json().catch(() => ({}))
    const { documentId, action, remarks } = body

    if (documentId) {
      const res = await AdmissionService.updateDocumentStatus(
        {
          tenantId: session.tenantId,
          branchId: session.branchId || '',
          academicYearId: '',
          actorId: session.uid,
          actorName: session.name,
          actorRole: session.role,
        },
        documentId,
        action || 'VERIFY',
        remarks
      )
      return ok(res)
    }

    // Verify all docs for this application
    const { db } = await import('@/lib/db')
    const { audit } = await import('@/lib/sequence')

    const app = await db.admissionApplication.findFirst({
      where: { id, tenantId: session.tenantId, deletedAt: null },
      include: { documents: true },
    })
    if (!app) return Errors.notFound('Application')

    await db.$transaction([
      db.applicationDocument.updateMany({
        where: { applicationId: id },
        data: { verified: true, verifiedAt: new Date() },
      }),
      db.admissionApplication.update({
        where: { id },
        data: { status: 'VERIFIED', verifiedAt: new Date() },
      }),
    ])

    await audit({
      tenantId: session.tenantId,
      branchId: app.branchId,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
      action: 'DOC_VERIFY_ALL',
      entity: 'AdmissionApplication',
      entityId: id,
      summary: `All documents verified for application ${app.applicationNumber}`,
    })

    return ok({ status: 'VERIFIED', allVerified: true })
  } catch (e: any) {
    return Errors.business('VERIFICATION_FAILED', e.message || 'Failed to verify documents', 422)
  }
}

export const POST = withApi(_POST)
