import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { AuditService } from '@/lib/audit/audit-service'

async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'hr:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const sp = req.nextUrl.searchParams
    const dateStr = sp.get('date') || new Date().toISOString().split('T')[0]
    const branchId = sp.get('branchId') || undefined

    const date = new Date(dateStr)

    // Fetch active staff
    const staffList = await db.staffProfile.findMany({
      where: {
        tenantId: session.tenantId,
        ...(branchId ? { branchId } : {}),
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { employeeCode: 'asc' },
    })

    // Fetch punches for this day
    const punches = await db.attendanceStaff.findMany({
      where: {
        tenantId: session.tenantId,
        date,
      },
    })
    const punchMap = new Map(punches.map((p) => [p.staffProfileId, p]))

    const records = staffList.map((s) => {
      const p = punchMap.get(s.id)
      return {
        staffProfileId: s.id,
        employeeCode: s.employeeCode,
        name: s.user.fullName,
        designation: s.designation,
        branchName: s.branch?.name || null,
        status: p?.status || 'UNMARKED',
        checkIn: p?.checkIn || null,
        checkOut: p?.checkOut || null,
        workedHours: p?.workedHours ?? 0,
        lateMinutes: p?.lateMinutes ?? 0,
        source: p?.source || 'MANUAL',
        notes: p?.notes || null,
      }
    })

    return ok({ date: dateStr, records })
  } catch (e) {
    return Errors.system(e)
  }
}

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'hr:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { date, entries } = body as {
      date: string
      entries: Array<{
        staffProfileId: string
        status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LATE' | 'ON_LEAVE' | 'HOLIDAY' | 'WEEKLY_OFF'
        checkIn?: string
        checkOut?: string
        notes?: string
      }>
    }

    if (!date || !Array.isArray(entries)) {
      return Errors.validation('date and entries[] are required')
    }

    const punchDate = new Date(date)

    await db.$transaction(async (tx) => {
      for (const e of entries) {
        const staff = await tx.staffProfile.findFirst({
          where: { id: e.staffProfileId, tenantId: session.tenantId! },
        })
        if (!staff) continue

        let workedHours = 0
        let lateMinutes = 0
        if (e.checkIn && e.checkOut) {
          const inT = new Date(e.checkIn).getTime()
          const outT = new Date(e.checkOut).getTime()
          if (outT > inT) workedHours = parseFloat(((outT - inT) / (1000 * 60 * 60)).toFixed(2))
        }

        if (e.status === 'LATE') lateMinutes = 30

        await tx.attendanceStaff.upsert({
          where: {
            staffProfileId_date: {
              staffProfileId: e.staffProfileId,
              date: punchDate,
            },
          },
          create: {
            tenantId: session.tenantId!,
            branchId: staff.branchId || '',
            staffProfileId: e.staffProfileId,
            date: punchDate,
            status: e.status,
            checkIn: e.checkIn ? new Date(e.checkIn) : null,
            checkOut: e.checkOut ? new Date(e.checkOut) : null,
            shiftHours: 8,
            workedHours,
            lateMinutes,
            source: 'MANUAL',
            notes: e.notes || null,
            markedById: session.uid,
            markedByName: session.name,
          },
          update: {
            status: e.status,
            checkIn: e.checkIn ? new Date(e.checkIn) : null,
            checkOut: e.checkOut ? new Date(e.checkOut) : null,
            workedHours,
            lateMinutes,
            notes: e.notes || null,
            markedById: session.uid,
            markedByName: session.name,
          },
        })
      }

      await AuditService.record({
        tenantId: session.tenantId!,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
        action: 'STAFF_ATTENDANCE_MARKED',
        entity: 'AttendanceStaff',
        module: 'HR',
        summary: `Marked staff attendance for ${entries.length} members on ${date}`,
        severity: 'INFO',
      }, tx)
    })

    return ok({ success: true, count: entries.length })
  } catch (e: any) {
    return Errors.validation(e.message || 'Failed to record staff attendance')
  }
}

/**
 * PATCH /api/v1/hr/attendance — Attendance Correction Workflow
 * Allows adjusting historical punch-in/out times or status with mandatory reason & audit
 */
async function _PATCH(req: NextRequest) {
  const session = await requireApi(req, 'hr:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { staffProfileId, date, status, checkIn, checkOut, reason } = body

    if (!staffProfileId || !date || !status) {
      return Errors.validation('staffProfileId, date, and status are required')
    }
    if (!reason || !reason.trim()) {
      return Errors.validation('Mandatory correction reason required for audit trail')
    }

    const punchDate = new Date(date)
    punchDate.setHours(0, 0, 0, 0)

    const staff = await db.staffProfile.findFirst({
      where: { id: staffProfileId, tenantId: session.tenantId, deletedAt: null },
      include: { user: true },
    })
    if (!staff) return Errors.notFound('Staff profile')

    const existingPunch = await db.attendanceStaff.findUnique({
      where: {
        staffProfileId_date: {
          staffProfileId,
          date: punchDate,
        },
      },
    })

    let workedHours = 0
    let lateMinutes = 0
    if (checkIn && checkOut) {
      const inT = new Date(checkIn).getTime()
      const outT = new Date(checkOut).getTime()
      if (outT > inT) workedHours = parseFloat(((outT - inT) / (1000 * 60 * 60)).toFixed(2))
    }
    if (status === 'LATE') lateMinutes = 30

    const updatedPunch = await db.$transaction(async (tx) => {
      const record = await tx.attendanceStaff.upsert({
        where: {
          staffProfileId_date: {
            staffProfileId,
            date: punchDate,
          },
        },
        create: {
          tenantId: session.tenantId!,
          branchId: staff.branchId || '',
          staffProfileId,
          date: punchDate,
          status,
          checkIn: checkIn ? new Date(checkIn) : null,
          checkOut: checkOut ? new Date(checkOut) : null,
          shiftHours: 8,
          workedHours,
          lateMinutes,
          source: 'CORRECTION',
          notes: reason,
          markedById: session.uid,
          markedByName: session.name,
        },
        update: {
          status,
          checkIn: checkIn ? new Date(checkIn) : null,
          checkOut: checkOut ? new Date(checkOut) : null,
          workedHours,
          lateMinutes,
          source: 'CORRECTION',
          notes: reason,
          markedById: session.uid,
          markedByName: session.name,
        },
      })

      await AuditService.record({
        tenantId: session.tenantId!,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
        action: 'STAFF_ATTENDANCE_CORRECTED',
        entity: 'AttendanceStaff',
        entityId: record.id,
        module: 'HR',
        summary: `Corrected attendance for ${staff.user.fullName} on ${date}: ${status} (${reason})`,
        severity: 'INFO',
        oldValues: existingPunch
          ? {
              status: existingPunch.status,
              checkIn: existingPunch.checkIn,
              checkOut: existingPunch.checkOut,
              workedHours: existingPunch.workedHours,
            }
          : null,
        newValues: {
          status,
          checkIn,
          checkOut,
          workedHours,
          reason,
        },
      }, tx)

      return record
    })

    return ok(updatedPunch)
  } catch (e: any) {
    return Errors.validation(e.message || 'Failed to correct staff attendance')
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
export const PATCH = withApi(_PATCH)
