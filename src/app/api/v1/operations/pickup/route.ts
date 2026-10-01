import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import type { TimelineEntry } from '@prisma/client'
import { ok, bad, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { db } from '@/lib/db'
import { OperationsService } from '@/lib/operations/operations-service'
import { getRequestMeta } from '@/lib/audit'

/**
 * GET /api/v1/operations/pickup/queue?classroomId=&branchId=&date=
 * Real-time pickup release queue
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'attendance:mark')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const sp = req.nextUrl.searchParams
    const classroomId = sp.get('classroomId')
    const branchId = sp.get('branchId') || session.branchId || undefined
    const dateStr = sp.get('date') || new Date().toISOString().split('T')[0]
    const todayDate = new Date(dateStr)

    // Load active students for the branch/classroom
    const students = await db.student.findMany({
      where: {
        tenantId: session.tenantId,
        status: 'ACTIVE',
        deletedAt: null,
        ...(classroomId ? { currentClassroomId: classroomId } : {}),
        ...(branchId ? { branchId } : {}),
      },
      include: {
        currentClassroom: true,
        guardians: {
          include: { guardian: true },
        },
      },
      orderBy: { firstName: 'asc' },
    })

    const studentIds = students.map((s) => s.id)

    const [attendances, pickupEvents] = await Promise.all([
      db.attendance.findMany({
        where: {
          tenantId: session.tenantId,
          date: todayDate,
          studentId: { in: studentIds },
        },
      }),
      db.timelineEntry.findMany({
        where: {
          tenantId: session.tenantId,
          studentId: { in: studentIds },
          type: 'PICKUP',
          createdAt: {
            gte: new Date(`${dateStr}T00:00:00.000Z`),
            lte: new Date(`${dateStr}T23:59:59.999Z`),
          },
        },
      }),
    ])

    const attMap = new Map<string, string>(attendances.map((a) => [a.studentId, a.status] as [string, string]))
    const pickupMap = new Map<string, TimelineEntry>(pickupEvents.map((p) => [p.studentId, p] as [string, TimelineEntry]))

    const queue = students.map((s) => {
      const att = attMap.get(s.id) || 'UNMARKED'
      const pickup = pickupMap.get(s.id)
      const isPresent = ['PRESENT', 'LATE', 'HALF_DAY'].includes(att)

      return {
        id: s.id,
        name: `${s.firstName} ${s.lastName || ''}`.trim(),
        admissionNo: s.admissionNo,
        photoUrl: s.photoUrl,
        classroom: s.currentClassroom?.name || 'Unassigned',
        classroomId: s.currentClassroomId,
        attendance: att,
        isPresent,
        isPickedUp: Boolean(pickup),
        pickedUpAt: pickup?.createdAt || null,
        status: pickup ? 'RELEASED' : isPresent ? 'WAITING_PICKUP' : 'NOT_PRESENT',
        guardians: s.guardians.map((g) => ({
          id: g.guardian.id,
          name: g.guardian.fullName,
          relationship: g.guardian.relationship,
          phone: g.guardian.phone,
          canPickup: g.canPickup,
          hasPin: Boolean(g.guardian.pickupPin),
        })),
      }
    })

    return ok({
      date: dateStr,
      total: queue.length,
      waiting: queue.filter((q) => q.status === 'WAITING_PICKUP').length,
      released: queue.filter((q) => q.status === 'RELEASED').length,
      notPresent: queue.filter((q) => q.status === 'NOT_PRESENT').length,
      items: queue,
    })
  } catch (err: any) {
    return Errors.system(err)
  }
}

/**
 * POST /api/v1/operations/pickup — verify and release child to authorized guardian
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'attendance:mark')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { studentId, guardianId, phone, pin, notes } = body
    const meta = getRequestMeta(req)

    const ctx = {
      tenantId: session.tenantId,
      branchId: session.branchId,
      actorId: session.uid,
      actorName: session.name,
      actorRole: session.role,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    }

    const res = await OperationsService.recordPickup(ctx, {
      studentId,
      guardianId,
      phone,
      pin,
      notes,
    })

    return ok(res)
  } catch (err: any) {
    return bad(err.message, 'PICKUP_RELEASE_FAILED')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
