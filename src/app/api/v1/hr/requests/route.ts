import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'

/**
 * GET /api/v1/hr/requests — Centralized Staff Requests Inbox
 * Aggregates Leave Applications, Attendance Corrections, and Exit Requests.
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'hr:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const tenantId = session.tenantId
    const sp = req.nextUrl.searchParams
    const typeFilter = sp.get('type') || 'ALL' // ALL, LEAVE, ATTENDANCE, RESIGNATION
    const statusFilter = sp.get('status') || 'ALL' // ALL, PENDING, APPROVED, REJECTED

    // 1. Leave Requests
    const leaveRequests = await db.leaveRequest.findMany({
      where: {
        tenantId,
        ...(statusFilter !== 'ALL' ? { status: statusFilter as any } : {}),
      },
      include: {
        staffProfile: {
          include: {
            user: { select: { fullName: true, email: true } },
            branch: { select: { name: true } },
          },
        },
        leaveType: { select: { name: true, code: true } },
      },
      orderBy: { appliedAt: 'desc' },
      take: 100,
    })

    // 2. Attendance Corrections (attendance_staff entries created with source = 'CORRECTION')
    const corrections = await db.attendanceStaff.findMany({
      where: {
        tenantId,
        source: 'CORRECTION',
      },
      include: {
        staffProfile: {
          include: {
            user: { select: { fullName: true, email: true } },
            branch: { select: { name: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    })

    // 3. Resignation / Exit Requests
    const resignations = await db.resignationRequest.findMany({
      where: { tenantId },
      include: {
        staffProfile: {
          include: {
            user: { select: { fullName: true, email: true } },
            branch: { select: { name: true } },
          },
        },
      },
      orderBy: { resignationDate: 'desc' },
      take: 50,
    })

    // Transform into unified request items
    const unified: any[] = []

    for (const l of leaveRequests) {
      unified.push({
        id: l.id,
        rawId: l.id,
        type: 'LEAVE',
        typeLabel: `Leave: ${l.leaveType.name} (${l.totalDays}d)`,
        staffProfileId: l.staffProfileId,
        employeeName: l.staffProfile.user.fullName,
        employeeEmail: l.staffProfile.user.email,
        employeeCode: l.staffProfile.employeeCode,
        branchName: l.staffProfile.branch?.name || 'Main Campus',
        submittedAt: l.appliedAt,
        period: `${new Date(l.startDate).toLocaleDateString('en-IN')} – ${new Date(l.endDate).toLocaleDateString('en-IN')}`,
        reason: l.reason,
        status: l.status,
        actionedByName: l.actionedByName,
        actionedAt: l.actionedAt,
        rejectionReason: l.rejectionReason,
      })
    }

    for (const c of corrections) {
      unified.push({
        id: `att-${c.id}`,
        rawId: c.id,
        type: 'ATTENDANCE',
        typeLabel: `Attendance Correction (${c.status})`,
        staffProfileId: c.staffProfileId,
        employeeName: c.staffProfile.user.fullName,
        employeeEmail: c.staffProfile.user.email,
        employeeCode: c.staffProfile.employeeCode,
        branchName: c.staffProfile.branch?.name || 'Main Campus',
        submittedAt: c.updatedAt,
        period: new Date(c.date).toLocaleDateString('en-IN'),
        reason: c.notes || 'Attendance punch correction',
        status: 'APPROVED', // Marked directly by HR write
        actionedByName: c.markedByName,
        actionedAt: c.updatedAt,
      })
    }

    for (const r of resignations) {
      unified.push({
        id: `res-${r.id}`,
        rawId: r.id,
        type: 'RESIGNATION',
        typeLabel: 'Exit / Resignation',
        staffProfileId: r.staffProfileId,
        employeeName: r.staffProfile.user.fullName,
        employeeEmail: r.staffProfile.user.email,
        employeeCode: r.staffProfile.employeeCode,
        branchName: r.staffProfile.branch?.name || 'Main Campus',
        submittedAt: r.resignationDate,
        period: `Requested LWD: ${new Date(r.requestedLwd).toLocaleDateString('en-IN')}`,
        reason: r.reason,
        status: r.status === 'SUBMITTED' ? 'PENDING' : r.status,
        actionedByName: r.actionedById,
        actionedAt: r.actionedAt,
      })
    }

    // Sort newest first
    unified.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())

    // Apply type filter
    let filtered = unified
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter((r) => r.type === typeFilter)
    }

    const pendingCount = unified.filter((u) => u.status === 'PENDING').length
    const approvedCount = unified.filter((u) => u.status === 'APPROVED').length
    const rejectedCount = unified.filter((u) => u.status === 'REJECTED').length

    return ok({
      requests: filtered,
      stats: {
        total: unified.length,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
    })
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
