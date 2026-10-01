import { withApi } from '@/lib/with-api'
import { NextRequest, NextResponse } from 'next/server'
import { ok, bad, serverError } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { UserCsvEngine, CsvPreviewRow } from '@/lib/users/csv-engine'

/**
 * GET /api/v1/users/csv — Download template
 * Query params: ?type=staff | family
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'users:read')
  if (isResponse(session)) return session

  const url = new URL(req.url)
  const type = (url.searchParams.get('template') || url.searchParams.get('type') || 'staff').toLowerCase()

  if (type === 'parent') {
    const content = UserCsvEngine.getParentTemplate()
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="preone_parent_template.csv"',
      },
    })
  }

  if (type === 'guardian') {
    const content = UserCsvEngine.getGuardianTemplate()
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="preone_guardian_template.csv"',
      },
    })
  }

  if (type === 'family') {
    const content = UserCsvEngine.getFamilyTemplate()
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="preone_family_template.csv"',
      },
    })
  }

  const content = UserCsvEngine.getStaffTemplate()
  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="preone_staff_template.csv"',
    },
  })
}

/**
 * POST /api/v1/users/csv — Two-stage CSV preview and execution for Staff and Family
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'users:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return bad('Tenant required', 'TENANT_REQUIRED')

  try {
    const body = await req.json()
    const { action = 'preview', type: inputType, csv, previewRows } = body

    // Auto-detect template type if not explicitly set
    let templateType: 'STAFF' | 'FAMILY' =
      inputType?.toUpperCase() === 'FAMILY' || inputType?.toUpperCase() === 'PARENT' ? 'FAMILY' : 'STAFF'

    if (!inputType && typeof csv === 'string') {
      if (
        csv.includes('studentAdmissionNo') ||
        csv.includes('childFirstName') ||
        csv.includes('childDOB') ||
        csv.includes('relationship')
      ) {
        templateType = 'FAMILY'
      }
    }

    if (action === 'preview' || action === 'validate') {
      if (!csv || typeof csv !== 'string') {
        return bad('Raw CSV content string is required for preview', 'MISSING_CSV')
      }

      if (templateType === 'FAMILY') {
        const preview = await UserCsvEngine.previewFamilyCsv(session.tenantId, csv)
        return ok(preview)
      } else {
        const preview = await UserCsvEngine.previewStaffCsv(session.tenantId, csv)
        return ok(preview)
      }
    }

    if (action === 'execute') {
      let rowsToExecute: CsvPreviewRow[] = previewRows

      if (!rowsToExecute && typeof csv === 'string') {
        const preview =
          templateType === 'FAMILY'
            ? await UserCsvEngine.previewFamilyCsv(session.tenantId, csv)
            : await UserCsvEngine.previewStaffCsv(session.tenantId, csv)
        rowsToExecute = preview.rows
      }

      if (!rowsToExecute || !Array.isArray(rowsToExecute) || rowsToExecute.length === 0) {
        return bad('No validated rows provided for execution', 'EMPTY_ROWS')
      }

      if (templateType === 'FAMILY') {
        const result = await UserCsvEngine.executeFamilyImport(
          {
            tenantId: session.tenantId,
            actorId: session.uid,
            actorName: session.name,
            actorRole: session.role,
          },
          rowsToExecute
        )
        return ok(result)
      } else {
        const result = await UserCsvEngine.executeStaffImport(
          {
            tenantId: session.tenantId,
            actorId: session.uid,
            actorName: session.name,
            actorRole: session.role,
          },
          rowsToExecute
        )
        return ok(result)
      }
    }

    return bad('Action must be "preview" or "execute"', 'INVALID_ACTION')
  } catch (err: any) {
    return serverError(err.message)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
