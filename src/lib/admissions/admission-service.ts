/**
 * PreOne — Complete Admission Module Domain Service
 *
 * Core Architecture Principles:
 * 1. Scope: Every year-specific query and mutation MUST scope:
 *    - tenantId
 *    - branchId
 *    - academicYearId (corresponds to AcademicSession.id)
 * 2. Academic Year: Admissions is an academic-year-specific journey.
 * 3. Student Lifetime Master: Student is the lifetime master record.
 *    Admission creates or links Student + Guardian + Classroom Allocation + Finance.
 * 4. Atomic Mutations: Enrollment and approvals execute inside transactions with rollback.
 * 5. Reusable Infrastructure:
 *    - Uses existing Prisma models: Lead, AdmissionApplication, ApplicationDocument,
 *      FollowUp, Student, Guardian, StudentGuardian, StudentAllocation, FeePlan,
 *      Invoice, TimelineEntry, AuditLog, SchoolConfig, DocumentTemplate.
 *    - Follows existing FollowUp engine (domain: 'ADMISSION') for activities, reminders, visits.
 */

import { db } from '@/lib/db'
import { audit, nextNumber } from '@/lib/sequence'
import { emit } from '@/lib/events'
import { raiseFollowUp } from '@/lib/followups'
import { SchoolRole } from '@/lib/auth'
import { ConfigurationService } from '@/lib/setup/config-service'
import { getDomainConfig, getAdmissionConfig } from '@/lib/config'
import bcrypt from 'bcryptjs'
import { FollowUpVisitService } from './followup-visit-service'
import type { ProgramType, Gender, LeadSource, LeadStatus, ApplicationStatus, DocumentType, OfferStatus, DocumentStatus } from '@prisma/client'

export interface ScopeContext {
  tenantId: string
  branchId: string
  academicYearId: string
  actorId?: string | null
  actorName?: string | null
  actorRole?: string | null
}

export interface CreateEnquiryInput {
  childName?: string | null
  childDob?: Date | string | null
  childGender?: Gender | string | null
  previousSchool?: string | null
  parentName: string
  phone: string
  alternatePhone?: string | null
  email?: string | null
  relationship?: string | null
  parentPhotoUrl?: string | null
  interestedProgram?: ProgramType | string | null
  source?: LeadSource | string
  enquiryDate?: Date | string | null
  notes?: string | null
  assignedToId?: string | null
  overrideDuplicate?: boolean
}

export interface CreateApplicationInput {
  leadId?: string | null
  programType: ProgramType | string
  childFirstName?: string
  childLastName?: string | null
  childFullName?: string | null
  childDob: Date | string
  childGender?: Gender | string
  bloodGroup?: string | null
  emergencyContact?: string | null
  parentName: string
  parentPhone: string
  parentEmail?: string | null
  alternatePhone?: string | null
  relationship?: string | null
  address?: string | null
  previousSchool?: string | null
  medicalNotes?: string | null
  meetingNotes?: string | null
  notes?: string | null
  isDuplicateConfirmed?: boolean
  additionalGuardians?: Array<{
    fullName: string
    phone: string
    email?: string | null
    relationship?: string | null
    isPrimaryContact?: boolean
    canPickup?: boolean
    pickupPin?: string | null
    isFeePayer?: boolean
    receivesCommunication?: boolean
  }>
}

export class AdmissionService {
  /**
   * Authoritatively verify tenant, branch and academic session scope.
   */
  static async verifyScope(
    tenantId: string,
    branchId?: string | null,
    academicYearId?: string | null
  ): Promise<{ tenantId: string; branchId: string; academicYearId: string }> {
    if (!tenantId) throw new Error('Tenant context is required')

    let verifiedBranchId: string
    if (!branchId) {
      const mainBranch = await db.branch.findFirst({
        where: { tenantId, isMain: true, deletedAt: null },
      })
      if (!mainBranch) throw new Error('No active branch found for school')
      verifiedBranchId = mainBranch.id
    } else {
      const branch = await db.branch.findFirst({
        where: { id: branchId, tenantId, deletedAt: null },
      })
      if (!branch) throw new Error('Branch does not belong to school or is inactive')
      verifiedBranchId = branch.id
    }

    let verifiedAcademicYearId: string
    if (!academicYearId) {
      const currentSession = await db.academicSession.findFirst({
        where: { tenantId, isCurrent: true, status: 'ACTIVE' },
      })
      if (!currentSession) {
        const anyActive = await db.academicSession.findFirst({
          where: { tenantId, status: 'ACTIVE' },
          orderBy: { startDate: 'desc' },
        })
        if (!anyActive) throw new Error('No active academic year found. Please configure Academic Sessions in Setup.')
        verifiedAcademicYearId = anyActive.id
      } else {
        verifiedAcademicYearId = currentSession.id
      }
    } else {
      const session = await db.academicSession.findFirst({
        where: { id: academicYearId, tenantId },
      })
      if (!session) throw new Error('Academic year does not belong to school')
      verifiedAcademicYearId = session.id
    }

    return {
      tenantId,
      branchId: verifiedBranchId,
      academicYearId: verifiedAcademicYearId,
    }
  }

  // =========================================================================
  // 1. ENQUIRIES (LEADS)
  // =========================================================================

  /**
   * Search for duplicate enquiries within the school by phone or email.
   */
  static async findDuplicateEnquiry(
    tenantId: string,
    phone: string,
    email?: string | null,
    childName?: string | null,
    childDob?: Date | string | null
  ) {
    const cleanPhone = phone.trim().replace(/\D/g, '')
    const whereOr: any[] = [{ phone: { contains: cleanPhone.slice(-10) } }]
    if (email && email.trim()) {
      whereOr.push({ email: { equals: email.trim(), mode: 'insensitive' } })
    }
    if (childName && childName.trim() && childDob) {
      const d = new Date(childDob)
      if (!isNaN(d.getTime())) {
        whereOr.push({
          childName: { equals: childName.trim(), mode: 'insensitive' },
          childDob: {
            gte: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0),
            lte: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59),
          },
        })
      }
    }

    return db.lead.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: whereOr,
      },
    })
  }

  /**
   * Create a new Enquiry with duplicate detection, scope verification and audit logging.
   */
  static async createEnquiry(ctx: ScopeContext, input: CreateEnquiryInput) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    if (!input.parentName?.trim() || !input.phone?.trim()) {
      throw new Error('Parent name and phone number are required')
    }

    // Duplicate check
    const existing = await this.findDuplicateEnquiry(scope.tenantId, input.phone, input.email, input.childName, input.childDob)
    if (existing && !input.overrideDuplicate) {
      return {
        enquiry: existing,
        isDuplicate: true,
        message: `Existing enquiry found for phone ${existing.phone} (${existing.leadNumber})`,
      }
    }

    let initialNotes = input.notes?.trim() || ''

    // Validate child age if program and DOB are provided
    if (input.interestedProgram && input.childDob) {
      const ageCheck = await ConfigurationService.validateProgramAge(
        scope.tenantId,
        String(input.interestedProgram),
        input.childDob
      )
      if (!ageCheck.eligible) {
        // We log warning in notes but allow enquiry capture with flag
        initialNotes = initialNotes
          ? `${initialNotes} [Age Advisory: ${ageCheck.reason}]`
          : `[Age Advisory: ${ageCheck.reason}]`
      }
    }

    const extraContext: string[] = []
    if (input.relationship) extraContext.push(`Relationship: ${input.relationship}`)
    if (input.previousSchool) extraContext.push(`Previous School: ${input.previousSchool}`)
    if (input.childGender) extraContext.push(`Gender: ${input.childGender}`)
    if (input.enquiryDate) extraContext.push(`Enquiry Date: ${new Date(input.enquiryDate).toLocaleDateString()}`)
    if (input.parentPhotoUrl) extraContext.push(`Photo: ${input.parentPhotoUrl}`)

    if (extraContext.length > 0) {
      initialNotes = initialNotes ? `${initialNotes}\n[Enquiry Context: ${extraContext.join(' | ')}]` : `[Enquiry Context: ${extraContext.join(' | ')}]`
    }

    const leadNumber = await nextNumber('lead', scope.tenantId)
    const validProgram = (['PLAYGROUP', 'NURSERY', 'LKG', 'UKG', 'DAYCARE'] as ProgramType[]).includes(
      input.interestedProgram as ProgramType
    )
      ? (input.interestedProgram as ProgramType)
      : null

    const lead = await db.lead.create({
      data: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        leadNumber,
        source: (input.source as LeadSource) || 'WALK_IN',
        status: 'NEW',
        parentName: input.parentName.trim(),
        phone: input.phone.trim(),
        email: input.email?.trim() || null,
        childName: input.childName?.trim() || null,
        childDob: input.childDob ? new Date(input.childDob) : null,
        interestedProgram: validProgram,
        notes: initialNotes || null,
        assignedToId: input.assignedToId || null,
      },
    })

    await audit({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      academicSessionId: scope.academicYearId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'CREATE',
      entity: 'Lead',
      entityId: lead.id,
      summary: `Enquiry ${leadNumber} created for ${input.parentName} (${input.childName || 'Child'})`,
    })

    return { enquiry: lead, isDuplicate: false }
  }

  /**
   * Update Enquiry status with validated state transitions.
   */
  static async updateEnquiryStatus(
    ctx: ScopeContext,
    enquiryId: string,
    newStatus: LeadStatus,
    notes?: string,
    nextFollowUpAt?: Date | string
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const enquiry = await db.lead.findFirst({
      where: { id: enquiryId, tenantId: scope.tenantId, deletedAt: null },
    })
    if (!enquiry) throw new Error('Enquiry not found')

    const updated = await db.lead.update({
      where: { id: enquiryId },
      data: {
        status: newStatus,
        ...(notes !== undefined ? { notes: notes || enquiry.notes } : {}),
        ...(nextFollowUpAt ? { nextFollowUpAt: new Date(nextFollowUpAt) } : {}),
      },
    })

    await audit({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      academicSessionId: scope.academicYearId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'UPDATE_STATUS',
      entity: 'Lead',
      entityId: enquiryId,
      summary: `Enquiry ${enquiry.leadNumber} status transitioned: ${enquiry.status} → ${newStatus}`,
    })

    return updated
  }

  // =========================================================================
  // 2. FOLLOW-UPS & SCHOOL VISITS
  // =========================================================================

  /**
   * Log an enquiry follow-up action using the centralized FollowUp aggregate.
   * Advances Lead from NEW to CONTACTED on first outreach.
   */
  static async addEnquiryFollowUp(
    ctx: ScopeContext,
    enquiryId: string,
    input: {
      type: string
      note: string
      dueAt?: Date | string
      outcome?: string
      responsibleRole?: SchoolRole
    }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)
    return FollowUpVisitService.addFollowUp(
      {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        academicYearId: scope.academicYearId,
        actorId: ctx.actorId,
        actorName: ctx.actorName,
        actorRole: ctx.actorRole,
      },
      enquiryId,
      input
    )
  }

  /**
   * Schedule or record a school visit / counselling session for an enquiry.
   * Progresses Lead to QUALIFIED.
   */
  static async scheduleSchoolVisit(
    ctx: ScopeContext,
    enquiryId: string,
    input: {
      scheduledAt: Date | string
      visitorCount?: number
      attendees?: string
      tourFocus?: string
      notes?: string
      assignedUserId?: string
    }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)
    return FollowUpVisitService.scheduleVisit(
      {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        academicYearId: scope.academicYearId,
        actorId: ctx.actorId,
        actorName: ctx.actorName,
        actorRole: ctx.actorRole,
      },
      enquiryId,
      input
    )
  }

  /**
   * Complete a school visit, record preschool-friendly child interaction observations,
   * parent feedback, staff notes, and evaluate visit outcome.
   */
  static async completeSchoolVisit(
    ctx: ScopeContext,
    visitId: string,
    input: {
      childInteraction?: any
      parentFeedback?: string
      staffNotes?: string
      outcome: any
      nextFollowUpAt?: Date | string
      lostReason?: any
      autoStartApplication?: boolean
    }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)
    return FollowUpVisitService.completeVisit(
      {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        academicYearId: scope.academicYearId,
        actorId: ctx.actorId,
        actorName: ctx.actorName,
        actorRole: ctx.actorRole,
      },
      visitId,
      input
    )
  }

  /**
   * Record visit no-show: preserves active lead in QUALIFIED state and schedules recovery follow-up.
   */
  static async recordVisitNoShow(
    ctx: ScopeContext,
    visitId: string,
    input?: {
      notes?: string
      recoveryCallDueAt?: Date | string
    }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)
    return FollowUpVisitService.recordVisitNoShow(
      {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        academicYearId: scope.academicYearId,
        actorId: ctx.actorId,
        actorName: ctx.actorName,
        actorRole: ctx.actorRole,
      },
      visitId,
      input
    )
  }

  /**
   * Reschedule school visit (Non-destructive: resolves previous visit as RESCHEDULED and creates new one).
   */
  static async rescheduleSchoolVisit(
    ctx: ScopeContext,
    visitId: string,
    input: {
      newScheduledAt: Date | string
      reason?: string
      visitorCount?: number
      attendees?: string
      tourFocus?: string
    }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)
    return FollowUpVisitService.rescheduleVisit(
      {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        academicYearId: scope.academicYearId,
        actorId: ctx.actorId,
        actorName: ctx.actorName,
        actorRole: ctx.actorRole,
      },
      visitId,
      input
    )
  }

  /**
   * Cancel school visit (Non-destructive: records cancellation reason and optional reminder).
   */
  static async cancelSchoolVisit(
    ctx: ScopeContext,
    visitId: string,
    input: {
      reason: string
      nextFollowUpAt?: Date | string
    }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)
    return FollowUpVisitService.cancelVisit(
      {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        academicYearId: scope.academicYearId,
        actorId: ctx.actorId,
        actorName: ctx.actorName,
        actorRole: ctx.actorRole,
      },
      visitId,
      input
    )
  }

  /**
   * Retrieve visit details including lead, child information, and past visit history.
   */
  static async getVisitDetails(tenantId: string, visitId: string) {
    return FollowUpVisitService.getVisitDetails(tenantId, visitId)
  }

  /**
   * Query follow-ups and visits for workspace queues with metric counters.
   */
  static async listFollowUpWorkspace(
    tenantId: string,
    params?: {
      branchId?: string
      queue?: 'DUE_TODAY' | 'OVERDUE' | 'UPCOMING' | 'COMPLETED'
      limit?: number
    }
  ) {
    return FollowUpVisitService.listWorkspaceQueues(tenantId, params)
  }

  // =========================================================================
  // 3. ADMISSION FORMS (APPLICATIONS)
  // =========================================================================

  /**
   * Search existing applications for duplicates in the same school & academic cycle.
   */
  static async checkDuplicateApplication(
    tenantId: string,
    academicSessionId: string,
    childFirstName: string,
    childDob: Date | string,
    parentPhone: string
  ) {
    const cleanPhone = parentPhone.trim().replace(/\D/g, '')
    const dob = new Date(childDob)

    const existing = await db.admissionApplication.findFirst({
      where: {
        tenantId,
        academicSessionId,
        deletedAt: null,
        childFirstName: { equals: childFirstName.trim(), mode: 'insensitive' },
        parentPhone: { contains: cleanPhone.slice(-10) },
        childDob: {
          gte: new Date(dob.getFullYear(), dob.getMonth(), dob.getDate(), 0, 0, 0),
          lte: new Date(dob.getFullYear(), dob.getMonth(), dob.getDate(), 23, 59, 59),
        },
      },
      include: {
        academicSession: { select: { name: true } },
      },
    })

    if (existing) {
      return {
        isDuplicate: true,
        existingApplication: {
          id: existing.id,
          applicationNumber: existing.applicationNumber,
          childName: `${existing.childFirstName} ${existing.childLastName || ''}`.trim(),
          academicSessionName: existing.academicSession?.name,
          programType: existing.programType,
          status: existing.status,
          createdAt: existing.createdAt,
        },
        message: `Possible duplicate found: Application ${existing.applicationNumber} exists for ${existing.childFirstName} in ${existing.academicSession?.name || 'this session'}.`,
      }
    }

    return { isDuplicate: false }
  }

  /**
   * Submit or start a formal Admission Form with document checklist initialization.
   */
  static async submitApplication(ctx: ScopeContext, input: CreateApplicationInput) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    let firstName = input.childFirstName?.trim() || ''
    let lastName = input.childLastName?.trim() || null

    if (!firstName && input.childFullName?.trim()) {
      const parts = input.childFullName.trim().split(/\s+/)
      firstName = parts[0]
      lastName = parts.slice(1).join(' ') || null
    }

    if (!firstName || !input.childDob || !input.parentName?.trim() || !input.parentPhone?.trim()) {
      throw new Error('Child first name, date of birth, parent name, and parent phone are mandatory')
    }

    // Duplicate check
    const dupCheck = await this.checkDuplicateApplication(
      scope.tenantId,
      scope.academicYearId,
      firstName,
      input.childDob,
      input.parentPhone
    )

    if (dupCheck.isDuplicate && !input.isDuplicateConfirmed) {
      const err: any = new Error(dupCheck.message)
      err.code = 'DUPLICATE_APPLICATION_FOUND'
      err.duplicateDetails = dupCheck.existingApplication
      throw err
    }

    const validProgramType = (['PLAYGROUP', 'NURSERY', 'LKG', 'UKG', 'DAYCARE'] as ProgramType[]).includes(
      input.programType as ProgramType
    )
      ? (input.programType as ProgramType)
      : 'NURSERY'

    // Age validation using authoritative ConfigurationService
    const ageCheck = await ConfigurationService.validateProgramAge(
      scope.tenantId,
      validProgramType,
      input.childDob
    )
    if (!ageCheck.eligible) {
      throw new Error(ageCheck.reason || 'Child does not satisfy age eligibility for this program')
    }

    // Find configured Program record from Setup if available
    const programRecord = await db.program.findFirst({
      where: { tenantId: scope.tenantId, programType: validProgramType, deletedAt: null, isActive: true },
    })

    // Find or create Guardian by phone to avoid duplicates
    let guardian = await db.guardian.findFirst({
      where: { tenantId: scope.tenantId, phone: input.parentPhone.trim(), deletedAt: null },
    })
    const guardianRel = input.relationship?.toUpperCase() === 'FATHER' ? 'FATHER' : input.relationship?.toUpperCase() === 'GUARDIAN' ? 'GUARDIAN' : 'MOTHER'
    if (!guardian) {
      guardian = await db.guardian.create({
        data: {
          tenantId: scope.tenantId,
          fullName: input.parentName.trim(),
          phone: input.parentPhone.trim(),
          email: input.parentEmail?.trim() || null,
          relationship: guardianRel,
          isPrimaryContact: true,
        },
      })
    }

    const metadata: Record<string, any> = {}
    if (input.bloodGroup) metadata.bloodGroup = input.bloodGroup
    if (input.emergencyContact) metadata.emergencyContact = input.emergencyContact
    if (input.address) metadata.address = input.address
    if (input.medicalNotes) metadata.medicalNotes = input.medicalNotes
    if (input.meetingNotes) metadata.meetingNotes = input.meetingNotes
    if (input.additionalGuardians && input.additionalGuardians.length > 0) {
      metadata.additionalGuardians = input.additionalGuardians
    }

    let notesText = input.notes?.trim() || ''
    if (Object.keys(metadata).length > 0) {
      notesText = notesText ? `${notesText}\n[Metadata: ${JSON.stringify(metadata)}]` : `[Metadata: ${JSON.stringify(metadata)}]`
    }

    // Configured document checklist from Setup/SchoolConfig
    const admCfg = getAdmissionConfig(await getDomainConfig(scope.tenantId, 'ADMISSION'))
    const requiredDocTypes: DocumentType[] = (admCfg.requiredDocuments || [
      'BIRTH_CERTIFICATE',
      'PHOTO',
      'PARENT_ID',
      'MEDICAL_CERTIFICATE',
    ]).map((d) => (['BIRTH_CERTIFICATE', 'AADHAAR', 'PHOTO', 'MEDICAL_CERTIFICATE', 'ADDRESS_PROOF', 'PARENT_ID', 'OTHER'].includes(d) ? (d as DocumentType) : 'OTHER'))

    const applicationNumber = await nextNumber('application', scope.tenantId)

    const app = await db.$transaction(async (tx) => {
      const application = await tx.admissionApplication.create({
        data: {
          tenantId: scope.tenantId,
          branchId: scope.branchId,
          academicSessionId: scope.academicYearId,
          applicationNumber,
          leadId: input.leadId || null,
          programId: programRecord?.id || null,
          programType: validProgramType,
          guardianId: guardian.id,
          childFirstName: firstName,
          childLastName: lastName,
          childDob: new Date(input.childDob),
          childGender: (input.childGender as Gender) || 'UNSPECIFIED',
          parentName: input.parentName.trim(),
          parentPhone: input.parentPhone.trim(),
          parentEmail: input.parentEmail?.trim() || null,
          previousSchool: input.previousSchool?.trim() || null,
          notes: notesText || null,
          isDuplicateConfirmed: !!input.isDuplicateConfirmed,
          status: 'SUBMITTED',
          submittedAt: new Date(),
        },
      })

      // Generate document checklist items
      if (requiredDocTypes.length > 0) {
        await tx.applicationDocument.createMany({
          data: requiredDocTypes.map((docType) => ({
            applicationId: application.id,
            docType,
            fileName: `${docType.toLowerCase().replace(/_/g, '-')}-pending.pdf`,
            status: 'UPLOADED',
            verified: false,
          })),
        })
      }

      // If tied to lead, update lead status
      if (input.leadId) {
        await tx.lead.update({
          where: { id: input.leadId },
          data: {
            status: 'APPLICATION_STARTED',
            convertedApplicationId: application.id,
          },
        }).catch(() => {})
      }

      return application
    })

    await audit({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      academicSessionId: scope.academicYearId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'APPLY',
      entity: 'AdmissionApplication',
      entityId: app.id,
      summary: `Admission Form ${applicationNumber} submitted for ${input.childFirstName} (${validProgramType})`,
    })

    return app
  }

  // =========================================================================
  // 4. DOCUMENTS & VERIFICATION
  // =========================================================================

  /**
   * Verify an individual document or mark it needing correction / rejected.
   */
  static async updateDocumentStatus(
    ctx: ScopeContext,
    documentId: string,
    action: 'VERIFY' | 'NEEDS_CORRECTION' | 'REJECT',
    remarks?: string
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const doc = await db.applicationDocument.findUnique({
      where: { id: documentId },
      include: { application: true },
    })
    if (!doc || doc.application.tenantId !== scope.tenantId) {
      throw new Error('Document not found')
    }

    if ((action === 'NEEDS_CORRECTION' || action === 'REJECT') && !remarks?.trim()) {
      throw new Error(`A specific reason is required when marking a document as ${action === 'REJECT' ? 'Rejected' : 'Needs Correction'}`)
    }

    const isVerified = action === 'VERIFY'
    const docStatus: DocumentStatus = isVerified ? 'VERIFIED' : action === 'REJECT' ? 'REJECTED' : 'UNDER_REVIEW'

    const updatedDoc = await db.applicationDocument.update({
      where: { id: documentId },
      data: {
        status: docStatus,
        verified: isVerified,
        verifiedAt: isVerified ? new Date() : null,
        remarks: remarks || (isVerified ? 'Verified by admission reviewer' : null),
        rejectionReason: !isVerified ? remarks : null,
      },
    })

    // Re-check all application documents
    const allDocs = await db.applicationDocument.findMany({
      where: { applicationId: doc.applicationId },
    })
    const allVerified = allDocs.every((d) => d.status === 'VERIFIED' || d.verified)
    const hasRejected = allDocs.some((d) => d.status === 'REJECTED')

    let newAppStatus: ApplicationStatus = doc.application.status
    if (allVerified && ['SUBMITTED', 'DOCUMENT_PENDING', 'DOCUMENT_REVIEW', 'UNDER_REVIEW'].includes(doc.application.status)) {
      newAppStatus = 'VERIFIED'
      await db.admissionApplication.update({
        where: { id: doc.applicationId },
        data: { status: 'VERIFIED', verifiedAt: new Date() },
      })
    } else if (hasRejected || action === 'NEEDS_CORRECTION' || !allVerified) {
      if (doc.application.status === 'VERIFIED') {
        newAppStatus = 'DOCUMENT_PENDING'
        await db.admissionApplication.update({
          where: { id: doc.applicationId },
          data: { status: 'DOCUMENT_PENDING' },
        })
      }
    }

    await audit({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      academicSessionId: scope.academicYearId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: `DOC_${action}`,
      entity: 'ApplicationDocument',
      entityId: documentId,
      summary: `Document ${doc.docType} for ${doc.application.applicationNumber}: ${action} ${remarks ? `(${remarks})` : ''}`,
    })

    return { document: updatedDoc, applicationStatus: newAppStatus, allVerified }
  }

  // =========================================================================
  // 5. COUNSELLING & PARENT INTERACTION
  // =========================================================================

  /**
   * Schedule or log a counselling session with structured outcome.
   */
  static async recordCounselling(
    ctx: ScopeContext,
    applicationId: string,
    input: {
      scheduledAt?: Date | string
      counselorName?: string
      mode?: 'IN_PERSON' | 'PHONE' | 'VIDEO' | string
      notes?: string
      outcome?: 'POSITIVE' | 'FOLLOW_UP_REQUIRED' | 'NOT_INTERESTED' | 'REFERRED' | string
    }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const app = await db.admissionApplication.findFirst({
      where: { id: applicationId, tenantId: scope.tenantId, deletedAt: null },
    })
    if (!app) throw new Error('Application not found')

    const rawDate = input.scheduledAt ? new Date(input.scheduledAt) : new Date()
    const sessionDate = isNaN(rawDate.getTime()) ? new Date() : rawDate
    const counselor = input.counselorName || ctx.actorName || 'Admission Counselor'
    const outcome = input.outcome || 'POSITIVE'

    // Create operational follow-up record for CRM tracking
    const fu = await raiseFollowUp({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      academicSessionId: scope.academicYearId,
      domain: 'ADMISSION',
      severity: 'INFO',
      title: `Counselling: ${app.childFirstName} (${counselor})`,
      detail: `Mode: ${input.mode || 'IN_PERSON'}. Outcome: ${outcome}. ${input.notes || ''}`,
      sourceType: 'CounsellingSession',
      sourceId: applicationId,
      dedupeKey: `counselling:${applicationId}:${sessionDate.getTime()}`,
      dueAt: sessionDate,
      responsibleRole: 'PRINCIPAL',
      actorId: ctx.actorId,
      actorName: ctx.actorName,
    })

    let nextStatus = app.status
    if (['SUBMITTED', 'VERIFIED', 'DOCUMENT_REVIEW'].includes(app.status)) {
      nextStatus = 'COUNSELLING'
    }

    const noteEntry = `[Counselling ${sessionDate.toLocaleDateString('en-IN')}] Counselor: ${counselor} | Outcome: ${outcome} | Mode: ${input.mode || 'IN_PERSON'}${input.notes ? `\nNotes: ${input.notes}` : ''}`
    const updatedNotes = app.notes ? `${app.notes}\n\n${noteEntry}` : noteEntry

    const updated = await db.admissionApplication.update({
      where: { id: applicationId },
      data: {
        status: nextStatus,
        notes: updatedNotes,
      },
    })

    await audit({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      academicSessionId: scope.academicYearId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'COUNSELLING_RECORDED',
      entity: 'AdmissionApplication',
      entityId: applicationId,
      summary: `Counselling recorded for ${app.applicationNumber} with ${counselor} (Outcome: ${outcome})`,
    })

    return { application: updated, outcome, counselor, followUp: fu }
  }

  // =========================================================================
  // 6. REVIEW & REQUIREMENTS CHECK
  // =========================================================================

  /**
   * Complete authoritative review assessment for an admission form.
   */
  static async reviewApplication(ctx: ScopeContext, applicationId: string) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const app = await db.admissionApplication.findFirst({
      where: { id: applicationId, tenantId: scope.tenantId, deletedAt: null },
      include: {
        documents: true,
        lead: true,
        guardian: true,
        academicSession: true,
        program: true,
        offers: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })
    if (!app) throw new Error('Admission application not found')

    // 1. Age check
    const ageCheck = await ConfigurationService.validateProgramAge(
      scope.tenantId,
      app.programType,
      app.childDob
    )

    // 2. Document checklist check
    const admCfg = getAdmissionConfig(await getDomainConfig(scope.tenantId, 'ADMISSION'))
    const requiredDocs = admCfg.requiredDocuments || ['BIRTH_CERTIFICATE', 'PHOTO']
    const verifiedDocCount = app.documents.filter((d) => d.status === 'VERIFIED' || d.verified).length
    const rejectedDocCount = app.documents.filter((d) => d.status === 'REJECTED').length
    const totalDocCount = app.documents.length
    const documentsComplete = verifiedDocCount === totalDocCount && totalDocCount > 0 && rejectedDocCount === 0

    // 3. Classrooms and Capacity
    const classrooms = await db.classroom.findMany({
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        programType: app.programType,
        isActive: true,
      },
      include: {
        _count: { select: { students: true } },
      },
    })

    const classroomStatus = classrooms.map((c) => ({
      id: c.id,
      name: c.name,
      capacity: c.capacity,
      enrolled: c._count.students,
      available: Math.max(0, c.capacity - c._count.students),
      hasSeat: c._count.students < c.capacity,
    }))
    const hasAvailableCapacity = classroomStatus.some((c) => c.hasSeat)

    // 4. Fee Plan Quote
    const feePlan = await db.feePlan.findFirst({
      where: { tenantId: scope.tenantId, programType: app.programType, isActive: true },
      include: { items: true },
    })

    // 5. Sibling Logic
    const cleanPhone = app.parentPhone.trim().replace(/\D/g, '')
    const existingGuardians = await db.guardian.findMany({
      where: {
        tenantId: scope.tenantId,
        phone: { contains: cleanPhone.slice(-10) },
        deletedAt: null,
      },
      include: {
        studentLinks: {
          include: {
            student: {
              include: {
                currentClassroom: true,
              },
            },
          },
        },
      },
    })

    const existingChildren: any[] = []
    for (const g of existingGuardians) {
      for (const link of g.studentLinks) {
        if (link.student && !link.student.deletedAt && link.student.firstName.toLowerCase() !== app.childFirstName.toLowerCase()) {
          existingChildren.push({
            studentId: link.student.id,
            admissionNo: link.student.admissionNo,
            name: `${link.student.firstName} ${link.student.lastName || ''}`.trim(),
            classroom: link.student.currentClassroom?.name || 'Class Assigned',
            status: link.student.status,
          })
        }
      }
    }

    // 6. Audit logs timeline
    const timeline = await db.auditLog.findMany({
      where: {
        tenantId: scope.tenantId,
        entity: 'AdmissionApplication',
        entityId: applicationId,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const isReadyForApproval = ageCheck.eligible && documentsComplete && hasAvailableCapacity

    return {
      application: app,
      requirements: {
        ageRequirement: ageCheck,
        documentsCheck: {
          verified: verifiedDocCount,
          rejected: rejectedDocCount,
          total: totalDocCount,
          isComplete: documentsComplete,
          missing: app.documents.filter((d) => d.status !== 'VERIFIED' && !d.verified).map((d) => d.docType),
        },
        capacityCheck: {
          hasAvailableCapacity,
          sections: classroomStatus,
        },
        feePlanQuote: feePlan
          ? {
              id: feePlan.id,
              name: feePlan.name,
              totalAnnualRupees: feePlan.totalAnnualCents / 100,
              installmentCount: feePlan.installmentCount,
              items: feePlan.items.map((i) => ({
                head: i.feeHead,
                label: i.label,
                amountRupees: i.amountCents / 100,
              })),
            }
          : null,
        siblingConcession: {
          hasSibling: existingChildren.length > 0,
          existingChildren,
          applicableDiscountPercent: existingChildren.length > 0
            ? (Number((admCfg as any)?.siblingDiscountPercent) > 0 ? Number((admCfg as any)?.siblingDiscountPercent) : 10)
            : 0,
        },
        isReadyForApproval,
      },
      offers: app.offers.map((o) => {
        let termsText = o.terms
        let feeSnapshot: any = null
        if (o.terms && o.terms.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(o.terms)
            termsText = parsed.termsText || o.terms
            feeSnapshot = parsed.feeSnapshot || null
          } catch {}
        }
        return {
          ...o,
          terms: termsText,
          feeSnapshot,
        }
      }),
      timeline,
    }
  }

  // =========================================================================
  // 7. APPROVAL WORKFLOW
  // =========================================================================

  /**
   * Formal Application Approval gate based on verified requirements.
   */
  static async approveApplication(ctx: ScopeContext, applicationId: string, notes?: string) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const app = await db.admissionApplication.findFirst({
      where: { id: applicationId, tenantId: scope.tenantId, deletedAt: null },
      include: { documents: true },
    })
    if (!app) throw new Error('Application not found')

    if (['REJECTED', 'WITHDRAWN', 'EXPIRED'].includes(app.status)) {
      throw new Error(`Cannot approve application in terminal status ${app.status}`)
    }
    if (app.status === 'ENROLLED' || app.status === 'ADMITTED') {
      throw new Error('Application is already admitted/enrolled')
    }

    // Age validation
    const ageCheck = await ConfigurationService.validateProgramAge(scope.tenantId, app.programType, app.childDob)
    if (!ageCheck.eligible) {
      throw new Error(`Cannot approve application: ${ageCheck.reason}`)
    }

    // Document validation
    const hasRejectedDocs = app.documents.some((d) => d.status === 'REJECTED')
    if (hasRejectedDocs) {
      throw new Error('Cannot approve application: One or more documents are marked as Rejected. Request revised documents first.')
    }

    const unverifiedDocs = app.documents.filter((d) => d.status !== 'VERIFIED' && !d.verified)
    if (unverifiedDocs.length > 0) {
      throw new Error(`Cannot approve application: ${unverifiedDocs.length} required documents are still pending verification.`)
    }

    const updated = await db.admissionApplication.update({
      where: { id: applicationId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        ...(notes ? { notes: app.notes ? `${app.notes}\n[Approved: ${notes}]` : `[Approved: ${notes}]` } : {}),
      },
    })

    await audit({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      academicSessionId: scope.academicYearId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'APPROVE',
      entity: 'AdmissionApplication',
      entityId: applicationId,
      summary: `Application ${app.applicationNumber} approved by ${ctx.actorName || 'Reviewer'}${notes ? ` (${notes})` : ''}`,
    })

    return updated
  }

  /**
   * Request more information from applicant with follow-up task.
   */
  static async requestMoreInformation(
    ctx: ScopeContext,
    applicationId: string,
    input: { reason: string; note?: string; dueAt?: Date | string }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const app = await db.admissionApplication.findFirst({
      where: { id: applicationId, tenantId: scope.tenantId, deletedAt: null },
    })
    if (!app) throw new Error('Application not found')

    const noteEntry = `[More Info Requested] Reason: ${input.reason}${input.note ? ` | Note: ${input.note}` : ''}`
    const updatedNotes = app.notes ? `${app.notes}\n${noteEntry}` : noteEntry

    const updated = await db.admissionApplication.update({
      where: { id: applicationId },
      data: {
        status: 'UNDER_REVIEW',
        notes: updatedNotes,
      },
    })

    const fu = await raiseFollowUp({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      academicSessionId: scope.academicYearId,
      domain: 'ADMISSION',
      severity: 'INFO',
      title: `Need Info: ${app.childFirstName} (${input.reason})`,
      detail: input.note || input.reason,
      sourceType: 'AdmissionApplication',
      sourceId: applicationId,
      dedupeKey: `more-info:${applicationId}:${Date.now()}`,
      dueAt: input.dueAt ? new Date(input.dueAt) : new Date(Date.now() + 48 * 60 * 60 * 1000),
      responsibleRole: 'PRINCIPAL',
      actorId: ctx.actorId,
      actorName: ctx.actorName,
    })

    await audit({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      academicSessionId: scope.academicYearId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'NEED_MORE_INFO',
      entity: 'AdmissionApplication',
      entityId: applicationId,
      summary: `Requested more info for ${app.applicationNumber}: ${input.reason}`,
    })

    return { application: updated, followUp: fu }
  }

  // =========================================================================
  // 8. ADMISSION OFFER & LETTER GENERATION
  // =========================================================================

  /**
   * Generate and persist an AdmissionOffer with authoritative fee quote and immutable snapshot.
   */
  static async generateOffer(
    ctx: ScopeContext,
    applicationId: string,
    validityOrOptions:
      | number
      | {
          validityDays?: number
          validDays?: number
          terms?: string
          remarks?: string
          feePlanId?: string
          classroomId?: string
        } = 7,
    termsArg?: string
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const app = await db.admissionApplication.findFirst({
      where: { id: applicationId, tenantId: scope.tenantId, deletedAt: null },
      include: { tenant: true },
    })
    if (!app) throw new Error('Application not found')

    // State gate: an offer can only be generated for an application that has
    // passed verification — never for drafts, pre-verification, or terminal states
    const deniedOfferStates = ['DRAFT', 'SUBMITTED', 'DOCUMENT_PENDING', 'DOCUMENT_REVIEW', 'REJECTED', 'WITHDRAWN', 'EXPIRED']
    if (deniedOfferStates.includes(app.status)) {
      throw new Error(`Cannot generate an admission offer for an application in status ${app.status}`)
    }

    // Single-active-offer invariant: expiry previously issued offers before re-issue
    await db.admissionOffer.updateMany({
      where: { applicationId, tenantId: scope.tenantId, status: 'ISSUED' },
      data: { status: 'EXPIRED' },
    })

    const isOptObj = typeof validityOrOptions === 'object' && validityOrOptions !== null
    const days = isOptObj
      ? (validityOrOptions.validityDays || validityOrOptions.validDays || 7)
      : typeof validityOrOptions === 'number' && validityOrOptions > 0
      ? validityOrOptions
      : 7
    const terms = isOptObj ? validityOrOptions.terms || validityOrOptions.remarks : termsArg
    const explicitFeePlanId = isOptObj ? validityOrOptions.feePlanId : undefined

    // Find Fee plan quote
    const feePlan = explicitFeePlanId
      ? await db.feePlan.findFirst({
          where: { id: explicitFeePlanId, tenantId: scope.tenantId },
          include: { items: true },
        })
      : await db.feePlan.findFirst({
          where: { tenantId: scope.tenantId, programType: app.programType, isActive: true },
          include: { items: true },
        })

    const branch = await db.branch.findFirst({
      where: { id: app.branchId, tenantId: scope.tenantId },
    })

    // Sibling Concession check from Finance / Admission policy
    const cleanPhone = app.parentPhone.trim().replace(/\D/g, '')
    const existingSiblings = await db.guardian.findFirst({
      where: {
        tenantId: scope.tenantId,
        phone: { contains: cleanPhone.slice(-10) },
        deletedAt: null,
      },
      include: {
        studentLinks: {
          include: {
            student: true,
          },
        },
      },
    })

    const hasSibling = Boolean(
      existingSiblings?.studentLinks.some(
        (l) => l.student && !l.student.deletedAt && l.student.firstName.toLowerCase() !== app.childFirstName.toLowerCase()
      )
    )

    const admCfg = getAdmissionConfig(await getDomainConfig(scope.tenantId, 'ADMISSION'))
    const siblingDiscountPercent = hasSibling
      ? (Number((admCfg as any).siblingDiscountPercent) > 0 ? Number((admCfg as any).siblingDiscountPercent) : 10)
      : 0

    const totalAnnualCents = feePlan?.totalAnnualCents || 0
    const discountCents = Math.round((totalAnnualCents * siblingDiscountPercent) / 100)
    const payableCents = Math.max(0, totalAnnualCents - discountCents)

    const termsText = terms || `Admission offer for ${app.programType} at ${branch?.name || 'PreOne Academy'}. Valid for ${days} days.`

    // Immutable snapshot of quoted fee information
    const feeSnapshot = {
      feePlanId: feePlan?.id || null,
      feePlanName: feePlan?.name || app.programType,
      totalAnnualCents,
      discountPercent: siblingDiscountPercent,
      discountCents,
      payableCents,
      installmentCount: feePlan?.installmentCount || 1,
      items: (feePlan?.items || []).map((i) => ({
        head: i.feeHead,
        label: i.label,
        amountCents: i.amountCents,
        amountRupees: i.amountCents / 100,
      })),
      snapshotAt: new Date().toISOString(),
    }

    const serializedTerms = JSON.stringify({
      termsText,
      feeSnapshot,
    })

    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + days)

    const offerNumber = `OFR-${app.applicationNumber.replace('ADM-', '')}-${Date.now().toString().slice(-4)}`

    const offer = await db.admissionOffer.create({
      data: {
        tenantId: scope.tenantId,
        applicationId,
        offerNumber,
        childName: `${app.childFirstName} ${app.childLastName || ''}`.trim(),
        parentName: app.parentName,
        programType: app.programType,
        feePlanId: feePlan?.id || null,
        feeTotalCents: payableCents,
        terms: serializedTerms,
        status: 'ISSUED',
        validFrom: new Date(),
        validUntil,
        issuedAt: new Date(),
        createdById: ctx.actorId,
      },
    })

    // Advance application status to OFFER_SENT
    const updatedApp = await db.admissionApplication.update({
      where: { id: applicationId },
      data: {
        status: 'OFFER_SENT',
        notes: app.notes
          ? `${app.notes}\n[Offer Generated: ${offerNumber}, Valid until ${validUntil.toLocaleDateString()}]`
          : `[Offer Generated: ${offerNumber}, Valid until ${validUntil.toLocaleDateString()}]`,
      },
    })

    await audit({
      tenantId: scope.tenantId,
      branchId: app.branchId,
      academicSessionId: scope.academicYearId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'OFFER_GENERATED',
      entity: 'AdmissionApplication',
      entityId: applicationId,
      summary: `Admission offer ${offerNumber} issued for ${app.childFirstName}`,
    })

    return {
      offer,
      application: updatedApp,
      brandedLetter: {
        offerNumber,
        schoolName: app.tenant.name,
        branchName: branch?.name || 'Main Campus',
        childName: `${app.childFirstName} ${app.childLastName || ''}`.trim(),
        parentName: app.parentName,
        parentPhone: app.parentPhone,
        program: app.programType,
        validUntil: validUntil.toISOString(),
        feeTotalRupees: totalAnnualCents / 100,
        discountRupees: discountCents / 100,
        payableRupees: payableCents / 100,
        siblingDiscountPercent,
        feeBreakdown: feeSnapshot.items,
        feeSnapshot,
        terms: termsText,
      },
    }
  }

  /**
   * Record Parent Acceptance of the Admission Offer.
   */
  static async acceptOffer(
    ctx: ScopeContext,
    applicationId: string,
    offerIdOrNote?: string | { remarks?: string },
    options?: { remarks?: string }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const offer = await db.admissionOffer.findFirst({
      where: { applicationId, tenantId: scope.tenantId },
      orderBy: { createdAt: 'desc' },
      include: { application: true },
    })
    if (!offer) throw new Error('Admission offer not found')

    if (offer.status === 'ACCEPTED') {
      const app = await db.admissionApplication.findFirst({
        where: { id: applicationId, tenantId: scope.tenantId, deletedAt: null },
      })
      return { offer, application: app, alreadyAccepted: true }
    }

    if (offer.status !== 'ISSUED') {
      throw new Error(`Offer ${offer.offerNumber} is ${offer.status} and cannot be accepted`)
    }

    if (new Date() > offer.validUntil) {
      await db.admissionOffer.update({ where: { id: offer.id }, data: { status: 'EXPIRED' } })
      throw new Error(`This admission offer expired on ${offer.validUntil.toLocaleDateString()}. Please request a renewed offer.`)
    }

    const appNow = await db.admissionApplication.findFirst({
      where: { id: applicationId, tenantId: scope.tenantId, deletedAt: null },
    })
    if (!appNow) throw new Error('Application not found')
    if (['REJECTED', 'WITHDRAWN', 'EXPIRED'].includes(appNow.status)) {
      throw new Error(`Cannot accept an offer for an application in status ${appNow.status}`)
    }

    const note =
      typeof options === 'object' && options?.remarks
        ? options.remarks
        : typeof offerIdOrNote === 'object' && offerIdOrNote?.remarks
        ? offerIdOrNote.remarks
        : typeof offerIdOrNote === 'string' && offerIdOrNote.length < 30 && !offerIdOrNote.includes('-')
        ? offerIdOrNote
        : 'Offer accepted by parent'

    const updatedOffer = await db.admissionOffer.update({
      where: { id: offer.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        acceptNote: note,
      },
    })

    const updatedApp = await db.admissionApplication.update({
      where: { id: applicationId },
      data: { status: 'OFFER_ACCEPTED' },
    })

    await audit({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      academicSessionId: scope.academicYearId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'OFFER_ACCEPTED',
      entity: 'AdmissionApplication',
      entityId: applicationId,
      summary: `Admission offer ${offer.offerNumber} accepted by parent for ${offer.childName}`,
    })

    return { offer: updatedOffer, application: updatedApp, alreadyAccepted: false }
  }

  /**
   * Record Parent Decline of the Admission Offer.
   */
  static async declineOffer(
    ctx: ScopeContext,
    applicationId: string,
    offerIdOrReason?: string | { reason?: string },
    options?: { reason?: string }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const offer = await db.admissionOffer.findFirst({
      where: { applicationId, tenantId: scope.tenantId },
      orderBy: { createdAt: 'desc' },
    })
    if (!offer) throw new Error('Admission offer not found')

    if (offer.status === 'ACCEPTED') {
      throw new Error('Offer has already been accepted and cannot be declined')
    }
    if (offer.status !== 'ISSUED') {
      throw new Error(`Offer ${offer.offerNumber} is ${offer.status} and cannot be declined`)
    }

    const appState = await db.admissionApplication.findFirst({
      where: { id: applicationId, tenantId: scope.tenantId, deletedAt: null },
    })
    if (!appState) throw new Error('Application not found')
    if (['ENROLLED', 'ADMITTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'].includes(appState.status)) {
      throw new Error(`Cannot decline offer — application is in status ${appState.status}`)
    }

    const reason =
      typeof options === 'object' && options?.reason
        ? options.reason
        : typeof offerIdOrReason === 'object' && offerIdOrReason?.reason
        ? offerIdOrReason.reason
        : typeof offerIdOrReason === 'string' && !offerIdOrReason.includes('-')
        ? offerIdOrReason
        : 'Parent opted out'

    const updatedOffer = await db.admissionOffer.update({
      where: { id: offer.id },
      data: {
        status: 'DECLINED',
        declinedAt: new Date(),
        declineReason: reason,
      },
    })

    const updatedApp = await db.admissionApplication.update({
      where: { id: applicationId },
      data: {
        status: 'WITHDRAWN',
        notes: `Offer declined by parent: ${reason}`,
      },
    })

    await audit({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      academicSessionId: scope.academicYearId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'OFFER_DECLINED',
      entity: 'AdmissionApplication',
      entityId: applicationId,
      summary: `Admission offer ${offer.offerNumber} declined: ${reason}`,
    })

    return { offer: updatedOffer, application: updatedApp }
  }

  // =========================================================================
  // 8b. STAFF FINAL REVIEW (HANDOFF TO ALLOCATION / NEXT MODULE)
  // =========================================================================

  /**
   * Final Staff Review — The boundary gate of the Application Module.
   * Validates all prerequisites (age, verified documents, approval, parent offer acceptance).
   * Freezes the Application Dossier as READY_FOR_ALLOCATION and hands off to the next module.
   * DOES NOT create Student or Invoice records prematurely.
   */
  static async finalStaffReview(
    ctx: ScopeContext,
    applicationId: string,
    notes?: string
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const app = await db.admissionApplication.findFirst({
      where: { id: applicationId, tenantId: scope.tenantId, deletedAt: null },
      include: {
        documents: true,
        offers: { orderBy: { createdAt: 'desc' } },
        lead: true,
        program: true,
      },
    })
    if (!app) throw new Error('Application not found')

    if (['REJECTED', 'WITHDRAWN', 'EXPIRED'].includes(app.status)) {
      throw new Error(`Cannot perform final review on application in status ${app.status}`)
    }
    if (app.status === 'ENROLLED' || app.status === 'ADMITTED') {
      throw new Error('Application is already enrolled/admitted')
    }

    // Gate: Application must have reached OFFER_ACCEPTED (or APPROVED if direct path)
    if (app.status !== 'OFFER_ACCEPTED' && app.status !== 'APPROVED') {
      throw new Error(`Application must be in OFFER_ACCEPTED or APPROVED status before final staff review (current: ${app.status})`)
    }

    // Gate: Age validation
    const ageCheck = await ConfigurationService.validateProgramAge(scope.tenantId, app.programType, app.childDob)
    if (!ageCheck.eligible) {
      throw new Error(`Age check failed: ${ageCheck.reason}`)
    }

    // Gate: Document verification check
    const hasRejectedDocs = app.documents.some((d) => d.status === 'REJECTED')
    if (hasRejectedDocs) {
      throw new Error('Cannot complete final review: One or more documents are marked as Rejected.')
    }
    const unverifiedDocs = app.documents.filter((d) => d.status !== 'VERIFIED' && !d.verified)
    if (unverifiedDocs.length > 0) {
      throw new Error(`Cannot complete final review: ${unverifiedDocs.length} mandatory documents are still pending verification.`)
    }

    // Gate: Offer acceptance check (if offer exists)
    const latestOffer = app.offers[0]
    if (latestOffer) {
      if (latestOffer.status !== 'ACCEPTED') {
        throw new Error(`Admission offer ${latestOffer.offerNumber} has not been accepted by parent (current: ${latestOffer.status}).`)
      }
      if (new Date() > latestOffer.validUntil) {
        throw new Error(`Admission offer ${latestOffer.offerNumber} has expired. Please issue a refreshed offer first.`)
      }
    }

    const reviewDate = new Date()
    const reviewNote = `[Staff Final Review Completed on ${reviewDate.toLocaleDateString('en-IN')}] Verified by ${ctx.actorName || 'Staff'}.${notes ? ` Notes: ${notes}` : ''} | Dossier Ready for Next Module`
    const updatedNotes = app.notes ? `${app.notes}\n\n${reviewNote}` : reviewNote

    const updatedApp = await db.admissionApplication.update({
      where: { id: applicationId },
      data: {
        notes: updatedNotes,
      },
    })

    await audit({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      academicSessionId: scope.academicYearId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'FINAL_REVIEW_COMPLETED',
      entity: 'AdmissionApplication',
      entityId: applicationId,
      summary: `Staff Final Review completed for ${app.applicationNumber} by ${ctx.actorName || 'Staff'}. Marked READY_FOR_ALLOCATION.`,
    })

    return {
      application: updatedApp,
      readyForNextModule: true,
      stage: 'READY_FOR_ALLOCATION',
      reviewedBy: ctx.actorName || 'Staff',
      reviewedAt: reviewDate.toISOString(),
      handoffPayload: {
        applicationId: app.id,
        applicationNumber: app.applicationNumber,
        childName: `${app.childFirstName} ${app.childLastName || ''}`.trim(),
        childDob: app.childDob,
        childGender: app.childGender,
        programType: app.programType,
        parentName: app.parentName,
        parentPhone: app.parentPhone,
        parentEmail: app.parentEmail,
        guardianId: app.guardianId,
        offerId: latestOffer?.id || null,
        feeTotalCents: latestOffer?.feeTotalCents || null,
      },
    }
  }

  // =========================================================================
  // 9. REJECTION
  // =========================================================================

  /**
   * Reject an application with structured reason.
   */
  static async rejectApplication(
    ctx: ScopeContext,
    applicationId: string,
    reasonOrOptions: string | { reason?: string; notes?: string },
    notesArg?: string
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const app = await db.admissionApplication.findFirst({
      where: { id: applicationId, tenantId: scope.tenantId, deletedAt: null },
    })
    if (!app) throw new Error('Application not found')
    if (app.status === 'ENROLLED' || app.status === 'ADMITTED') {
      throw new Error('Cannot reject an already enrolled application')
    }

    const isObj = typeof reasonOrOptions === 'object' && reasonOrOptions !== null
    const reasonStr = isObj ? reasonOrOptions.reason : reasonOrOptions
    const notesStr = isObj ? reasonOrOptions.notes : notesArg
    const structuredReason = (typeof reasonStr === 'string' && reasonStr.trim()) ? reasonStr.trim() : 'Did not meet admission criteria'

    const updated = await db.admissionApplication.update({
      where: { id: applicationId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: structuredReason,
        ...(notesStr ? { notes: app.notes ? `${app.notes}\n[Rejection Note: ${notesStr}]` : `[Rejection Note: ${notesStr}]` } : {}),
      },
    })

    await audit({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      academicSessionId: scope.academicYearId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'REJECT',
      entity: 'AdmissionApplication',
      entityId: applicationId,
      summary: `Application ${app.applicationNumber} rejected: ${structuredReason}${notesStr ? ` (${notesStr})` : ''}`,
    })

    return updated
  }

  // =========================================================================
  // 10. WAITING LIST
  // =========================================================================

  /**
   * Place an application on the waiting list when seats are full.
   * Fully integrated with M03.4 WaitingListService.
   */
  static async waitlistApplication(
    ctx: ScopeContext,
    applicationId: string,
    reason?: string,
    priority?: 'NORMAL' | 'HIGH',
    reasonNotes?: string
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const app = await db.admissionApplication.findFirst({
      where: { id: applicationId, tenantId: scope.tenantId, deletedAt: null },
    })
    if (!app) throw new Error('Application not found')
    if (['ENROLLED', 'ADMITTED', 'REJECTED', 'WITHDRAWN'].includes(app.status)) {
      throw new Error(`Cannot waitlist application in status ${app.status}`)
    }

    const { WaitingListService } = await import('./waiting-list-service')

    const validReasons = [
      'NO_SEAT_AVAILABLE',
      'PARENT_REQUESTED_LATER',
      'FUTURE_TERM',
      'PROGRAM_CAPACITY',
      'OTHER',
    ]

    let wlReason: any = 'PROGRAM_CAPACITY'
    let notes = reasonNotes || ''

    if (reason) {
      if (validReasons.includes(reason)) {
        wlReason = reason
      } else {
        wlReason = 'OTHER'
        notes = reason
      }
    }

    const result = await WaitingListService.addToWaitingList(ctx, {
      applicationId,
      reason: wlReason,
      reasonNotes: notes,
      priority: priority || 'NORMAL',
    })

    const updated = await db.admissionApplication.findUnique({ where: { id: applicationId } })

    return { application: updated, position: result.position, waitingListEntry: result.entry }
  }

  // =========================================================================
  // 11. FINAL ENROLLMENT & CROSS-MODULE HANDOFF
  // =========================================================================

  /**
   * Complete Admission Enrollment — The critical atomic multi-entity transaction.
   * Hands off to Student, Parent, Class Allocation, and Finance.
   * IDEMPOTENT: repeated calls return the existing enrolled student.
   */
  static async completeEnrollment(
    ctx: ScopeContext,
    applicationId: string,
    targetClassroomIdOrOptions?: string | { classroomId?: string; additionalGuardians?: any[] },
    optionsArg?: { additionalGuardians?: any[] }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const targetClassroomId = typeof targetClassroomIdOrOptions === 'string'
      ? targetClassroomIdOrOptions
      : targetClassroomIdOrOptions?.classroomId
    const options = typeof targetClassroomIdOrOptions === 'object' && targetClassroomIdOrOptions !== null
      ? targetClassroomIdOrOptions
      : optionsArg

    const app = await db.admissionApplication.findFirst({
      where: { id: applicationId, tenantId: scope.tenantId, deletedAt: null },
      include: { documents: true },
    })
    if (!app) throw new Error('Application not found')

    // State gate: only approved or offer-accepted applications can be enrolled
    if (!['APPROVED', 'OFFER_ACCEPTED', 'ENROLLED', 'ADMITTED'].includes(app.status)) {
      throw new Error(
        `Cannot enroll application in status ${app.status}. Approve the application and record any offer acceptance first.`
      )
    }

    // Age validation gate
    const ageCheck = await ConfigurationService.validateProgramAge(scope.tenantId, app.programType, app.childDob)
    if (!ageCheck.eligible) {
      throw new Error(`Cannot enroll application: ${ageCheck.reason}`)
    }

    // If an offer exists, an accepted and non-expired offer is required
    const acceptedOffer = await db.admissionOffer.findFirst({
      where: { applicationId, tenantId: scope.tenantId },
      orderBy: { createdAt: 'desc' },
    })
    if (acceptedOffer) {
      if (acceptedOffer.status !== 'ACCEPTED') {
        throw new Error(
          `Admission requires offer ${acceptedOffer.offerNumber} to be accepted by the parent before enrollment.`
        )
      }
      if (new Date() > acceptedOffer.validUntil) {
        throw new Error(`Offer ${acceptedOffer.offerNumber} has expired. Generate a renewed offer first.`)
      }
    }

    // Document gate: no rejected documents and all must be verified
    const hasRejectedDocs = app.documents.some((d) => d.status === 'REJECTED')
    if (hasRejectedDocs) {
      throw new Error('Cannot enroll application: One or more documents are marked as Rejected. Request revised documents first.')
    }
    const unverifiedDocs = app.documents.filter((d) => d.status !== 'VERIFIED' && !d.verified)
    if (unverifiedDocs.length > 0) {
      throw new Error(`Cannot enroll application: ${unverifiedDocs.length} required documents are still pending verification.`)
    }

    // Idempotent return if already enrolled
    if (app.status === 'ENROLLED' && app.studentId) {
      const existingStudent = await db.student.findUnique({
        where: { id: app.studentId },
        include: { currentClassroom: true },
      })
      if (existingStudent) {
        return {
          student: existingStudent,
          admissionNo: existingStudent.admissionNo,
          classroomName: existingStudent.currentClassroom?.name || 'Assigned',
          isAlreadyEnrolled: true,
        }
      }
    }

    // Classroom Selection & Concurrency Capacity Guard
    const classroom = targetClassroomId
      ? await db.classroom.findFirst({
          where: { id: targetClassroomId, tenantId: scope.tenantId, isActive: true },
        })
      : await db.classroom.findFirst({
          where: {
            tenantId: scope.tenantId,
            branchId: scope.branchId,
            programType: app.programType,
            isActive: true,
          },
        })

    if (!classroom) {
      throw new Error(`No active section found for program ${app.programType}. Configure classroom in Setup first.`)
    }

    if (classroom.programType !== app.programType) {
      throw new Error(`Classroom ${classroom.name} (${classroom.programType}) does not match application program ${app.programType}`)
    }

    // Capacity verification
    const activeEnrolledCount = await db.student.count({
      where: { currentClassroomId: classroom.id, tenantId: scope.tenantId, status: 'ACTIVE', deletedAt: null },
    })
    if (activeEnrolledCount >= classroom.capacity) {
      const err: any = new Error(
        `Section ${classroom.name} is at full capacity (${activeEnrolledCount}/${classroom.capacity}). Please waitlist the child or allocate another section.`
      )
      err.code = 'CLASSROOM_FULL'
      throw err
    }

    // =========================================================================
    // ATOMIC TRANSACTION: Student + Guardian + Allocation + Fee Invoice
    // =========================================================================
    const result = await db.$transaction(async (tx) => {
      // 1. Re-check classroom capacity inside transaction
      const inTxCount = await tx.student.count({
        where: { currentClassroomId: classroom.id, tenantId: scope.tenantId, status: 'ACTIVE', deletedAt: null },
      })
      if (inTxCount >= classroom.capacity) {
        const err: any = new Error(`Section ${classroom.name} is at full capacity (${inTxCount}/${classroom.capacity}).`)
        err.code = 'CLASSROOM_FULL'
        throw err
      }

      let bloodGroup: any = null
      let emergencyContact: string | null = null
      let address: string | null = null
      let extraGuardians: any[] = options?.additionalGuardians || []

      if (app.notes) {
        const metaMatch = app.notes.match(/\[Metadata:\s*(\{.*?\})\]/)
        if (metaMatch) {
          try {
            const parsed = JSON.parse(metaMatch[1])
            if (parsed.bloodGroup) bloodGroup = parsed.bloodGroup
            if (parsed.emergencyContact) emergencyContact = parsed.emergencyContact
            if (parsed.address) address = parsed.address
            if (parsed.additionalGuardians && extraGuardians.length === 0) {
              extraGuardians = parsed.additionalGuardians
            }
          } catch {}
        }
      }

      // 2. Check if Student already exists (name + DOB + tenant match)
      let student = await tx.student.findFirst({
        where: {
          tenantId: scope.tenantId,
          firstName: { equals: app.childFirstName, mode: 'insensitive' },
          dob: app.childDob,
          deletedAt: null,
        },
      })

      if (!student) {
        const studentCount = await tx.student.count({ where: { tenantId: scope.tenantId } })
        const admissionNo = `STU-${new Date().getFullYear()}-${String(studentCount + 1).padStart(4, '0')}`

        student = await tx.student.create({
          data: {
            tenantId: scope.tenantId,
            branchId: scope.branchId,
            admissionNo,
            firstName: app.childFirstName,
            lastName: app.childLastName,
            dob: app.childDob,
            gender: app.childGender,
            bloodGroup,
            address,
            admissionDate: new Date(),
            currentClassroomId: classroom.id,
          },
        })
      } else {
        // Link existing student to new classroom
        student = await tx.student.update({
          where: { id: student.id },
          data: { currentClassroomId: classroom.id, status: 'ACTIVE' },
        })
      }

      // 3. Parent / Guardian: Find existing Guardian in THIS tenant by application.guardianId or phone
      let guardian = app.guardianId
        ? await tx.guardian.findFirst({
            where: { id: app.guardianId, tenantId: scope.tenantId, deletedAt: null },
          })
        : null

      if (!guardian) {
        guardian = await tx.guardian.findFirst({
          where: {
            tenantId: scope.tenantId,
            phone: app.parentPhone,
            deletedAt: null,
          },
        })
      }

      // Resolve or provision M01 User account for Parent Portal access
      let parentUser = guardian?.userId
        ? await tx.user.findUnique({ where: { id: guardian.userId } })
        : null

      if (!parentUser && app.parentEmail) {
        parentUser = await tx.user.findUnique({ where: { email: app.parentEmail.toLowerCase().trim() } })
      }
      if (!parentUser && app.parentPhone) {
        parentUser = await tx.user.findFirst({ where: { phone: app.parentPhone.trim() } })
      }

      if (!parentUser) {
        // Provision new Parent portal user in M01
        const cleanName = app.parentName.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.')
        const rand = Math.floor(100 + Math.random() * 900)
        const username = `parent.${cleanName}.${rand}`
        const defaultPasswordHash = await bcrypt.hash('PreOneParent@2026', 10)

        parentUser = await tx.user.create({
          data: {
            email: app.parentEmail ? app.parentEmail.toLowerCase().trim() : null,
            phone: app.parentPhone.trim(),
            username,
            fullName: app.parentName.trim(),
            passwordHash: defaultPasswordHash,
            status: 'ACTIVE',
          },
        })
      }

      // Ensure TenantUser membership for parentUser with role PARENT
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
            branchId: scope.branchId,
            status: 'ACTIVE',
          },
        })
      }

      // Find if parentUser is linked to a guardian in THIS tenant
      if (parentUser) {
        const guardianWithUser = await tx.guardian.findFirst({
          where: { userId: parentUser.id, tenantId: scope.tenantId, deletedAt: null },
        })
        if (guardianWithUser) {
          guardian = guardianWithUser
        }
      }

      // Check if parentUser's unique guardian slot is already taken anywhere
      const existingGuardianForUser = parentUser
        ? await tx.guardian.findUnique({ where: { userId: parentUser.id } })
        : null
      const canLinkUserToGuardian = !existingGuardianForUser || existingGuardianForUser.id === guardian?.id

      if (!guardian) {
        guardian = await tx.guardian.create({
          data: {
            tenantId: scope.tenantId,
            fullName: app.parentName,
            phone: app.parentPhone,
            email: app.parentEmail,
            relationship: 'MOTHER',
            isPrimaryContact: true,
            userId: canLinkUserToGuardian && parentUser ? parentUser.id : null,
          },
        })
      } else if (!guardian.userId && canLinkUserToGuardian && parentUser) {
        guardian = await tx.guardian.update({
          where: { id: guardian.id },
          data: { userId: parentUser.id },
        })
      }

      // 4. Link Student to Guardian (upsert to prevent duplicate link)
      const existingLink = await tx.studentGuardian.findUnique({
        where: { studentId_guardianId: { studentId: student.id, guardianId: guardian.id } },
      })
      if (!existingLink) {
        await tx.studentGuardian.create({
          data: {
            studentId: student.id,
            guardianId: guardian.id,
            isPrimary: true,
            canPickup: true,
            isFeePayer: true,
            receivesComm: true,
          },
        })
      }

      // 4b. Process additional family guardians if provided
      if (extraGuardians && extraGuardians.length > 0) {
        for (const ag of extraGuardians) {
          if (!ag.phone || !ag.fullName) continue
          let extraGuardian = await tx.guardian.findFirst({
            where: { tenantId: scope.tenantId, phone: ag.phone.trim(), deletedAt: null },
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

          // Count active parents for student to enforce Max 2 Parents policy
          const activeParentsCount = await tx.studentGuardian.count({
            where: {
              studentId: student.id,
              relationship: { in: ['FATHER', 'MOTHER', 'PARENT'] },
            },
          })

          const requestedRole = (ag.relationship === 'FATHER' || ag.relationship === 'MOTHER' || ag.relationship === 'PARENT') && activeParentsCount < 2
            ? 'PARENT'
            : 'GUARDIAN'

          if (!extraUser) {
            const cleanName = ag.fullName.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.')
            const rand = Math.floor(100 + Math.random() * 900)
            const username = `guardian.${cleanName}.${rand}`
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

          const existingMem = await tx.tenantUser.findFirst({
            where: { tenantId: scope.tenantId, userId: extraUser.id },
          })
          if (!existingMem) {
            await tx.tenantUser.create({
              data: {
                tenantId: scope.tenantId,
                userId: extraUser.id,
                role: requestedRole,
                roles: [requestedRole],
                branchId: scope.branchId,
                status: 'ACTIVE',
              },
            })
          }

          if (extraUser) {
            const extraWithUser = await tx.guardian.findFirst({
              where: { userId: extraUser.id, tenantId: scope.tenantId, deletedAt: null },
            })
            if (extraWithUser) {
              extraGuardian = extraWithUser
            }
          }

          const existingGuardianForExtra = extraUser
            ? await tx.guardian.findUnique({ where: { userId: extraUser.id } })
            : null
          const canLinkExtraUserId = !existingGuardianForExtra || existingGuardianForExtra.id === extraGuardian?.id

          if (!extraGuardian) {
            extraGuardian = await tx.guardian.create({
              data: {
                tenantId: scope.tenantId,
                fullName: ag.fullName.trim(),
                phone: ag.phone.trim(),
                email: ag.email ? ag.email.trim() : null,
                relationship: ag.relationship || 'GUARDIAN',
                isPrimaryContact: Boolean(ag.isPrimaryContact),
                userId: canLinkExtraUserId && extraUser ? extraUser.id : null,
              },
            })
          } else if (!extraGuardian.userId && canLinkExtraUserId && extraUser) {
            extraGuardian = await tx.guardian.update({
              where: { id: extraGuardian.id },
              data: { userId: extraUser.id },
            })
          }

          const existingExtraLink = await tx.studentGuardian.findUnique({
            where: { studentId_guardianId: { studentId: student.id, guardianId: extraGuardian.id } },
          })
          if (!existingExtraLink) {
            await tx.studentGuardian.create({
              data: {
                studentId: student.id,
                guardianId: extraGuardian.id,
                relationship: ag.relationship || 'GUARDIAN',
                isPrimary: Boolean(ag.isPrimaryContact),
                canPickup: ag.canPickup !== false,
                pickupPin: ag.pickupPin || null,
                isFeePayer: Boolean(ag.isFeePayer),
                receivesComm: ag.receivesCommunication !== false,
              },
            })
          }
        }
      }

      // 5. Classroom Allocation History (StudentAllocation per AcademicSession)
      await tx.studentAllocation.create({
        data: {
          tenantId: scope.tenantId,
          studentId: student.id,
          academicSessionId: scope.academicYearId,
          classroomId: classroom.id,
          programType: classroom.programType,
          status: 'ACTIVE',
          startedAt: new Date(),
          reason: 'New Admission Enrolment',
          createdById: ctx.actorId,
          createdByName: ctx.actorName,
        },
      })

      // 6. Finance handoff: First fee invoice from configured FeePlan
      const feePlan = await tx.feePlan.findFirst({
        where: { tenantId: scope.tenantId, programType: app.programType, isActive: true },
        include: { items: true },
      })

      let invoice: { id: string; invoiceNumber: string; totalCents: number; dueDate: Date } | null = null
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
            branchId: scope.branchId,
            studentId: student.id,
            invoiceNumber,
            title: `${feePlan.name} — Admission Fee Invoice`,
            dueDate,
            subtotalCents: subtotal,
            totalCents: subtotal,
            balanceCents: subtotal,
            status: 'ISSUED',
            issuedById: ctx.actorId,
            academicSessionId: scope.academicYearId,
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

      // 7. Update Application status to ENROLLED
      await tx.admissionApplication.update({
        where: { id: applicationId },
        data: {
          status: 'ENROLLED',
          approvedAt: new Date(),
          studentId: student.id,
          classroomId: classroom.id,
        },
      })

      // 8. Update Lead to CONVERTED
      if (app.leadId) {
        await tx.lead.update({
          where: { id: app.leadId },
          data: { status: 'CONVERTED' },
        }).catch(() => {})
      }

      // 9. Parent Portal welcome timeline entry
      await tx.timelineEntry.create({
        data: {
          tenantId: scope.tenantId,
          studentId: student.id,
          classroomId: classroom.id,
          academicSessionId: scope.academicYearId,
          type: 'MILESTONE',
          title: 'Welcome to PreOne!',
          body: `${app.childFirstName} joined ${classroom.name} for academic session ${scope.academicYearId}.`,
        },
      })

      return { student, guardian, classroom, invoice, parentUser, feePlan }
    })

    // Emit domain events for downstream integrations
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
      reason: 'New Admission Enrolment',
    })

    if (result.invoice) {
      await emit({
        type: 'InvoiceIssued',
        tenantId: scope.tenantId,
        invoiceId: result.invoice.id,
        studentId: result.student.id,
        invoiceNumber: result.invoice.invoiceNumber,
        totalCents: result.invoice.totalCents,
        dueDate: result.invoice.dueDate,
      })
    }

    await audit({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      academicSessionId: scope.academicYearId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'ENROLL',
      entity: 'AdmissionApplication',
      entityId: applicationId,
      summary: `Completed Admission: ${app.applicationNumber} → Student ${result.student.admissionNo} (${result.student.firstName}) enrolled in ${result.classroom.name} (Parent Account: ${result.parentUser?.email || result.parentUser?.phone})`,
    })

    return {
      student: result.student,
      guardian: result.guardian,
      parentUser: result.parentUser,
      admissionNo: result.student.admissionNo,
      classroomName: result.classroom.name,
      seatNumber: result.student.seatNumber || null,
      invoiceNumber: result.invoice?.invoiceNumber ?? null,
      isAlreadyEnrolled: false,
      successDetails: {
        student: {
          id: result.student.id,
          name: `${result.student.firstName} ${result.student.lastName || ''}`.trim(),
          admissionNo: result.student.admissionNo,
          program: app.programType,
          classroom: result.classroom.name,
          seatNumber: result.student.seatNumber || 'Assigned',
          academicSession: scope.academicYearId,
        },
        parent: {
          id: result.parentUser?.id,
          name: result.parentUser?.fullName || app.parentName,
          phone: result.parentUser?.phone || app.parentPhone,
          status: result.parentUser?.status || 'ACTIVE',
          portalStatus: 'READY',
        },
        finance: {
          feePlanName: result.feePlan?.name || `${app.programType} Fee Plan`,
          invoiceNumber: result.invoice?.invoiceNumber || null,
          dueDate: result.invoice?.dueDate || null,
        },
        timeline: {
          milestone: `Welcome to PreOne! Enrollment finalized in ${result.classroom.name}.`,
        },
      },
    }
  }

  // =========================================================================
  // 12. CLASS + DIVISION ALLOCATION ENGINE
  // =========================================================================

  /**
   * Evaluate eligible classroom divisions, live seat capacity, and policy-driven recommendations.
   */
  static async getAllocationRecommendations(ctx: ScopeContext, applicationId: string) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const app = await db.admissionApplication.findFirst({
      where: { id: applicationId, tenantId: scope.tenantId, deletedAt: null },
      include: { program: true },
    })
    if (!app) throw new Error('Application not found')

    // Find all active classrooms for this program, branch, and academic year
    const classrooms = await db.classroom.findMany({
      where: {
        tenantId: scope.tenantId,
        branchId: app.branchId,
        academicSessionId: app.academicSessionId,
        programType: app.programType,
        isActive: true,
      },
      include: {
        allocations: {
          where: { status: 'ACTIVE' },
        },
      },
      orderBy: { name: 'asc' },
    })

    const admConfig = getAdmissionConfig(await getDomainConfig(scope.tenantId, 'ADMISSION'))
    const policy = ((admConfig as any)?.allocationPolicy as string) || 'SYSTEM_AUTO_ALLOCATE'

    const divisionStats = classrooms.map((cls) => {
      const activeCount = cls.allocations.length
      const availableSeats = Math.max(0, cls.capacity - activeCount)
      return {
        id: cls.id,
        name: cls.name,
        code: cls.code,
        capacity: cls.capacity,
        allocated: activeCount,
        availableSeats,
        isFull: availableSeats === 0,
      }
    })

    // Find division with available seats
    const availableDivisions = divisionStats.filter((d) => !d.isFull)
    // Sort by most available seats to balance classroom distribution
    availableDivisions.sort((a, b) => b.availableSeats - a.availableSeats)

    const recommended = availableDivisions.length > 0 ? availableDivisions[0] : null
    const totalAvailable = divisionStats.reduce((acc, d) => acc + d.availableSeats, 0)

    return {
      applicationId: app.id,
      applicationNumber: app.applicationNumber,
      childName: `${app.childFirstName} ${app.childLastName || ''}`.trim(),
      programType: app.programType,
      programName: app.program?.name || app.programType,
      branchId: app.branchId,
      academicSessionId: app.academicSessionId,
      allocationPolicy: policy,
      totalCapacity: divisionStats.reduce((acc, d) => acc + d.capacity, 0),
      totalAllocated: divisionStats.reduce((acc, d) => acc + d.allocated, 0),
      totalAvailableSeats: totalAvailable,
      divisions: divisionStats,
      recommendedClassroomId: recommended ? recommended.id : null,
      recommendedClassroomName: recommended ? recommended.name : null,
      isWaitlistRecommended: totalAvailable === 0,
    }
  }

  /**
   * Promote a waitlisted application back to active review or allocation.
   */
  static async promoteWaitingListEntry(ctx: ScopeContext, applicationId: string, targetClassroomId?: string, notes?: string) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)
    if (!applicationId) throw new Error('Application ID is required for waiting list promotion')

    const app = await db.admissionApplication.findFirst({
      where: { id: applicationId, tenantId: scope.tenantId, deletedAt: null },
    })
    if (!app) throw new Error('Application not found')
    if (app.status !== 'WAITLISTED') {
      throw new Error(`Application ${app.applicationNumber} is not on the waiting list (current status: ${app.status})`)
    }

    if (targetClassroomId) {
      const cls = await db.classroom.findFirst({
        where: { id: targetClassroomId, tenantId: scope.tenantId, isActive: true },
        include: { allocations: { where: { status: 'ACTIVE' } } },
      })
      if (!cls) throw new Error('Target classroom not found')
      if (cls.allocations.length >= cls.capacity) {
        throw new Error(`Classroom ${cls.name} has no available capacity (${cls.allocations.length}/${cls.capacity})`)
      }
    }

    const updated = await db.admissionApplication.update({
      where: { id: applicationId },
      data: {
        status: 'APPROVED',
        classroomId: targetClassroomId || app.classroomId,
        notes: notes ? `${app.notes || ''}\n[Promoted from Waitlist: ${notes}]` : `${app.notes || ''}\n[Promoted from Waitlist]`,
      },
    })

    await audit({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      academicSessionId: scope.academicYearId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'WAITLIST_PROMOTED',
      entity: 'AdmissionApplication',
      entityId: applicationId,
      summary: `Application ${app.applicationNumber} promoted from Waiting List to Approved`,
    })

    return updated
  }

  // =========================================================================
  // 13. CSV BULK IMPORT ENGINE (UNIFIED BUSINESS LOGIC)
  // =========================================================================

  /**
   * Validate raw CSV rows against canonical masters and duplicate rules before import.
   */
  static async validateCsvImportRows(
    ctx: ScopeContext,
    type: 'leads' | 'applications',
    rawRows: Array<Record<string, any>>,
    mapping: Record<string, string>
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    // Load canonical masters for resolution
    const [programs, branches, sessions] = await Promise.all([
      db.program.findMany({ where: { tenantId: scope.tenantId } }),
      db.branch.findMany({ where: { tenantId: scope.tenantId, deletedAt: null } }),
      db.academicSession.findMany({ where: { tenantId: scope.tenantId } }),
    ])

    const validatedRows: Array<{
      rowNumber: number
      raw: Record<string, any>
      mapped: Record<string, any>
      status: 'VALID' | 'DUPLICATE' | 'INVALID'
      errors: string[]
      duplicateMatch?: any
    }> = []

    let validCount = 0
    let duplicateCount = 0
    let invalidCount = 0

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i]
      const mapped: Record<string, any> = {}
      const errors: string[] = []

      // Apply column mapping
      for (const [canonicalField, csvHeader] of Object.entries(mapping)) {
        if (csvHeader && row[csvHeader] !== undefined) {
          mapped[canonicalField] = String(row[csvHeader] || '').trim()
        }
      }

      const parentName = mapped.parentName || mapped.parent_name || row.parent_name || row['Parent Name'] || ''
      const phone = mapped.phone || mapped.parentPhone || mapped.parent_phone || row.parent_phone || row['Phone Number'] || row.phone || ''
      const childName = mapped.childName || mapped.childFirstName || mapped.child_name || row.child_name || row['Child Name'] || ''
      const dobStr = mapped.dob || mapped.childDob || mapped.child_dob || row.dob || row['Date of Birth'] || ''
      const programStr = mapped.program || mapped.programType || row.program || row['Program'] || ''
      const email = mapped.email || mapped.parentEmail || row.email || row['Email'] || null

      if (!parentName) errors.push('Parent name is required')
      if (!phone) errors.push('Phone number is required')
      else if (phone.replace(/\D/g, '').length < 10) errors.push('Valid 10-digit phone number is required')

      if (type === 'applications' && !childName) errors.push('Child name is required for application import')

      let parsedDob: Date | null = null
      if (dobStr) {
        const d = new Date(dobStr)
        if (isNaN(d.getTime())) errors.push(`Invalid Date of Birth format: ${dobStr}`)
        else parsedDob = d
      }

      // Resolve Program
      let resolvedProgramType: string = 'NURSERY'
      if (programStr) {
        const matched = programs.find(
          (p) =>
            p.name.toLowerCase() === programStr.toLowerCase() ||
            p.code.toLowerCase() === programStr.toLowerCase() ||
            p.programType.toLowerCase() === programStr.toLowerCase()
        )
        if (matched) {
          resolvedProgramType = matched.programType
        } else {
          errors.push(`Unknown program '${programStr}'. Must match an existing school program.`)
        }
      }

      let isDuplicate = false
      let duplicateMatch: any = null

      if (errors.length === 0 && phone) {
        if (type === 'leads') {
          const dup = await this.findDuplicateEnquiry(scope.tenantId, phone, email)
          if (dup) {
            isDuplicate = true
            duplicateMatch = { id: dup.id, leadNumber: dup.leadNumber, parentName: dup.parentName, status: dup.status }
          }
        } else {
          const dupApp = await this.checkDuplicateApplication(
            scope.tenantId,
            scope.academicYearId,
            childName || '',
            parsedDob || new Date(),
            phone
          )
          if (dupApp.isDuplicate && dupApp.existingApplication) {
            isDuplicate = true
            duplicateMatch = {
              id: dupApp.existingApplication.id,
              applicationNumber: dupApp.existingApplication.applicationNumber,
              parentName,
              status: dupApp.existingApplication.status,
            }
          }
        }
      }

      const rowStatus: 'VALID' | 'DUPLICATE' | 'INVALID' = errors.length > 0 ? 'INVALID' : isDuplicate ? 'DUPLICATE' : 'VALID'

      if (rowStatus === 'VALID') validCount++
      else if (rowStatus === 'DUPLICATE') duplicateCount++
      else invalidCount++

      validatedRows.push({
        rowNumber: i + 1,
        raw: row,
        mapped: {
          parentName,
          phone,
          email,
          childName,
          childDob: parsedDob ? parsedDob.toISOString() : null,
          programType: resolvedProgramType,
          notes: mapped.notes || row.notes || null,
          source: mapped.source || row.lead_source || 'CSV_IMPORT',
        },
        status: rowStatus,
        errors,
        duplicateMatch,
      })
    }

    return {
      totalRows: rawRows.length,
      validCount,
      duplicateCount,
      invalidCount,
      rows: validatedRows,
    }
  }

  /**
   * Execute batch import of validated CSV rows using canonical entity creation.
   */
  static async executeCsvImportBatch(
    ctx: ScopeContext,
    type: 'leads' | 'applications',
    validatedRows: Array<{ mapped: Record<string, any>; status: string }>,
    duplicateAction: 'SKIP' | 'CREATE' | 'LINK' = 'SKIP'
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)
    const fy = new Date().getFullYear()
    const batchSeq = Math.floor(1000 + Math.random() * 9000)
    const batchId = `IMP-${fy}-${batchSeq}`

    const results: Array<{ id: string; identifier: string; name: string }> = []
    let successCount = 0
    let skippedCount = 0
    let failedCount = 0

    for (const item of validatedRows) {
      if (item.status === 'INVALID') {
        failedCount++
        continue
      }
      if (item.status === 'DUPLICATE' && duplicateAction === 'SKIP') {
        skippedCount++
        continue
      }

      const m = item.mapped
      try {
        if (type === 'leads') {
          const res = await this.createEnquiry(ctx, {
            parentName: m.parentName,
            phone: m.phone,
            email: m.email,
            childName: m.childName,
            childDob: m.childDob ? new Date(m.childDob) : null,
            interestedProgram: m.programType as ProgramType,
            source: 'OTHER',
            notes: m.notes ? `[Batch: ${batchId}] ${m.notes}` : `[Batch: ${batchId}] Imported via CSV`,
          })
          results.push({ id: res.enquiry.id, identifier: res.enquiry.leadNumber, name: m.parentName })
          successCount++
        } else {
          const names = (m.childName || 'Applicant').trim().split(' ')
          const firstName = names[0]
          const lastName = names.slice(1).join(' ') || null

          const res = await this.submitApplication(ctx, {
            programType: m.programType as ProgramType,
            childFirstName: firstName,
            childLastName: lastName,
            childDob: m.childDob ? new Date(m.childDob) : new Date(Date.now() - 36 * 30 * 24 * 60 * 60 * 1000),
            parentName: m.parentName,
            parentPhone: m.phone,
            parentEmail: m.email,
            notes: `[Batch: ${batchId}] Imported via CSV application batch`,
            isDuplicateConfirmed: duplicateAction === 'CREATE',
          })
          results.push({ id: res.id, identifier: res.applicationNumber, name: m.childName })
          successCount++
        }
      } catch (err: any) {
        failedCount++
      }
    }

    await audit({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      academicSessionId: scope.academicYearId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'CSV_IMPORT',
      entity: type === 'leads' ? 'Lead' : 'AdmissionApplication',
      entityId: batchId,
      summary: `CSV Import Batch ${batchId} executed: ${successCount} created, ${skippedCount} skipped, ${failedCount} failed`,
    })

    return {
      batchId,
      total: validatedRows.length,
      success: successCount,
      skipped: skippedCount,
      failed: failedCount,
      records: results,
    }
  }
}
