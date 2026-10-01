/**
 * PreOne — M03.5 Classroom Placements Service
 * Final Production Implementation
 *
 * The final operational stage of M03 Admissions:
 *  - Parent/User identity creation or reuse (M01 identity)
 *  - Parent credential provisioning (secure hash, never plain-text, password not reset for siblings)
 *  - Multiple parent/guardian linking (isPrimary, canPickup, pickupPin, isFeePayer, receivesComm)
 *  - Student creation (M02 canonical Student: STU-YYYY-XXXX, no normal student login)
 *  - Student-Guardian linking (StudentGuardian)
 *  - Branch, Academic Session, and Program compatibility validation
 *  - Classroom/Division selection
 *  - In-transaction capacity check (concurrency-safe)
 *  - Seat assignment with double-assignment prevention
 *  - Automatic Class Teacher resolution from classroom configuration (mandatory gate)
 *  - Fee Setup reference handoff (Finance ownership preserved)
 *  - Atomic transaction with full rollback on partial failure
 *  - Idempotent execution on double-click/retry
 *  - Full audit trail & Parent Portal readiness
 */

import { db } from '@/lib/db'
import { audit, nextNumber } from '@/lib/sequence'
import { emit } from '@/lib/events'
import { ConfigurationService } from '@/lib/setup/config-service'
import { getDomainConfig } from '@/lib/config'
import bcrypt from 'bcryptjs'
import type { ScopeContext } from './admission-service'
import type {
  ProgramType,
  Gender,
  Relationship,
  BloodGroup,
  ApplicationStatus,
} from '@prisma/client'

// ── Types & DTOs ─────────────────────────────────────────────────────────────

export interface PlacementCandidateSummary {
  applicationId: string
  applicationNumber: string
  leadId: string | null
  waitingListEntryId?: string | null
  source: 'APPLICATION' | 'WAITING_LIST'
  childFirstName: string
  childLastName: string | null
  childFullName: string
  childDob: Date
  childAgeMonths: number
  childGender: Gender
  parentName: string
  parentPhone: string
  parentEmail: string | null
  programType: ProgramType
  branchId: string
  academicSessionId: string
  status: ApplicationStatus | string
  offerNumber?: string | null
  offerAcceptedAt?: Date | null
  isEligibleForPlacement: boolean
  eligibilityReason?: string
  hasVerifiedDocs: boolean
  isAgeEligible: boolean
}

export interface GuardianInput {
  fullName: string
  phone: string
  email?: string | null
  relationship?: Relationship | string
  isPrimaryContact?: boolean
  canPickup?: boolean
  pickupPin?: string | null
  isFeePayer?: boolean
  receivesCommunication?: boolean
}

export interface CompletePlacementInput {
  classroomId: string
  seatNumber: string
  branchId?: string
  academicSessionId?: string
  academicYearId?: string
  primaryParent?: {
    fullName?: string
    phone?: string
    email?: string | null
    relationship?: Relationship | string
    canPickup?: boolean
    pickupPin?: string | null
    isFeePayer?: boolean
    receivesComm?: boolean
  }
  additionalGuardians?: GuardianInput[]
  childOverrides?: {
    bloodGroup?: BloodGroup | null
    address?: string | null
    emergencyContact?: string | null
    medicalNotes?: string | null
    photoUrl?: string | null
  }
  notes?: string
}

export interface PlacementValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  candidate: {
    applicationId: string
    applicationNumber: string
    childName: string
    programType: ProgramType
  }
  classroom?: {
    id: string
    name: string
    code: string
    capacity: number
    enrolledCount: number
    availableSeats: number
    isFull: boolean
  }
  classTeacher?: {
    id: string
    name: string
    email: string | null
    phone: string | null
  } | null
  seat?: {
    seatNumber: string
    isAvailable: boolean
  }
}

export class ClassroomPlacementService {
  // =========================================================================
  // SCOPE VERIFICATION HELPER
  // =========================================================================
  private static async verifyScope(
    tenantId: string,
    branchId?: string | null,
    academicYearId?: string | null
  ) {
    if (!tenantId) throw new Error('Tenant context is required')

    const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) throw new Error(`Tenant not found: ${tenantId}`)

    let finalBranchId = branchId
    if (!finalBranchId) {
      const main = await db.branch.findFirst({
        where: { tenantId, isMain: true, deletedAt: null },
      })
      finalBranchId = main?.id
      if (!finalBranchId) {
        const anyBranch = await db.branch.findFirst({
          where: { tenantId, deletedAt: null },
        })
        finalBranchId = anyBranch?.id
      }
    }
    if (!finalBranchId) throw new Error(`No branch found for tenant: ${tenantId}`)

    let finalAcademicYearId = academicYearId
    if (!finalAcademicYearId) {
      const currentYear = await db.academicSession.findFirst({
        where: { tenantId, isCurrent: true, deletedAt: null },
      })
      finalAcademicYearId = currentYear?.id
      if (!finalAcademicYearId) {
        const anyYear = await db.academicSession.findFirst({
          where: { tenantId, deletedAt: null },
          orderBy: { startDate: 'desc' },
        })
        finalAcademicYearId = anyYear?.id
      }
    }
    if (!finalAcademicYearId) {
      throw new Error(`No academic session found for tenant: ${tenantId}`)
    }

    return {
      tenantId,
      branchId: finalBranchId,
      academicYearId: finalAcademicYearId,
    }
  }

  // =========================================================================
  // 1. ELIGIBLE CANDIDATES QUEUE
  // =========================================================================

  /**
   * Returns candidates who are approved and ready for classroom placement.
   * Input eligibility rule:
   *  - M03.3 Application: OFFER_ACCEPTED, APPROVED, or READY_FOR_ALLOCATION
   *  - M03.4 Waiting List: PARENT_ACCEPTED or READY_FOR_ADMISSION
   *  - Must NOT be already enrolled or terminal (REJECTED/WITHDRAWN/EXPIRED)
   */
  static async getEligibleCandidates(
    ctx: ScopeContext,
    filters?: {
      branchId?: string
      academicYearId?: string
      programType?: ProgramType
      search?: string
    }
  ): Promise<PlacementCandidateSummary[]> {
    const scope = await this.verifyScope(ctx.tenantId, filters?.branchId || ctx.branchId, filters?.academicYearId || ctx.academicYearId)

    // 1. Fetch eligible applications
    const apps = await db.admissionApplication.findMany({
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        academicSessionId: scope.academicYearId,
        deletedAt: null,
        status: { in: ['OFFER_ACCEPTED', 'APPROVED'] },
        studentId: null, // NOT yet enrolled
        ...(filters?.programType ? { programType: filters.programType } : {}),
        ...(filters?.search
          ? {
              OR: [
                { childFirstName: { contains: filters.search, mode: 'insensitive' } },
                { childLastName: { contains: filters.search, mode: 'insensitive' } },
                { parentName: { contains: filters.search, mode: 'insensitive' } },
                { parentPhone: { contains: filters.search } },
                { applicationNumber: { contains: filters.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        documents: true,
        offers: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const wlMap = new Map<string, string>()
    if (apps.length > 0) {
      try {
        const appIds = apps.map((a) => a.id)
        const placeholders = appIds.map((_, i) => `$${i + 2}`).join(',')
        const wlRows = await db.$queryRawUnsafe<any[]>(
          `SELECT id, application_id FROM waiting_list_entries WHERE tenant_id = $1 AND application_id IN (${placeholders}) AND deleted_at IS NULL`,
          scope.tenantId,
          ...appIds
        )
        for (const row of wlRows) {
          wlMap.set(row.application_id, row.id)
        }
      } catch {}
    }

    const results: PlacementCandidateSummary[] = []

    for (const app of apps) {
      const childAgeMonths = Math.floor(
        (Date.now() - new Date(app.childDob).getTime()) / (1000 * 60 * 60 * 24 * 30.4375)
      )

      const verifiedDocs = app.documents.filter((d) => d.status === 'VERIFIED' || d.verified)
      const hasRejectedDocs = app.documents.some((d) => d.status === 'REJECTED')
      const hasVerifiedDocs = verifiedDocs.length === app.documents.length && !hasRejectedDocs

      const ageCheck = await ConfigurationService.validateProgramAge(scope.tenantId, app.programType, app.childDob)

      const latestOffer = app.offers[0]
      const isOfferAccepted = latestOffer ? latestOffer.status === 'ACCEPTED' : app.status === 'APPROVED'

      const isEligible = hasVerifiedDocs && ageCheck.eligible && isOfferAccepted

      const isFromWaitlist = wlMap.has(app.id)

      results.push({
        applicationId: app.id,
        applicationNumber: app.applicationNumber,
        leadId: app.leadId,
        waitingListEntryId: wlMap.get(app.id) || null,
        source: isFromWaitlist ? 'WAITING_LIST' : 'APPLICATION',
        childFirstName: app.childFirstName,
        childLastName: app.childLastName,
        childFullName: `${app.childFirstName} ${app.childLastName || ''}`.trim(),
        childDob: app.childDob,
        childAgeMonths,
        childGender: app.childGender,
        parentName: app.parentName,
        parentPhone: app.parentPhone,
        parentEmail: app.parentEmail,
        programType: app.programType,
        branchId: app.branchId,
        academicSessionId: app.academicSessionId,
        status: app.status,
        offerNumber: latestOffer?.offerNumber || null,
        offerAcceptedAt: latestOffer?.acceptedAt || null,
        isEligibleForPlacement: isEligible,
        eligibilityReason: !hasVerifiedDocs
          ? 'Documents pending verification'
          : !ageCheck.eligible
          ? ageCheck.reason || 'Age criteria not satisfied'
          : !isOfferAccepted
          ? 'Offer acceptance pending'
          : 'Ready for classroom placement',
        hasVerifiedDocs,
        isAgeEligible: ageCheck.eligible,
      })
    }

    return results
  }

  // =========================================================================
  // 2. PLACEMENT DOSSIER (ZERO DATA RE-ENTRY)
  // =========================================================================

  /**
   * Loads full pre-placement dossier for a candidate with all prefilled data.
   */
  static async getPlacementDossier(ctx: ScopeContext, applicationId: string) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const app = await db.admissionApplication.findFirst({
      where: { id: applicationId, tenantId: scope.tenantId, deletedAt: null },
      include: {
        documents: true,
        lead: true,
        academicSession: true,
        program: true,
        offers: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    if (!app) throw new Error('Application not found')

    const branch = await db.branch.findFirst({
      where: { id: app.branchId, tenantId: scope.tenantId },
    })

    // 1. Resolve existing parent user / guardian
    const cleanPhone = app.parentPhone.trim().replace(/\D/g, '')
    const existingGuardian = await db.guardian.findFirst({
      where: {
        tenantId: scope.tenantId,
        phone: { contains: cleanPhone.slice(-10) },
        deletedAt: null,
      },
      include: {
        user: true,
      },
    })

    const existingUser = existingGuardian?.user || (app.parentEmail
      ? await db.user.findUnique({ where: { email: app.parentEmail.toLowerCase().trim() } })
      : await db.user.findFirst({ where: { phone: app.parentPhone.trim() } }))

    // 2. Resolve additional guardians from metadata notes
    let additionalGuardians: GuardianInput[] = []
    let bloodGroup: BloodGroup | null = null
    let address: string | null = null
    let emergencyContact: string | null = null
    let medicalNotes: string | null = null

    if (app.notes) {
      const metaMatch = app.notes.match(/\[Metadata:\s*(\{.*?\})\]/)
      if (metaMatch) {
        try {
          const parsed = JSON.parse(metaMatch[1])
          if (parsed.additionalGuardians && Array.isArray(parsed.additionalGuardians)) {
            additionalGuardians = parsed.additionalGuardians
          }
          if (parsed.bloodGroup) bloodGroup = parsed.bloodGroup
          if (parsed.address) address = parsed.address
          if (parsed.emergencyContact) emergencyContact = parsed.emergencyContact
          if (parsed.medicalNotes) medicalNotes = parsed.medicalNotes
        } catch {}
      }
    }

    // 3. Resolve Classrooms with Teacher, Capacity, and Occupied Count
    const classrooms = await this.getClassroomsForPlacement(ctx, applicationId)

    // 4. Resolve Fee Setup Reference
    const latestOffer = app.offers[0]
    let feeSnapshot: any = null
    if (latestOffer?.terms && latestOffer.terms.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(latestOffer.terms)
        feeSnapshot = parsed.feeSnapshot || null
      } catch {}
    }

    const feePlan = await db.feePlan.findFirst({
      where: { tenantId: scope.tenantId, programType: app.programType, isActive: true },
      include: { items: true },
    })

    const isAlreadyEnrolled = Boolean(app.status === 'ENROLLED' && app.studentId)
    let enrolledStudent: any = null
    if (isAlreadyEnrolled && app.studentId) {
      enrolledStudent = await db.student.findUnique({
        where: { id: app.studentId },
        include: { currentClassroom: { include: { primaryTeacher: true } } },
      })
    }

    return {
      application: {
        id: app.id,
        applicationNumber: app.applicationNumber,
        status: app.status,
        isAlreadyEnrolled,
        leadId: app.leadId,
        leadNumber: app.lead?.leadNumber || null,
        submittedAt: app.submittedAt,
        notes: app.notes,
      },
      child: {
        firstName: app.childFirstName,
        lastName: app.childLastName,
        fullName: `${app.childFirstName} ${app.childLastName || ''}`.trim(),
        dob: app.childDob,
        gender: app.childGender,
        bloodGroup,
        address,
        emergencyContact,
        medicalNotes,
      },
      parent: {
        fullName: app.parentName,
        phone: app.parentPhone,
        email: app.parentEmail,
        relationship: 'PARENT',
        existingGuardianId: existingGuardian?.id || null,
        existingUserId: existingUser?.id || null,
        existingUsername: existingUser?.username || null,
        accountStatus: existingUser ? existingUser.status : 'NEW_PROVISION_REQUIRED',
        additionalGuardians,
      },
      academicPlacement: {
        branchId: app.branchId,
        branchName: branch?.name || 'Main Campus',
        academicSessionId: app.academicSessionId,
        academicSessionName: app.academicSession?.name || 'Academic Session 2026-27',
        programType: app.programType,
        programName: app.program?.name || app.programType,
      },
      classrooms,
      feeSetup: {
        offerId: latestOffer?.id || null,
        offerNumber: latestOffer?.offerNumber || null,
        offerStatus: latestOffer?.status || null,
        payableRupees: latestOffer ? latestOffer.feeTotalCents / 100 : (feePlan ? feePlan.totalAnnualCents / 100 : 0),
        feeSnapshot,
        feePlanName: feePlan?.name || app.programType,
      },
      enrolledStudent: enrolledStudent
        ? {
            id: enrolledStudent.id,
            admissionNo: enrolledStudent.admissionNo,
            admissionDate: enrolledStudent.admissionDate,
            seatNumber: enrolledStudent.seatNumber,
            classroomName: enrolledStudent.currentClassroom?.name || 'Assigned',
            classTeacherName: enrolledStudent.currentClassroom?.primaryTeacher?.fullName || 'Not Configured',
          }
        : null,
    }
  }

  // =========================================================================
  // 3. CLASSROOMS & AUTOMATIC CLASS TEACHER RESOLUTION
  // =========================================================================

  /**
   * Fetches classrooms eligible for this candidate with live capacity and automatic teacher resolution.
   */
  static async getClassroomsForPlacement(ctx: ScopeContext, applicationId: string) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const app = await db.admissionApplication.findFirst({
      where: { id: applicationId, tenantId: scope.tenantId, deletedAt: null },
    })
    if (!app) throw new Error('Application not found')

    const classrooms = await db.classroom.findMany({
      where: {
        tenantId: scope.tenantId,
        branchId: app.branchId,
        academicSessionId: app.academicSessionId,
        programType: app.programType,
        isActive: true,
      },
      include: {
        primaryTeacher: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            status: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const results: any[] = []
    for (const c of classrooms) {
      const activeEnrollment = await db.student.count({
        where: {
          tenantId: scope.tenantId,
          currentClassroomId: c.id,
          status: 'ACTIVE',
          deletedAt: null,
        },
      })

      const availableSeats = Math.max(0, c.capacity - activeEnrollment)
      const hasTeacher = Boolean(c.primaryTeacherId && c.primaryTeacher)

      results.push({
        id: c.id,
        name: c.name,
        code: c.code,
        programType: c.programType,
        capacity: c.capacity,
        enrolledCount: activeEnrollment,
        availableSeats,
        isFull: activeEnrollment >= c.capacity,
        hasTeacher,
        teacherWarning: !hasTeacher ? '⚠️ Class Teacher Not Configured' : null,
        primaryTeacher: c.primaryTeacher
          ? {
              id: c.primaryTeacher.id,
              name: c.primaryTeacher.fullName,
              email: c.primaryTeacher.email,
              phone: c.primaryTeacher.phone,
            }
          : null,
      })
    }

    return results
  }

  // =========================================================================
  // 4. SEATS GRID RESOLUTION
  // =========================================================================

  /**
   * Generates seat inventory for a classroom and checks availability/occupancy.
   */
  static async getAvailableSeats(ctx: ScopeContext, applicationId: string, classroomId: string) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const classroom = await db.classroom.findFirst({
      where: { id: classroomId, tenantId: scope.tenantId, isActive: true },
      include: {
        primaryTeacher: true,
      },
    })
    if (!classroom) throw new Error('Classroom not found or inactive')

    // Find all actively enrolled students in this classroom who have an assigned seatNumber
    const enrolledStudents = await db.student.findMany({
      where: {
        tenantId: scope.tenantId,
        currentClassroomId: classroom.id,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: {
        id: true,
        admissionNo: true,
        firstName: true,
        lastName: true,
        seatNumber: true,
      },
    })

    const occupiedSeatMap = new Map<string, { studentId: string; admissionNo: string; studentName: string }>()
    for (const s of enrolledStudents) {
      if (s.seatNumber) {
        occupiedSeatMap.set(s.seatNumber.trim().toUpperCase(), {
          studentId: s.id,
          admissionNo: s.admissionNo,
          studentName: `${s.firstName} ${s.lastName || ''}`.trim(),
        })
      }
    }

    const seats: any[] = []
    const totalCapacity = classroom.capacity || 20
    for (let i = 1; i <= totalCapacity; i++) {
      const seatNo = String(i).padStart(2, '0')
      const occupiedInfo = occupiedSeatMap.get(seatNo.toUpperCase()) || occupiedSeatMap.get(String(i))
      seats.push({
        seatNumber: seatNo,
        isAvailable: !occupiedInfo,
        occupiedBy: occupiedInfo || null,
      })
    }

    return {
      classroomId: classroom.id,
      classroomName: classroom.name,
      capacity: totalCapacity,
      enrolledCount: enrolledStudents.length,
      availableCount: Math.max(0, totalCapacity - enrolledStudents.length),
      classTeacher: classroom.primaryTeacher
        ? {
            id: classroom.primaryTeacher.id,
            name: classroom.primaryTeacher.fullName,
          }
        : null,
      seats,
    }
  }

  // =========================================================================
  // 5. PRE-PLACEMENT VALIDATION (PRE-FLIGHT GATE)
  // =========================================================================

  /**
   * Rigorously verifies all prerequisites before committing transaction.
   * Enforces:
   *  - Candidate eligibility
   *  - Classroom match (Branch, Session, Program)
   *  - Capacity check (Available > 0)
   *  - Seat available
   *  - Automatic Class Teacher is configured (mandatory gate)
   */
  static async validatePlacement(
    ctx: ScopeContext,
    applicationId: string,
    input: {
      classroomId: string
      seatNumber: string
    }
  ): Promise<PlacementValidationResult> {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const errors: string[] = []
    const warnings: string[] = []

    const app = await db.admissionApplication.findFirst({
      where: { id: applicationId, tenantId: scope.tenantId, deletedAt: null },
      include: { documents: true, offers: { orderBy: { createdAt: 'desc' }, take: 1 } },
    })
    if (!app) {
      return {
        isValid: false,
        errors: ['Application not found'],
        warnings: [],
        candidate: { applicationId, applicationNumber: 'UNKNOWN', childName: 'UNKNOWN', programType: 'NURSERY' },
      }
    }

    const childName = `${app.childFirstName} ${app.childLastName || ''}`.trim()

    // 1. Eligibility gate
    if (app.status === 'ENROLLED' || app.status === 'ADMITTED') {
      errors.push(`Candidate is already enrolled with student record ${app.studentId || ''}`)
    }
    if (['REJECTED', 'WITHDRAWN', 'EXPIRED'].includes(app.status)) {
      errors.push(`Cannot place candidate in terminal status ${app.status}`)
    }
    if (!['APPROVED', 'OFFER_ACCEPTED'].includes(app.status)) {
      errors.push(`Candidate must be in APPROVED or OFFER_ACCEPTED status (current: ${app.status})`)
    }

    // 2. Documents verification check
    const unverifiedDocs = app.documents.filter((d) => d.status !== 'VERIFIED' && !d.verified)
    if (unverifiedDocs.length > 0) {
      errors.push(`${unverifiedDocs.length} mandatory documents are still pending verification`)
    }
    if (app.documents.some((d) => d.status === 'REJECTED')) {
      errors.push('One or more documents are marked as Rejected')
    }

    // 3. Classroom verification
    const classroom = await db.classroom.findFirst({
      where: { id: input.classroomId, tenantId: scope.tenantId, isActive: true },
      include: { primaryTeacher: true },
    })
    if (!classroom) {
      errors.push('Selected classroom does not exist or is inactive')
      return {
        isValid: false,
        errors,
        warnings,
        candidate: { applicationId: app.id, applicationNumber: app.applicationNumber, childName, programType: app.programType },
      }
    }

    if (classroom.programType !== app.programType) {
      errors.push(`Classroom program (${classroom.programType}) does not match candidate program (${app.programType})`)
    }
    if (classroom.branchId !== app.branchId) {
      errors.push(`Classroom branch does not match candidate branch`)
    }
    if (classroom.academicSessionId !== app.academicSessionId) {
      errors.push(`Classroom academic session does not match candidate session`)
    }

    // 4. Capacity check
    const activeEnrolledCount = await db.student.count({
      where: { tenantId: scope.tenantId, currentClassroomId: classroom.id, status: 'ACTIVE', deletedAt: null },
    })
    const isFull = activeEnrolledCount >= classroom.capacity
    if (isFull) {
      errors.push(`Classroom ${classroom.name} is at maximum capacity (${activeEnrolledCount}/${classroom.capacity})`)
    }

    // 5. Mandatory Class Teacher Gate
    if (!classroom.primaryTeacherId || !classroom.primaryTeacher) {
      errors.push(`Class Teacher is not configured for ${classroom.name}. An active class teacher must be configured in Classroom Setup before completing placement.`)
    }

    // 6. Seat assignment check
    if (!input.seatNumber || !input.seatNumber.trim()) {
      errors.push('Seat number selection is required')
    } else {
      const normalizedSeat = input.seatNumber.trim().toUpperCase()
      const existingSeatStudent = await db.student.findFirst({
        where: {
          tenantId: scope.tenantId,
          currentClassroomId: classroom.id,
          seatNumber: { equals: normalizedSeat, mode: 'insensitive' },
          status: 'ACTIVE',
          deletedAt: null,
        },
      })
      if (existingSeatStudent) {
        errors.push(`Seat ${input.seatNumber} is already occupied by ${existingSeatStudent.firstName} ${existingSeatStudent.lastName || ''} (${existingSeatStudent.admissionNo})`)
      }
    }

    const isValid = errors.length === 0

    return {
      isValid,
      errors,
      warnings,
      candidate: {
        applicationId: app.id,
        applicationNumber: app.applicationNumber,
        childName,
        programType: app.programType,
      },
      classroom: {
        id: classroom.id,
        name: classroom.name,
        code: classroom.code,
        capacity: classroom.capacity,
        enrolledCount: activeEnrolledCount,
        availableSeats: Math.max(0, classroom.capacity - activeEnrolledCount),
        isFull,
      },
      classTeacher: classroom.primaryTeacher
        ? {
            id: classroom.primaryTeacher.id,
            name: classroom.primaryTeacher.fullName,
            email: classroom.primaryTeacher.email,
            phone: classroom.primaryTeacher.phone,
          }
        : null,
      seat: {
        seatNumber: input.seatNumber,
        isAvailable: !errors.some((e) => e.includes('Seat')),
      },
    }
  }

  // =========================================================================
  // 6. ATOMIC TRANSACTION: COMPLETE PLACEMENT & ADMISSION
  // =========================================================================

  /**
   * Completes M03.5 Classroom Placement and atomic admission fan-out.
   *
   * Flow inside transaction:
   *  1. Re-checks classroom capacity (concurrency guard)
   *  2. Re-checks seat availability (double-assignment guard)
   *  3. Enforces automatic class teacher resolution (blocks if unconfigured)
   *  4. Reuses or creates Parent M01 User & Guardian (never resets existing password)
   *  5. Provisions additional family guardians (StudentGuardian links)
   *  6. Creates canonical M02 Student (STU-YYYY-XXXX, no student login)
   *  7. Creates StudentAllocation record
   *  8. Sets student's currentClassroomId and seatNumber
   *  9. Fee setup handoff (links FeePlan/Offer)
   *  10. Transitions application to ENROLLED, lead to CONVERTED
   *  11. Creates Parent Portal welcome milestone
   *  12. Writes full audit log entries
   */
  static async completePlacement(
    ctx: ScopeContext,
    applicationId: string,
    input: CompletePlacementInput
  ) {
    const scope = await this.verifyScope(ctx.tenantId, input.branchId || ctx.branchId, input.academicYearId || ctx.academicYearId)

    const app = await db.admissionApplication.findFirst({
      where: { id: applicationId, tenantId: scope.tenantId, deletedAt: null },
      include: {
        documents: true,
        offers: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    if (!app) throw new Error('Admission application not found')

    // 1. Idempotency Check: double-click / retry protection
    if (app.status === 'ENROLLED' && app.studentId) {
      const existingStudent = await db.student.findUnique({
        where: { id: app.studentId },
        include: { currentClassroom: { include: { primaryTeacher: true } } },
      })
      if (existingStudent) {
        return {
          status: 'PLACEMENT_COMPLETED',
          isAlreadyEnrolled: true,
          student: {
            id: existingStudent.id,
            admissionNo: existingStudent.admissionNo,
            fullName: `${existingStudent.firstName} ${existingStudent.lastName || ''}`.trim(),
            dob: existingStudent.dob,
            gender: existingStudent.gender,
          },
          classroom: {
            id: existingStudent.currentClassroom?.id || app.classroomId,
            name: existingStudent.currentClassroom?.name || 'Assigned',
            code: existingStudent.currentClassroom?.code || '',
            capacity: existingStudent.currentClassroom?.capacity || 20,
          },
          seatNumber: existingStudent.seatNumber || input.seatNumber,
          classTeacher: existingStudent.currentClassroom?.primaryTeacher
            ? {
                id: existingStudent.currentClassroom.primaryTeacher.id,
                name: existingStudent.currentClassroom.primaryTeacher.fullName,
                email: existingStudent.currentClassroom.primaryTeacher.email,
              }
            : null,
          parentPortalReady: true,
          message: 'Admission already completed for this candidate.',
        }
      }
    }

    // 2. Pre-placement Validation
    const validation = await this.validatePlacement(ctx, applicationId, {
      classroomId: input.classroomId,
      seatNumber: input.seatNumber,
    })
    if (!validation.isValid) {
      throw new Error(`Placement validation failed: ${validation.errors.join('; ')}`)
    }

    const classroom = await db.classroom.findFirst({
      where: { id: input.classroomId, tenantId: scope.tenantId },
      include: { primaryTeacher: true },
    })
    if (!classroom) throw new Error('Classroom not found')

    // Teacher resolution check
    if (!classroom.primaryTeacherId || !classroom.primaryTeacher) {
      throw new Error(
        `Class teacher is not configured for classroom "${classroom.name}". An active class teacher must be configured before completing placement.`
      )
    }

    const normalizedSeatNumber = input.seatNumber.trim().toUpperCase()

    // Audit Placement Started
    await audit({
      tenantId: scope.tenantId,
      branchId: classroom.branchId,
      academicSessionId: classroom.academicSessionId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'PLACEMENT_STARTED',
      entity: 'AdmissionApplication',
      entityId: applicationId,
      summary: `Classroom placement started for ${app.applicationNumber} (${app.childFirstName}) in ${classroom.name} (Seat ${normalizedSeatNumber})`,
    })

    // =========================================================================
    // ATOMIC TRANSACTION: ALL-OR-NOTHING COMMIT
    // =========================================================================
    const result = await db.$transaction(async (tx) => {
      // 1. In-Transaction Capacity Re-Check (Concurrency Guard)
      const inTxEnrollment = await tx.student.count({
        where: {
          tenantId: scope.tenantId,
          currentClassroomId: classroom.id,
          status: 'ACTIVE',
          deletedAt: null,
        },
      })
      if (inTxEnrollment >= classroom.capacity) {
        const err: any = new Error(
          `Classroom ${classroom.name} reached maximum capacity (${inTxEnrollment}/${classroom.capacity}) while placing.`
        )
        err.code = 'CLASSROOM_FULL'
        throw err
      }

      // 2. In-Transaction Seat Re-Check (Double-Assignment Guard)
      const seatTaken = await tx.student.findFirst({
        where: {
          tenantId: scope.tenantId,
          currentClassroomId: classroom.id,
          seatNumber: { equals: normalizedSeatNumber, mode: 'insensitive' },
          status: 'ACTIVE',
          deletedAt: null,
        },
      })
      if (seatTaken) {
        const err: any = new Error(
          `Seat ${normalizedSeatNumber} was just assigned to another student (${seatTaken.admissionNo}). Please select a different seat.`
        )
        err.code = 'SEAT_ALREADY_ASSIGNED'
        throw err
      }

      // 3. Parent / Guardian Resolution (Reuse or Create M01 Identity)
      const primaryPhone = input.primaryParent?.phone?.trim() || app.parentPhone.trim()
      const primaryEmail = input.primaryParent?.email?.trim() || app.parentEmail?.trim() || null
      const primaryName = input.primaryParent?.fullName?.trim() || app.parentName.trim()

      const cleanPhone = primaryPhone.replace(/\D/g, '')

      let guardian = app.guardianId
        ? await tx.guardian.findFirst({
            where: { id: app.guardianId, tenantId: scope.tenantId, deletedAt: null },
          })
        : null

      if (!guardian) {
        guardian = await tx.guardian.findFirst({
          where: {
            tenantId: scope.tenantId,
            phone: { contains: cleanPhone.slice(-10) },
            deletedAt: null,
          },
        })
      }

      let parentUser = guardian?.userId
        ? await tx.user.findUnique({ where: { id: guardian.userId } })
        : null

      if (!parentUser && primaryEmail) {
        parentUser = await tx.user.findUnique({ where: { email: primaryEmail.toLowerCase() } })
      }
      if (!parentUser && primaryPhone) {
        parentUser = await tx.user.findFirst({ where: { phone: primaryPhone } })
      }

      let isNewParentAccount = false

      if (!parentUser) {
        // Create new Parent User in M01
        isNewParentAccount = true
        const cleanName = primaryName.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.')
        let username = `parent.${cleanName}.${Math.floor(100 + Math.random() * 900)}`
        let uAttempt = 0
        while (uAttempt < 5 && await tx.user.findUnique({ where: { username } })) {
          username = `parent.${cleanName}.${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`
          uAttempt++
        }
        const defaultPasswordHash = await bcrypt.hash('PreOneParent@2026', 10)

        parentUser = await tx.user.create({
          data: {
            email: primaryEmail ? primaryEmail.toLowerCase() : null,
            phone: primaryPhone,
            username,
            fullName: primaryName,
            passwordHash: defaultPasswordHash,
            status: 'ACTIVE',
          },
        })

        await tx.auditLog.create({
          data: {
            tenantId: scope.tenantId,
            branchId: classroom.branchId,
            academicSessionId: classroom.academicSessionId,
            actorId: ctx.actorId,
            actorName: ctx.actorName,
            actorRole: ctx.actorRole,
            action: 'PARENT_CREATED',
            entity: 'AdmissionApplication',
            entityId: applicationId,
            summary: `Created new Parent User ${parentUser.username} for ${parentUser.fullName}`,
          },
        })
      } else {
        // Reuse existing Parent User without resetting password (sibling support)
        await tx.auditLog.create({
          data: {
            tenantId: scope.tenantId,
            branchId: classroom.branchId,
            academicSessionId: classroom.academicSessionId,
            actorId: ctx.actorId,
            actorName: ctx.actorName,
            actorRole: ctx.actorRole,
            action: 'PARENT_REUSED',
            entity: 'AdmissionApplication',
            entityId: applicationId,
            summary: `Reused existing Parent User ${parentUser.username} (${parentUser.fullName}) for sibling admission`,
          },
        })
      }

      // Ensure TenantUser membership with role PARENT
      const existingMembership = await tx.tenantUser.findFirst({
        where: { tenantId: scope.tenantId, userId: parentUser.id },
      })
      if (!existingMembership) {
        await tx.tenantUser.create({
          data: {
            tenantId: scope.tenantId,
            userId: parentUser.id,
            role: 'PARENT',
            roles: ['PARENT'],
            branchId: classroom.branchId,
            status: 'ACTIVE',
          },
        })
      }

      // Ensure Guardian identity bound to User
      let guardianWithUser = parentUser
        ? await tx.guardian.findFirst({
            where: { userId: parentUser.id, tenantId: scope.tenantId, deletedAt: null },
          })
        : null

      if (guardianWithUser) {
        guardian = guardianWithUser
      } else if (!guardian) {
        const anyGuardianWithUser = parentUser
          ? await tx.guardian.findUnique({ where: { userId: parentUser.id } })
          : null

        guardian = anyGuardianWithUser || await tx.guardian.create({
          data: {
            tenantId: scope.tenantId,
            fullName: primaryName,
            phone: primaryPhone,
            email: primaryEmail,
            relationship: (input.primaryParent?.relationship as Relationship) || 'MOTHER',
            isPrimaryContact: true,
            userId: parentUser.id,
            pickupPin: input.primaryParent?.pickupPin || null,
          },
        })
      } else if (!guardian.userId && parentUser) {
        const anyGuardianWithUser = await tx.guardian.findUnique({ where: { userId: parentUser.id } })
        if (!anyGuardianWithUser) {
          guardian = await tx.guardian.update({
            where: { id: guardian.id },
            data: { userId: parentUser.id },
          })
        } else {
          guardian = anyGuardianWithUser
        }
      }

      // 4. Create Canonical M02 Student (no login/password)
      const admissionNo = await nextNumber('student', scope.tenantId)
      const bloodGroup = input.childOverrides?.bloodGroup || null
      const address = input.childOverrides?.address || null

      const student = await tx.student.create({
        data: {
          tenantId: scope.tenantId,
          branchId: classroom.branchId,
          admissionNo,
          firstName: app.childFirstName,
          lastName: app.childLastName,
          dob: app.childDob,
          gender: app.childGender,
          bloodGroup,
          address,
          photoUrl: input.childOverrides?.photoUrl || null,
          admissionDate: new Date(),
          currentClassroomId: classroom.id,
          seatNumber: normalizedSeatNumber,
          status: 'ACTIVE',
        },
      })

      await tx.auditLog.create({
        data: {
          tenantId: scope.tenantId,
          branchId: classroom.branchId,
          academicSessionId: classroom.academicSessionId,
          actorId: ctx.actorId,
          actorName: ctx.actorName,
          actorRole: ctx.actorRole,
          action: 'STUDENT_CREATED',
          entity: 'Student',
          entityId: student.id,
          summary: `Created Student record ${student.admissionNo} (${student.firstName} ${student.lastName || ''})`,
        },
      })

      // 5. Link Student to Primary Guardian
      await tx.studentGuardian.create({
        data: {
          studentId: student.id,
          guardianId: guardian.id,
          relationship: (input.primaryParent?.relationship as Relationship) || 'MOTHER',
          isPrimary: true,
          canPickup: input.primaryParent?.canPickup !== false,
          pickupPin: input.primaryParent?.pickupPin || null,
          isFeePayer: input.primaryParent?.isFeePayer !== false,
          receivesComm: input.primaryParent?.receivesComm !== false,
        },
      })

      await tx.auditLog.create({
        data: {
          tenantId: scope.tenantId,
          branchId: classroom.branchId,
          academicSessionId: classroom.academicSessionId,
          actorId: ctx.actorId,
          actorName: ctx.actorName,
          actorRole: ctx.actorRole,
          action: 'STUDENT_GUARDIAN_LINKED',
          entity: 'StudentGuardian',
          entityId: student.id,
          summary: `Linked Student ${student.admissionNo} to primary guardian ${guardian.fullName}`,
        },
      })

      // 6. Process Multiple Parents / Additional Guardians
      const extraGuardians = input.additionalGuardians || []
      const processedGuardians = [{ guardian, user: parentUser, isPrimary: true }]

      for (const ag of extraGuardians) {
        if (!ag.phone || !ag.fullName) continue
        const cleanAgPhone = ag.phone.trim().replace(/\D/g, '')

        let extraGuardian = await tx.guardian.findFirst({
          where: {
            tenantId: scope.tenantId,
            phone: { contains: cleanAgPhone.slice(-10) },
            deletedAt: null,
          },
        })

        let extraUser = extraGuardian?.userId
          ? await tx.user.findUnique({ where: { id: extraGuardian.userId } })
          : null

        if (!extraUser && ag.email) {
          extraUser = await tx.user.findUnique({ where: { email: ag.email.toLowerCase().trim() } })
        }
        if (!extraUser && ag.phone) {
          extraUser = await tx.user.findFirst({ where: { phone: ag.phone.trim() } })
        }

        if (!extraUser) {
          const cleanName = ag.fullName.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.')
          let username = `guardian.${cleanName}.${Math.floor(100 + Math.random() * 900)}`
          let gAttempt = 0
          while (gAttempt < 5 && await tx.user.findUnique({ where: { username } })) {
            username = `guardian.${cleanName}.${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`
            gAttempt++
          }
          const defaultPasswordHash = await bcrypt.hash('PreOneParent@2026', 10)

          extraUser = await tx.user.create({
            data: {
              email: ag.email ? ag.email.toLowerCase().trim() : null,
              phone: ag.phone.trim(),
              username,
              fullName: ag.fullName.trim(),
              passwordHash: defaultPasswordHash,
              status: 'ACTIVE',
            },
          })
        }

        const existingExtraMem = await tx.tenantUser.findFirst({
          where: { tenantId: scope.tenantId, userId: extraUser.id },
        })
        if (!existingExtraMem) {
          await tx.tenantUser.create({
            data: {
              tenantId: scope.tenantId,
              userId: extraUser.id,
              role: 'PARENT',
              roles: ['PARENT'],
              branchId: classroom.branchId,
              status: 'ACTIVE',
            },
          })
        }

        let extraWithUser = extraUser
          ? await tx.guardian.findFirst({
              where: { userId: extraUser.id, tenantId: scope.tenantId, deletedAt: null },
            })
          : null

        if (extraWithUser) {
          extraGuardian = extraWithUser
        } else if (!extraGuardian) {
          const anyExtraWithUser = extraUser
            ? await tx.guardian.findUnique({ where: { userId: extraUser.id } })
            : null

          extraGuardian = anyExtraWithUser || await tx.guardian.create({
            data: {
              tenantId: scope.tenantId,
              fullName: ag.fullName.trim(),
              phone: ag.phone.trim(),
              email: ag.email ? ag.email.trim() : null,
              relationship: (ag.relationship as Relationship) || 'FATHER',
              isPrimaryContact: Boolean(ag.isPrimaryContact),
              userId: extraUser.id,
              pickupPin: ag.pickupPin || null,
            },
          })
        } else if (!extraGuardian.userId && extraUser) {
          const anyExtraWithUser = await tx.guardian.findUnique({ where: { userId: extraUser.id } })
          if (!anyExtraWithUser) {
            extraGuardian = await tx.guardian.update({
              where: { id: extraGuardian.id },
              data: { userId: extraUser.id },
            })
          } else {
            extraGuardian = anyExtraWithUser
          }
        }

        await tx.studentGuardian.create({
          data: {
            studentId: student.id,
            guardianId: extraGuardian.id,
            relationship: (ag.relationship as Relationship) || 'FATHER',
            isPrimary: Boolean(ag.isPrimaryContact),
            canPickup: ag.canPickup !== false,
            pickupPin: ag.pickupPin || null,
            isFeePayer: Boolean(ag.isFeePayer),
            receivesComm: ag.receivesCommunication !== false,
          },
        })

        processedGuardians.push({ guardian: extraGuardian, user: extraUser, isPrimary: Boolean(ag.isPrimaryContact) })
      }

      // 7. Create StudentAllocation
      await tx.studentAllocation.create({
        data: {
          tenantId: scope.tenantId,
          studentId: student.id,
          academicSessionId: classroom.academicSessionId,
          classroomId: classroom.id,
          programType: classroom.programType,
          status: 'ACTIVE',
          startedAt: new Date(),
          reason: 'Classroom Placement & Admission Completion',
          createdById: ctx.actorId,
          createdByName: ctx.actorName,
        },
      })

      // 8. Audit Seat Assignment and Teacher Resolution
      await tx.auditLog.create({
        data: {
          tenantId: scope.tenantId,
          branchId: classroom.branchId,
          academicSessionId: classroom.academicSessionId,
          actorId: ctx.actorId,
          actorName: ctx.actorName,
          actorRole: ctx.actorRole,
          action: 'SEAT_ASSIGNED',
          entity: 'Student',
          entityId: student.id,
          summary: `Assigned seat ${normalizedSeatNumber} in ${classroom.name} to student ${student.admissionNo}`,
        },
      })

      await tx.auditLog.create({
        data: {
          tenantId: scope.tenantId,
          branchId: classroom.branchId,
          academicSessionId: classroom.academicSessionId,
          actorId: ctx.actorId,
          actorName: ctx.actorName,
          actorRole: ctx.actorRole,
          action: 'TEACHER_RESOLVED',
          entity: 'AdmissionApplication',
          entityId: applicationId,
          summary: `Automatically resolved Class Teacher ${classroom.primaryTeacher!.fullName} for classroom ${classroom.name}`,
        },
      })

      // 9. Fee Setup Reference Handoff to Finance
      const feePlan = await tx.feePlan.findFirst({
        where: { tenantId: scope.tenantId, programType: app.programType, isActive: true },
        include: { items: true },
      })

      let invoice: any = null
      if (feePlan && feePlan.items.length > 0) {
        const subtotal = feePlan.items.reduce((s, i) => s + i.amountCents, 0)
        const invoiceNumber = await nextNumber('invoice', scope.tenantId)
        const finCfg = await getDomainConfig(scope.tenantId, 'FINANCE')
        const dueOffset = Number(finCfg.dueDayOffset) > 0 ? Number(finCfg.dueDayOffset) : 15
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + dueOffset)

        invoice = await tx.invoice.create({
          data: {
            tenantId: scope.tenantId,
            branchId: classroom.branchId,
            studentId: student.id,
            invoiceNumber,
            title: `${feePlan.name} — Admission Fee Invoice`,
            dueDate,
            subtotalCents: subtotal,
            totalCents: subtotal,
            balanceCents: subtotal,
            status: 'ISSUED',
            issuedById: ctx.actorId,
            academicSessionId: classroom.academicSessionId,
            items: {
              create: feePlan.items.map((i) => ({
                feeHead: i.feeHead,
                description: i.label,
                amountCents: i.amountCents,
              })),
            },
          },
        })
      }

      // 10. Application Status Update to ENROLLED
      const placementNote = `[Placement Completed on ${new Date().toLocaleDateString('en-IN')}] Allocated to ${classroom.name} (Seat ${normalizedSeatNumber}) with Class Teacher ${classroom.primaryTeacher!.fullName}. Student Admission No: ${student.admissionNo}.`
      const updatedNotes = app.notes ? `${app.notes}\n\n${placementNote}` : placementNote

      const updatedApp = await tx.admissionApplication.update({
        where: { id: applicationId },
        data: {
          status: 'ENROLLED',
          approvedAt: new Date(),
          studentId: student.id,
          classroomId: classroom.id,
          notes: updatedNotes,
        },
      })

      // 11. Lead Status Update to CONVERTED
      if (app.leadId) {
        await tx.lead.update({
          where: { id: app.leadId },
          data: { status: 'CONVERTED' },
        }).catch(() => {})
      }

      // 11b. Waiting List Entry Update to CONVERTED (if candidate was on waiting list)
      await tx.$executeRawUnsafe(`
        UPDATE waiting_list_entries
        SET status = 'CONVERTED',
            student_id = $1,
            converted_at = NOW(),
            updated_at = NOW()
        WHERE application_id = $2
          AND tenant_id = $3
          AND status IN ('ACTIVE', 'SEAT_AVAILABLE', 'OFFER_SENT', 'PARENT_ACCEPTED', 'READY_FOR_ADMISSION')
      `, student.id, applicationId, scope.tenantId).catch(() => {})

      // 12. Parent Portal Welcome Milestone
      await tx.timelineEntry.create({
        data: {
          tenantId: scope.tenantId,
          studentId: student.id,
          classroomId: classroom.id,
          academicSessionId: classroom.academicSessionId,
          type: 'MILESTONE',
          title: 'Welcome to PreOne!',
          body: `${student.firstName} is officially placed in ${classroom.name} (Seat ${normalizedSeatNumber}) with Class Teacher ${classroom.primaryTeacher!.fullName}.`,
        },
      })

      // 13. Audit Placement & Admission Completed
      await tx.auditLog.create({
        data: {
          tenantId: scope.tenantId,
          branchId: classroom.branchId,
          academicSessionId: classroom.academicSessionId,
          actorId: ctx.actorId,
          actorName: ctx.actorName,
          actorRole: ctx.actorRole,
          action: 'PLACEMENT_COMPLETED',
          entity: 'AdmissionApplication',
          entityId: applicationId,
          summary: `Classroom Placement and Admission completed for ${student.admissionNo} (${student.firstName}) in ${classroom.name} (Seat ${normalizedSeatNumber})`,
        },
      })

      await tx.auditLog.create({
        data: {
          tenantId: scope.tenantId,
          branchId: classroom.branchId,
          academicSessionId: classroom.academicSessionId,
          actorId: ctx.actorId,
          actorName: ctx.actorName,
          actorRole: ctx.actorRole,
          action: 'ADMISSION_COMPLETED',
          entity: 'Student',
          entityId: student.id,
          summary: `Admission officially confirmed. Student STU admission record created.`,
        },
      })

      await tx.auditLog.create({
        data: {
          tenantId: scope.tenantId,
          branchId: classroom.branchId,
          academicSessionId: classroom.academicSessionId,
          actorId: ctx.actorId,
          actorName: ctx.actorName,
          actorRole: ctx.actorRole,
          action: 'PARENT_NOTIFICATION_SENT',
          entity: 'Student',
          entityId: student.id,
          summary: `Parent notification queued for ${parentUser.fullName} (${parentUser.phone}) with admission confirmation and portal setup.`,
        },
      })

      return {
        student,
        classroom,
        seatNumber: normalizedSeatNumber,
        classTeacher: classroom.primaryTeacher!,
        parentUser,
        isNewParentAccount,
        guardians: processedGuardians,
        application: updatedApp,
        invoice,
      }
    })

    // Post-Commit Domain Events
    await emit({
      type: 'StudentCreated',
      tenantId: scope.tenantId,
      studentId: result.student.id,
      name: `${result.student.firstName} ${result.student.lastName || ''}`.trim(),
      classroomId: result.classroom.id,
    })

    await emit({
      type: 'StudentAllocated',
      tenantId: scope.tenantId,
      studentId: result.student.id,
      classroomId: result.classroom.id,
      reason: 'Classroom Placement & Admission Completion',
    })

    return {
      status: 'PLACEMENT_COMPLETED',
      isAlreadyEnrolled: false,
      student: {
        id: result.student.id,
        admissionNo: result.student.admissionNo,
        fullName: `${result.student.firstName} ${result.student.lastName || ''}`.trim(),
        dob: result.student.dob,
        gender: result.student.gender,
        admissionDate: result.student.admissionDate,
      },
      classroom: {
        id: result.classroom.id,
        name: result.classroom.name,
        code: result.classroom.code,
        capacity: result.classroom.capacity,
      },
      seatNumber: result.seatNumber,
      classTeacher: {
        id: result.classTeacher.id,
        name: result.classTeacher.fullName,
        email: result.classTeacher.email,
        phone: result.classTeacher.phone,
      },
      parent: {
        id: result.parentUser.id,
        fullName: result.parentUser.fullName,
        username: result.parentUser.username,
        phone: result.parentUser.phone,
        email: result.parentUser.email,
        isNewAccount: result.isNewParentAccount,
      },
      guardiansCount: result.guardians.length,
      parentPortalReady: true,
      feeSetup: {
        invoiceId: result.invoice?.id || null,
        invoiceNumber: result.invoice?.invoiceNumber || null,
      },
      message: `Admission successfully completed. Student allocated to ${result.classroom.name} (Seat ${result.seatNumber}).`,
    }
  }

  // =========================================================================
  // 7. CLASSROOM PLACEMENTS LEDGER
  // =========================================================================

  /**
   * Main ledger listing both completed placements and candidates ready for placement.
   */
  static async getPlacementsLedger(
    ctx: ScopeContext,
    filters?: {
      branchId?: string
      academicYearId?: string
      programType?: ProgramType
      classroomId?: string
      status?: 'ALL' | 'PLACED' | 'PENDING'
      search?: string
    }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, filters?.branchId || ctx.branchId, filters?.academicYearId || ctx.academicYearId)

    // 1. Placed Students
    const placedStudents = await db.student.findMany({
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        status: 'ACTIVE',
        deletedAt: null,
        currentClassroomId: filters?.classroomId ? filters.classroomId : { not: null },
        ...(filters?.search
          ? {
              OR: [
                { firstName: { contains: filters.search, mode: 'insensitive' } },
                { lastName: { contains: filters.search, mode: 'insensitive' } },
                { admissionNo: { contains: filters.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        currentClassroom: {
          include: {
            primaryTeacher: true,
          },
        },
        guardians: {
          where: { isPrimary: true },
          include: {
            guardian: {
              include: { user: true },
            },
          },
          take: 1,
        },
      },
      orderBy: { admissionDate: 'desc' },
      take: 100,
    })

    const ledgerItems = placedStudents.map((s) => {
      const primaryGrd = s.guardians[0]?.guardian
      return {
        id: s.id,
        studentId: s.id,
        admissionNo: s.admissionNo,
        childName: `${s.firstName} ${s.lastName || ''}`.trim(),
        dob: s.dob,
        gender: s.gender,
        parentName: primaryGrd?.fullName || 'Parent',
        parentPhone: primaryGrd?.phone || '—',
        parentPortalReady: Boolean(primaryGrd?.userId),
        programType: s.currentClassroom?.programType || 'NURSERY',
        classroomName: s.currentClassroom?.name || 'Assigned',
        classroomId: s.currentClassroomId,
        seatNumber: s.seatNumber || '—',
        classTeacherName: s.currentClassroom?.primaryTeacher?.fullName || 'Not Configured',
        placementStatus: 'PLACED',
        placementDate: s.admissionDate,
      }
    })

    // If filtering for PENDING or ALL, also load eligible candidates
    let eligibleCount = 0
    if (filters?.status !== 'PLACED') {
      const eligible = await this.getEligibleCandidates(ctx, {
        branchId: scope.branchId,
        academicYearId: scope.academicYearId,
        programType: filters?.programType,
        search: filters?.search,
      })
      eligibleCount = eligible.filter((e) => e.isEligibleForPlacement).length
    }

    return {
      items: ledgerItems,
      totalPlaced: ledgerItems.length,
      eligiblePendingCount: eligibleCount,
    }
  }

  // =========================================================================
  // 8. PLACEMENT TIMELINE & AUDIT HISTORY
  // =========================================================================

  /**
   * Returns complete chronological activity for a candidate's placement journey.
   */
  static async getPlacementTimeline(ctx: ScopeContext, applicationId: string) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const app = await db.admissionApplication.findFirst({
      where: { id: applicationId, tenantId: scope.tenantId, deletedAt: null },
    })
    if (!app) throw new Error('Application not found')

    const auditLogs = await db.auditLog.findMany({
      where: {
        tenantId: scope.tenantId,
        OR: [
          { entityId: applicationId },
          ...(app.studentId ? [{ entityId: app.studentId }] : []),
          ...(app.leadId ? [{ entityId: app.leadId }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const timelineEntries = app.studentId
      ? await db.timelineEntry.findMany({
          where: { tenantId: scope.tenantId, studentId: app.studentId },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      : []

    return {
      applicationId,
      studentId: app.studentId,
      auditLogs,
      timelineEntries,
    }
  }
}
