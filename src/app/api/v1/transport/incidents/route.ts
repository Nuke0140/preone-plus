import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors, bad } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { TransportService } from '@/lib/transport/transport-service'
import { db } from '@/lib/db'
import { TransportIncidentSeverity, TransportIncidentCategory } from '@prisma/client'

/**
 * GET /api/v1/transport/incidents â€” List safety / operational incidents
 * POST /api/v1/transport/incidents â€” Report safety / operational incident
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'transport:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('Tenant context required')

  try {
    const sp = req.nextUrl.searchParams
    const severity = (sp.get('severity') as TransportIncidentSeverity) || undefined
    const category = (sp.get('category') as TransportIncidentCategory) || undefined

    const incidents = await db.transportIncident.findMany({
      where: {
        tenantId: session.tenantId,
        ...(session.branchId ? { branchId: session.branchId } : {}),
        ...(severity ? { severity } : {}),
        ...(category ? { category } : {}),
      },
      include: {
        vehicle: true,
        trip: { include: { route: true } },
        student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return ok(incidents)
  } catch (e: any) {
    return Errors.system(e)
  }
}

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'transport:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('Tenant context required')

  try {
    const body = await req.json()
    const { tripId, vehicleId, studentId, severity, category, title, description, actionTaken } = body

    if (!severity || !category || !title || !description) {
      return bad('severity, category, title, and description are required')
    }

    const incident = await TransportService.reportIncident(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      {
        tripId,
        vehicleId,
        studentId,
        severity,
        category,
        title,
        description,
        actionTaken,
      }
    )

    return ok(incident, undefined, 201)
  } catch (e: any) {
    return bad(e.message)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
