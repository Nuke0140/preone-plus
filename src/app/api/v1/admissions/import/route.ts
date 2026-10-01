import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AdmissionService } from '@/lib/admissions/admission-service'

/**
 * POST /api/v1/admissions/import
 * Unified CSV bulk import preview and execution endpoint for Leads and Applications
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'admissions:create')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { action, type = 'leads', rows = [], mapping = {}, branchId, academicYearId, duplicateAction = 'SKIP' } = body

    const ctx = {
      tenantId: session.tenantId,
      branchId: branchId || session.branchId || '',
      academicYearId: academicYearId || '',
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
    }

    if (action === 'preview') {
      const preview = await AdmissionService.validateCsvImportRows(ctx, type, rows, mapping)
      return ok(preview)
    }

    if (action === 'execute') {
      const result = await AdmissionService.executeCsvImportBatch(ctx, type, rows, duplicateAction)
      return ok(result)
    }

    return Errors.badRequest('Invalid action. Use "preview" or "execute".')
  } catch (err: any) {
    return Errors.business('CSV_IMPORT_FAILED', err.message || 'CSV Import failed', 422)
  }
}

export const POST = withApi(_POST)
