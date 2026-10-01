import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { syncSetup } from '@/lib/setup/engine'
import { SETUP_STEPS, PHASES } from '@/lib/setup/steps'

/**
 * GET /api/v1/setup/dependencies — explicit dependency graph + "why blocked"
 * resolution + the Setup Summary (brief §26/§32)
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'settings:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const payload = await syncSetup(session.tenantId, { id: session.uid, name: session.name })
    if (!payload) return Errors.notFound('Tenant')
    const stepByKey = Object.fromEntries(payload.steps.map((s) => [s.key, s]))

    const graph = SETUP_STEPS.map((d) => {
      const s = stepByKey[d.key]
      return {
        key: d.key,
        label: d.label,
        applicability: d.applicability,
        deps: d.deps.map((dep) => ({
          key: dep,
          label: stepByKey[dep]?.label ?? dep,
          status: stepByKey[dep]?.status ?? 'PENDING',
        })),
        blockedBy: s?.missingDeps ?? [],
        status: s?.status ?? 'PENDING',
        detail: s?.detail ?? '',
      }
    })

    // Setup Summary — counts of configured master data (read-only snapshot)
    const { db } = await import('@/lib/db')
    const tenantId = session.tenantId
    const [branches, programs, sessions, classrooms, staff, events, feePlans, subjects, students] = await Promise.all([
      db.branch.count({ where: { tenantId, deletedAt: null } }),
      db.program.count({ where: { tenantId, deletedAt: null } }),
      db.academicSession.count({ where: { tenantId } }),
      db.classroom.count({ where: { tenantId, isActive: true } }),
      db.staffProfile.count({ where: { tenantId, deletedAt: null } }),
      db.calendarEvent.count({ where: { tenantId } }),
      db.feePlan.count({ where: { tenantId, isActive: true } }),
      db.subject.count({ where: { tenantId, deletedAt: null } }),
      db.student.count({ where: { tenantId, deletedAt: null } }),
    ])

    return ok({
      graph,
      phases: PHASES,
      summary: {
        school: { name: (await db.tenant.findUnique({ where: { id: tenantId }, select: { name: true, code: true, city: true } })) },
        branches, programs, academicYears: sessions, classes: classrooms,
        staff, calendarEvents: events, feePlans, subjects, students,
      },
      status: payload.status,
      progress: payload.progress,
    })
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
