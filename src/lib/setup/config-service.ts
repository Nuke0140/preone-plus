/**
 * Central ConfigurationService
 *
 * READ and VALIDATION abstraction over existing database entities:
 * - AcademicSession
 * - Program
 * - Classroom
 * - Branch
 * - SchoolConfig
 *
 * NOT a new storage table. All methods directly query or validate against
 * the existing Prisma entities within tenant scope.
 */

import { db } from '@/lib/db'
import type { ProgramType } from '@prisma/client'

export class ConfigurationService {
  /** Get current active academic session for the tenant */
  static async getActiveAcademicYear(tenantId: string) {
    return db.academicSession.findFirst({
      where: { tenantId, isCurrent: true, status: 'ACTIVE' },
    })
  }

  /** Get all active preschool programs for the tenant */
  static async getPrograms(tenantId: string) {
    return db.program.findMany({
      where: { tenantId, deletedAt: null, isActive: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  /** Get a specific program by code or ID */
  static async getProgram(tenantId: string, programIdOrCode: string) {
    return db.program.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { id: programIdOrCode },
          { code: programIdOrCode.toUpperCase() },
        ],
      },
    })
  }

  /**
   * Validate age eligibility for a program based on child date of birth
   * Returns: { eligible: boolean, ageMonths: number, minMonths: number | null, maxMonths: number | null, reason?: string }
   */
  static async validateProgramAge(
    tenantId: string,
    programTypeOrId: string,
    dob: Date | string
  ) {
    const birthDate = new Date(dob)
    if (isNaN(birthDate.getTime())) {
      return { eligible: false, ageMonths: 0, minMonths: null, maxMonths: null, reason: 'Invalid date of birth' }
    }

    // Calculate age in months as of today
    const now = new Date()
    const ageMonths = (now.getFullYear() - birthDate.getFullYear()) * 12 + (now.getMonth() - birthDate.getMonth())

    const validProgramTypes = ['PLAYGROUP', 'NURSERY', 'LKG', 'UKG', 'DAYCARE']
    const orConditions: any[] = [
      { id: programTypeOrId },
      { code: programTypeOrId.toUpperCase() },
    ]
    if (validProgramTypes.includes(programTypeOrId.toUpperCase())) {
      orConditions.push({ programType: programTypeOrId.toUpperCase() as ProgramType })
    }

    const program = await db.program.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: orConditions,
      },
    })

    if (!program) {
      return {
        eligible: false,
        ageMonths,
        minMonths: null,
        maxMonths: null,
        reason: `Program "${programTypeOrId}" is not configured for this school. Configure programs in Setup first.`,
      }
    }

    const min = program.ageMinMonths
    const max = program.ageMaxMonths

    if (min != null && ageMonths < min) {
      return {
        eligible: false,
        ageMonths,
        minMonths: min,
        maxMonths: max,
        reason: `Child is ${ageMonths} months old; minimum required for ${program.name} is ${min} months.`,
      }
    }

    if (max != null && ageMonths > max) {
      return {
        eligible: false,
        ageMonths,
        minMonths: min,
        maxMonths: max,
        reason: `Child is ${ageMonths} months old; maximum permitted for ${program.name} is ${max} months.`,
      }
    }

    return { eligible: true, ageMonths, minMonths: min, maxMonths: max }
  }

  /** Get all academic sessions for the tenant */
  static async getAcademicYears(tenantId: string) {
    return db.academicSession.findMany({
      where: { tenantId },
      orderBy: { startDate: 'desc' },
    })
  }

  /** Get a single classroom by ID within tenant */
  static async getClassroom(tenantId: string, classroomId: string) {
    return db.classroom.findFirst({
      where: { id: classroomId, tenantId },
      include: {
        program: true,
        primaryTeacher: { select: { id: true, fullName: true, email: true, phone: true } },
        facility: true,
        academicSession: true,
        _count: { select: { students: true } },
      },
    })
  }

  /**
   * Validate classroom capacity against current active enrollment.
   * Returns: { valid: boolean, currentCapacity: number, activeEnrolled: number, message?: string }
   */
  static async validateClassroomCapacity(
    tenantId: string,
    classroomId: string,
    targetCapacity: number
  ) {
    const classroom = await db.classroom.findFirst({
      where: { id: classroomId, tenantId },
    })
    if (!classroom) {
      return { valid: false, currentCapacity: 0, activeEnrolled: 0, message: 'Classroom not found' }
    }

    const activeEnrolled = await db.student.count({
      where: { currentClassroomId: classroomId, tenantId, status: 'ACTIVE', deletedAt: null },
    })

    if (targetCapacity < activeEnrolled) {
      return {
        valid: false,
        currentCapacity: classroom.capacity,
        activeEnrolled,
        message: `Proposed capacity (${targetCapacity}) cannot be lower than current active enrollment (${activeEnrolled} students).`,
      }
    }

    return {
      valid: true,
      currentCapacity: classroom.capacity,
      activeEnrolled,
    }
  }

  /** Get all branches for the tenant */
  static async getBranches(tenantId: string) {
    return db.branch.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
    })
  }

  /** Get a single branch by ID or main branch */
  static async getBranch(tenantId: string, branchId?: string) {
    return branchId
      ? db.branch.findFirst({ where: { id: branchId, tenantId, deletedAt: null } })
      : db.branch.findFirst({ where: { tenantId, isMain: true, deletedAt: null } })
  }

  /** Get facilities registered under a branch or tenant */
  static async getFacilities(tenantId: string, branchId?: string) {
    return db.facility.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      },
      orderBy: [{ branchId: 'asc' }, { type: 'asc' }],
    })
  }

  /** Get classrooms for a tenant with program and teacher details */
  static async getClassrooms(tenantId: string, academicSessionId?: string) {
    return db.classroom.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(academicSessionId ? { academicSessionId } : {}),
      },
      include: {
        program: true,
        primaryTeacher: { select: { id: true, fullName: true, email: true } },
        _count: { select: { students: true } },
      },
      orderBy: [{ programType: 'asc' }, { name: 'asc' }],
    })
  }

  /** Get school calendar entries for the tenant and optional session */
  static async getSchoolCalendar(tenantId: string, academicSessionId?: string) {
    return db.calendarEvent.findMany({
      where: {
        tenantId,
        ...(academicSessionId ? { academicSessionId } : {}),
      },
      orderBy: { date: 'asc' },
    })
  }

  /** Get operating schedule and timings (from Branch and SchoolConfig OPERATING domain) */
  static async getOperatingSchedule(tenantId: string, branchId?: string) {
    const [branch, config] = await Promise.all([
      branchId
        ? db.branch.findFirst({ where: { id: branchId, tenantId, deletedAt: null } })
        : db.branch.findFirst({ where: { tenantId, isMain: true, deletedAt: null } }),
      db.schoolConfig.findUnique({
        where: { tenantId_domain: { tenantId, domain: 'OPERATING' } },
      }),
    ])

    const configData = (config?.data as Record<string, unknown>) || {}

    return {
      timingOpen: branch?.timingOpen || '08:30',
      timingClose: branch?.timingClose || '16:00',
      arrivalWindow: configData.arrivalWindow || '08:30–09:00',
      pickupWindow: configData.pickupWindow || '15:30–16:00',
      workingDays: configData.workingDays || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
      terms: configData.terms || [],
    }
  }
}
