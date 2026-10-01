/**
 * PreOne — Notifications & Communication: Recipient Resolver
 *
 * CANONICAL RECIPIENT RESOLUTION ONLY:
 * - Traverses Student -> StudentGuardian (receivesComm: true) -> Guardian -> User
 * - Resolves Staff by branch, department, role via StaffProfile -> User
 * - NEVER trusts client-supplied recipient IDs for sensitive or child communication.
 */

import { db } from '@/lib/db'

export interface ResolvedRecipient {
  userId?: string | null
  guardianId?: string | null
  staffProfileId?: string | null
  studentId?: string | null
  fullName: string
  phone?: string | null
  email?: string | null
  relationship?: string | null
  role?: string | null
  isPrimary?: boolean
}

export class RecipientResolver {
  /**
   * Resolves authorized guardians for a specific student.
   * Only returns guardians who have receivesComm = true (or all if filter not applied).
   */
  static async resolveChildGuardians(
    tenantId: string,
    studentId: string,
    options?: { onlyPrimary?: boolean; onlyFeePayers?: boolean }
  ): Promise<ResolvedRecipient[]> {
    const studentGuardians = await db.studentGuardian.findMany({
      where: {
        studentId,
        student: { tenantId },
        receivesComm: true,
        ...(options?.onlyPrimary ? { isPrimary: true } : {}),
        ...(options?.onlyFeePayers ? { isFeePayer: true } : {}),
      },
      include: {
        guardian: {
          include: {
            user: { select: { id: true, email: true, phone: true } },
          },
        },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    })

    return studentGuardians.map((sg) => ({
      userId: sg.guardian.userId || sg.guardian.user?.id || null,
      guardianId: sg.guardian.id,
      studentId,
      fullName: sg.guardian.fullName,
      phone: sg.guardian.phone || sg.guardian.user?.phone || null,
      email: sg.guardian.email || sg.guardian.user?.email || null,
      relationship: sg.relationship || sg.guardian.relationship,
      isPrimary: sg.isPrimary,
      role: 'PARENT',
    }))
  }

  /**
   * Resolves authorized guardians for all active students in a classroom.
   */
  static async resolveClassroomGuardians(
    tenantId: string,
    classroomId: string
  ): Promise<ResolvedRecipient[]> {
    const students = await db.student.findMany({
      where: {
        tenantId,
        currentClassroomId: classroomId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: { id: true },
    })

    const studentIds = students.map((s) => s.id)
    if (studentIds.length === 0) return []

    const studentGuardians = await db.studentGuardian.findMany({
      where: {
        studentId: { in: studentIds },
        receivesComm: true,
      },
      include: {
        guardian: {
          include: {
            user: { select: { id: true, email: true, phone: true } },
          },
        },
      },
    })

    // Deduplicate by guardian ID so parents with multiple siblings don't get duplicate notifications
    const map = new Map<string, ResolvedRecipient>()
    for (const sg of studentGuardians) {
      if (!map.has(sg.guardianId)) {
        map.set(sg.guardianId, {
          userId: sg.guardian.userId || sg.guardian.user?.id || null,
          guardianId: sg.guardian.id,
          studentId: sg.studentId,
          fullName: sg.guardian.fullName,
          phone: sg.guardian.phone || sg.guardian.user?.phone || null,
          email: sg.guardian.email || sg.guardian.user?.email || null,
          relationship: sg.relationship || sg.guardian.relationship,
          isPrimary: sg.isPrimary,
          role: 'PARENT',
        })
      }
    }

    return Array.from(map.values())
  }

  /**
   * Resolves staff recipients based on role, branch, or designation.
   */
  static async resolveStaffRecipients(
    tenantId: string,
    filters?: {
      role?: string
      branchId?: string | null
      department?: string
      staffProfileId?: string
      userId?: string
    }
  ): Promise<ResolvedRecipient[]> {
    if (filters?.userId) {
      const u = await db.user.findFirst({
        where: {
          id: filters.userId,
          memberships: { some: { tenantId, status: 'ACTIVE' } },
        },
        include: { staffProfile: true },
      })
      if (!u) return []
      return [
        {
          userId: u.id,
          staffProfileId: u.staffProfile?.id || null,
          fullName: u.fullName,
          phone: u.phone,
          email: u.email,
          role: u.staffProfile?.designation || 'STAFF',
        },
      ]
    }

    const profiles = await db.staffProfile.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        deletedAt: null,
        ...(filters?.branchId ? { branchId: filters.branchId } : {}),
        ...(filters?.department ? { department: filters.department as any } : {}),
        ...(filters?.staffProfileId ? { id: filters.staffProfileId } : {}),
        ...(filters?.role
          ? {
              user: {
                memberships: {
                  some: {
                    tenantId,
                    role: filters.role as any,
                    status: 'ACTIVE',
                  },
                },
              },
            }
          : {}),
      },
      include: {
        user: { select: { id: true, email: true, phone: true, fullName: true } },
      },
    })

    return profiles.map((sp) => ({
      userId: sp.userId,
      staffProfileId: sp.id,
      fullName: sp.user.fullName,
      phone: sp.user.phone,
      email: sp.user.email,
      role: sp.designation || 'STAFF',
    }))
  }

  /**
   * Resolves student riders and their guardians for a transport trip or route.
   */
  static async resolveTransportRiders(
    tenantId: string,
    tripId: string
  ): Promise<{ studentId: string; studentName: string; guardians: ResolvedRecipient[] }[]> {
    const trip = await db.transportTrip.findFirst({
      where: { id: tripId, tenantId },
      include: {
        manifest: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    })

    if (!trip) return []

    const results: { studentId: string; studentName: string; guardians: ResolvedRecipient[] }[] = []

    for (const item of trip.manifest) {
      const guardians = await this.resolveChildGuardians(tenantId, item.studentId)
      const studentName = [item.student.firstName, item.student.lastName].filter(Boolean).join(' ')
      results.push({
        studentId: item.studentId,
        studentName,
        guardians,
      })
    }

    return results
  }
}
