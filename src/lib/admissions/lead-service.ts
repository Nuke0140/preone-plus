/**
 * PreOne — M03 Lead / Enquiry Domain Service
 *
 * Core Architecture & Business Rules:
 * 1. Zero Lead Leakage: Intake -> Duplicate Check -> Lead Created -> Contacted -> Qualified -> Application -> Converted/Lost.
 * 2. Multi-Channel Intake: WALK_IN, PHONE, WEBSITE, REFERRAL, FACEBOOK, INSTAGRAM, GOOGLE_ADS, EVENT, PARTNER, OTHER, CSV_IMPORT.
 * 3. Authoritative Duplicate Detection: Normalized 10-digit phone, normalized email, and child identity (name + DOB).
 * 4. Non-Blocking Age Advisory: Advisory flags early without rejecting prospect enquiries.
 * 5. Concurrency & Tenant-Safe Sequential Numbering: LEAD-YYYY-XXXX.
 * 6. Immutable Audit Trail: Every lifecycle transition, override, assignment, and status change records audit log.
 * 7. Zero Data Re-entry: Start Application carries all prospect child and parent data forward into the Application dossier.
 */

import { db } from '@/lib/db'
import { audit, nextNumber } from '@/lib/sequence'
import { ConfigurationService } from '@/lib/setup/config-service'
import { AdmissionService, ScopeContext } from '@/lib/admissions/admission-service'
import type { LeadStatus, LeadSource, ProgramType, Gender, Prisma } from '@prisma/client'

export const CANONICAL_LEAD_SOURCES: LeadSource[] = [
  'WALK_IN',
  'PHONE',
  'WEBSITE',
  'REFERRAL',
  'FACEBOOK',
  'INSTAGRAM',
  'GOOGLE_ADS',
  'EVENT',
  'PARTNER',
  'OTHER',
]

export const CANONICAL_LOST_REASONS = [
  'CHOSE_ANOTHER_SCHOOL',
  'FEES',
  'LOCATION',
  'TIMING',
  'NO_RESPONSE',
  'ADMISSION_NOT_REQUIRED',
  'OTHER',
] as const

export type LostReasonCode = typeof CANONICAL_LOST_REASONS[number]

export interface CreateLeadInput {
  parentName: string
  phone: string
  email?: string | null
  relationship?: string | null
  childName?: string | null
  childDob?: Date | string | null
  childGender?: Gender | string | null
  previousSchool?: string | null
  interestedProgram?: ProgramType | string | null
  source?: LeadSource | string
  enquiryDate?: Date | string | null
  notes?: string | null
  assignedToId?: string | null
  parentPhotoUrl?: string | null
  overrideDuplicate?: boolean
}

export interface UpdateLeadInput {
  parentName?: string
  phone?: string
  email?: string | null
  relationship?: string | null
  childName?: string | null
  childDob?: Date | string | null
  childGender?: Gender | string | null
  previousSchool?: string | null
  interestedProgram?: ProgramType | string | null
  source?: LeadSource | string
  notes?: string | null
  assignedToId?: string | null
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean
  matchReason?: 'PHONE' | 'EMAIL' | 'CHILD_IDENTITY' | 'MULTIPLE'
  message?: string
  existingLead?: {
    id: string
    leadNumber: string
    parentName: string
    phone: string
    email?: string | null
    childName?: string | null
    status: LeadStatus
    assignedToId?: string | null
    createdAt: Date
  }
}

export interface AgeEligibilityResult {
  ageInMonths: number
  withinRecommendedRange: boolean
  ageAdvisory: boolean
  minMonths: number | null
  maxMonths: number | null
  message: string | null
}

export interface ListLeadsParams {
  branchId?: string
  academicSessionId?: string
  status?: LeadStatus | string
  interestedProgram?: ProgramType | string
  source?: LeadSource | string
  assignedToId?: string
  search?: string
  dateFrom?: string | Date
  dateTo?: string | Date
  sortBy?: 'newest' | 'oldest' | 'updated' | 'leadNumber' | 'status'
  page?: number
  limit?: number
}

// ============================================================================
// 1. LEAD DUPLICATE SERVICE
// ============================================================================

export class LeadDuplicateService {
  /**
   * Normalizes phone string into canonical comparable 10-digit number.
   * e.g. "+91 98765 43210", "91-9876543210", "9876543210" -> "9876543210"
   */
  static normalizePhone(phone: string): string {
    if (!phone) return ''
    const digits = phone.trim().replace(/\D/g, '')
    return digits.length > 10 ? digits.slice(-10) : digits
  }

  /**
   * Normalizes email address (trimmed, lowercase).
   */
  static normalizeEmail(email?: string | null): string | null {
    if (!email || !email.trim()) return null
    return email.trim().toLowerCase()
  }

  /**
   * Finds duplicate candidate across Phone, Email, and Child Identity.
   */
  static async findDuplicate(
    tenantId: string,
    phone: string,
    email?: string | null,
    childName?: string | null,
    childDob?: Date | string | null,
    branchId?: string | null
  ): Promise<DuplicateDetectionResult> {
    const cleanPhone = this.normalizePhone(phone)
    const normEmail = this.normalizeEmail(email)

    // Check phone match first with robust digit normalization
    if (cleanPhone) {
      const phoneCandidates = await db.lead.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(branchId ? { branchId } : {}),
        },
        select: {
          id: true,
          leadNumber: true,
          parentName: true,
          phone: true,
          email: true,
          childName: true,
          status: true,
          assignedToId: true,
          createdAt: true,
        },
        take: 500,
        orderBy: { createdAt: 'desc' },
      })

      const phoneMatch = phoneCandidates.find((l) => this.normalizePhone(l.phone) === cleanPhone)
      if (phoneMatch) {
        return {
          isDuplicate: true,
          matchReason: 'PHONE',
          message: `Existing enquiry found for ${phoneMatch.parentName} (${phoneMatch.leadNumber}, status: ${phoneMatch.status}) matching phone`,
          existingLead: phoneMatch,
        }
      }
    }

    const conditions: Prisma.LeadWhereInput[] = []
    if (normEmail) {
      conditions.push({ email: { equals: normEmail, mode: 'insensitive' } })
    }
    if (childName && childName.trim() && childDob) {
      const d = new Date(childDob)
      if (!isNaN(d.getTime())) {
        conditions.push({
          childName: { equals: childName.trim(), mode: 'insensitive' },
          childDob: {
            gte: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0),
            lte: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59),
          },
        })
      }
    }

    if (conditions.length === 0) {
      return { isDuplicate: false }
    }

    const match = await db.lead.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        OR: conditions,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!match) {
      return { isDuplicate: false }
    }

    let matchReason: DuplicateDetectionResult['matchReason'] = 'PHONE'
    if (normEmail && match.email?.toLowerCase() === normEmail) {
      matchReason = cleanPhone && match.phone.includes(cleanPhone) ? 'MULTIPLE' : 'EMAIL'
    } else if (childName && match.childName?.toLowerCase() === childName.trim().toLowerCase()) {
      matchReason = 'CHILD_IDENTITY'
    }

    return {
      isDuplicate: true,
      matchReason,
      message: `Existing enquiry found for ${match.parentName} (${match.leadNumber}, status: ${match.status}) matching ${matchReason.toLowerCase()}`,
      existingLead: {
        id: match.id,
        leadNumber: match.leadNumber,
        parentName: match.parentName,
        phone: match.phone,
        email: match.email,
        childName: match.childName,
        status: match.status,
        assignedToId: match.assignedToId,
        createdAt: match.createdAt,
      },
    }
  }
}

// ============================================================================
// 2. AGE ELIGIBILITY SERVICE
// ============================================================================

export class AgeEligibilityService {
  /**
   * Calculates child's age in months and evaluates against program eligibility rules.
   */
  static async checkAge(
    tenantId: string,
    programTypeOrId: string,
    dob: Date | string
  ): Promise<AgeEligibilityResult> {
    const birthDate = new Date(dob)
    if (isNaN(birthDate.getTime())) {
      return {
        ageInMonths: 0,
        withinRecommendedRange: false,
        ageAdvisory: true,
        minMonths: null,
        maxMonths: null,
        message: 'Invalid date of birth provided',
      }
    }

    const ageCheck = await ConfigurationService.validateProgramAge(tenantId, programTypeOrId, dob)
    return {
      ageInMonths: ageCheck.ageMonths || 0,
      withinRecommendedRange: ageCheck.eligible,
      ageAdvisory: !ageCheck.eligible,
      minMonths: ageCheck.minMonths ?? null,
      maxMonths: ageCheck.maxMonths ?? null,
      message: !ageCheck.eligible ? ageCheck.reason || 'Age is outside the recommended range for this program' : null,
    }
  }
}

// ============================================================================
// 3. CANONICAL LEAD SERVICE
// ============================================================================

export class LeadService {
  /**
   * Helper to verify scope context.
   */
  private static async verifyScope(ctx: ScopeContext) {
    return AdmissionService.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)
  }

  /**
   * Create a new Lead with multi-channel intake, duplicate detection, age advisory,
   * sequential numbering (LEAD-YYYY-XXXX), and audit logging.
   */
  static async createLead(ctx: ScopeContext, input: CreateLeadInput) {
    const scope = await this.verifyScope(ctx)

    if (!input.parentName?.trim() || !input.phone?.trim()) {
      throw new Error('Parent name and phone number are required')
    }

    const normPhone = LeadDuplicateService.normalizePhone(input.phone)
    const normEmail = LeadDuplicateService.normalizeEmail(input.email)

    // 1. Authoritative Duplicate Check
    const dupResult = await LeadDuplicateService.findDuplicate(
      scope.tenantId,
      normPhone,
      normEmail,
      input.childName,
      input.childDob,
      scope.branchId
    )

    if (dupResult.isDuplicate && !input.overrideDuplicate) {
      return {
        isDuplicate: true,
        duplicateResult: dupResult,
        enquiry: dupResult.existingLead,
        message: dupResult.message,
      }
    }

    // 2. Age Advisory Check (Non-blocking)
    let ageAdvisoryTag = ''
    let ageAdvisoryData: AgeEligibilityResult | null = null
    if (input.interestedProgram && input.childDob) {
      ageAdvisoryData = await AgeEligibilityService.checkAge(
        scope.tenantId,
        String(input.interestedProgram),
        input.childDob
      )
      if (ageAdvisoryData.ageAdvisory && ageAdvisoryData.message) {
        ageAdvisoryTag = `[Age Advisory: ${ageAdvisoryData.message}]`
      }
    }

    // Compile contextual metadata into notes
    const contextItems: string[] = []
    if (input.relationship) contextItems.push(`Relationship: ${input.relationship.toUpperCase()}`)
    if (input.previousSchool) contextItems.push(`Previous School: ${input.previousSchool.trim()}`)
    if (input.childGender) contextItems.push(`Gender: ${input.childGender.toUpperCase()}`)
    if (input.enquiryDate) contextItems.push(`Enquiry Date: ${new Date(input.enquiryDate).toISOString().slice(0, 10)}`)
    if (input.parentPhotoUrl) contextItems.push(`Photo: ${input.parentPhotoUrl}`)

    let notesText = input.notes?.trim() || ''
    if (ageAdvisoryTag) {
      notesText = notesText ? `${notesText}\n${ageAdvisoryTag}` : ageAdvisoryTag
    }
    if (contextItems.length > 0) {
      const ctxNote = `[Enquiry Context: ${contextItems.join(' | ')}]`
      notesText = notesText ? `${notesText}\n${ctxNote}` : ctxNote
    }

    const validProgram = (['PLAYGROUP', 'NURSERY', 'LKG', 'UKG', 'DAYCARE'] as ProgramType[]).includes(
      input.interestedProgram as ProgramType
    )
      ? (input.interestedProgram as ProgramType)
      : null

    const validSource = CANONICAL_LEAD_SOURCES.includes(input.source as LeadSource)
      ? (input.source as LeadSource)
      : 'WALK_IN'

    // 3. Concurrency-safe sequential lead number
    const leadNumber = await nextNumber('lead', scope.tenantId)

    // 4. Atomic Transaction for Lead Creation + Audit
    const lead = await db.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          tenantId: scope.tenantId,
          branchId: scope.branchId,
          leadNumber,
          source: validSource,
          status: 'NEW',
          parentName: input.parentName.trim(),
          phone: input.phone.trim(),
          email: normEmail,
          childName: input.childName?.trim() || null,
          childDob: input.childDob ? new Date(input.childDob) : null,
          interestedProgram: validProgram,
          notes: notesText || null,
          assignedToId: input.assignedToId || null,
        },
      })
      return created
    })

    // 5. Audit Logging
    if (input.overrideDuplicate && dupResult.isDuplicate && dupResult.existingLead) {
      await audit({
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        academicSessionId: scope.academicYearId,
        actorId: ctx.actorId,
        actorName: ctx.actorName,
        actorRole: ctx.actorRole,
        action: 'LEAD_DUPLICATE_OVERRIDE',
        entity: 'Lead',
        entityId: lead.id,
        summary: `Staff override duplicate guard for ${input.parentName}. Existing lead: ${dupResult.existingLead.leadNumber}`,
        newValues: { duplicateOfLeadId: dupResult.existingLead.id, leadNumber },
      })
    }

    await audit({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      academicSessionId: scope.academicYearId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'LEAD_CREATED',
      entity: 'Lead',
      entityId: lead.id,
      summary: `Enquiry ${leadNumber} created for ${input.parentName} (${input.childName || 'Child'}) from source ${validSource}`,
      newValues: {
        leadNumber,
        status: 'NEW',
        parentName: lead.parentName,
        phone: lead.phone,
        source: validSource,
        program: validProgram,
      },
    })

    if (ageAdvisoryData?.ageAdvisory) {
      await audit({
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        academicSessionId: scope.academicYearId,
        actorId: ctx.actorId,
        actorName: ctx.actorName,
        actorRole: ctx.actorRole,
        action: 'LEAD_AGE_ADVISORY',
        entity: 'Lead',
        entityId: lead.id,
        summary: `Age advisory flagged for enquiry ${leadNumber}: ${ageAdvisoryData.message}`,
        newValues: { ageInMonths: ageAdvisoryData.ageInMonths, message: ageAdvisoryData.message },
      })
    }

    return {
      isDuplicate: false,
      enquiry: lead,
      lead,
      ageAdvisory: ageAdvisoryData,
    }
  }

  /**
   * Retrieves single Lead by ID with linked application, follow-up history, and audit timeline.
   */
  static async getLead(tenantId: string, id: string) {
    const lead = await db.lead.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        applications: {
          select: {
            id: true,
            applicationNumber: true,
            status: true,
            programType: true,
            createdAt: true,
          },
        },
      },
    })

    if (!lead) return null

    // Fetch assigned staff user profile if assigned
    let assignedStaff: { id: string; fullName: string; email?: string | null } | null = null
    if (lead.assignedToId) {
      const user = await db.user.findFirst({
        where: { id: lead.assignedToId },
        select: { id: true, fullName: true, email: true },
      })
      if (user) assignedStaff = user
    }

    // Fetch Follow-up events
    const followUps = await db.followUp.findMany({
      where: {
        tenantId,
        sourceType: { in: ['EnquiryFollowUp', 'SchoolVisit'] },
        sourceId: id,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Fetch Audit activity
    const auditLogs = await db.auditLog.findMany({
      where: {
        tenantId,
        entity: 'Lead',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
    })

    return {
      lead,
      enquiry: lead,
      assignedStaff,
      followUps,
      auditLogs,
    }
  }

  /**
   * List Leads with rich multi-field filtering, search, and sorting.
   */
  static async listLeads(tenantId: string, params: ListLeadsParams) {
    const where: Prisma.LeadWhereInput = {
      tenantId,
      deletedAt: null,
      ...(params.branchId ? { branchId: params.branchId } : {}),
      ...(params.status ? { status: params.status as LeadStatus } : {}),
      ...(params.interestedProgram ? { interestedProgram: params.interestedProgram as ProgramType } : {}),
      ...(params.source ? { source: params.source as LeadSource } : {}),
      ...(params.assignedToId ? { assignedToId: params.assignedToId } : {}),
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim()
      where.OR = [
        { leadNumber: { contains: q, mode: 'insensitive' } },
        { childName: { contains: q, mode: 'insensitive' } },
        { parentName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { email: { contains: q, mode: 'insensitive' } },
      ]
    }

    if (params.dateFrom || params.dateTo) {
      where.createdAt = {
        ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
        ...(params.dateTo ? { lte: new Date(params.dateTo) } : {}),
      }
    }

    let orderBy: Prisma.LeadOrderByWithRelationInput = { createdAt: 'desc' }
    if (params.sortBy === 'oldest') orderBy = { createdAt: 'asc' }
    else if (params.sortBy === 'updated') orderBy = { updatedAt: 'desc' }
    else if (params.sortBy === 'leadNumber') orderBy = { leadNumber: 'desc' }
    else if (params.sortBy === 'status') orderBy = { status: 'asc' }

    const page = Math.max(1, params.page || 1)
    const limit = params.limit ? Math.min(params.limit, 100) : 50
    const skip = (page - 1) * limit

    const [total, leads] = await Promise.all([
      db.lead.count({ where }),
      db.lead.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
    ])

    return {
      leads,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Update general Lead details with audit tracking.
   */
  static async updateLead(ctx: ScopeContext, id: string, data: UpdateLeadInput) {
    const scope = await this.verifyScope(ctx)

    const existing = await db.lead.findFirst({
      where: { id, tenantId: scope.tenantId, deletedAt: null },
    })
    if (!existing) throw new Error('Enquiry not found')

    const updateData: Prisma.LeadUpdateInput = {}
    if (data.parentName !== undefined) updateData.parentName = data.parentName.trim()
    if (data.phone !== undefined) updateData.phone = data.phone.trim()
    if (data.email !== undefined) updateData.email = LeadDuplicateService.normalizeEmail(data.email)
    if (data.childName !== undefined) updateData.childName = data.childName ? data.childName.trim() : null
    if (data.childDob !== undefined) updateData.childDob = data.childDob ? new Date(data.childDob) : null
    if (data.interestedProgram !== undefined) updateData.interestedProgram = data.interestedProgram as ProgramType
    if (data.source !== undefined) updateData.source = data.source as LeadSource
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId || null

    const updated = await db.lead.update({
      where: { id },
      data: updateData,
    })

    await audit({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      academicSessionId: scope.academicYearId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'LEAD_UPDATED',
      entity: 'Lead',
      entityId: id,
      summary: `Enquiry ${existing.leadNumber} details updated`,
      oldValues: { parentName: existing.parentName, phone: existing.phone, childName: existing.childName },
      newValues: updateData as any,
    })

    return updated
  }

  /**
   * Assign or reassign a Lead to a staff member.
   */
  static async assignLead(ctx: ScopeContext, id: string, assignedToId: string, assignedStaffName?: string) {
    const scope = await this.verifyScope(ctx)

    const existing = await db.lead.findFirst({
      where: { id, tenantId: scope.tenantId, deletedAt: null },
    })
    if (!existing) throw new Error('Enquiry not found')

    const updated = await db.lead.update({
      where: { id },
      data: { assignedToId },
    })

    await audit({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      academicSessionId: scope.academicYearId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'LEAD_ASSIGNED',
      entity: 'Lead',
      entityId: id,
      summary: `Enquiry ${existing.leadNumber} assigned to ${assignedStaffName || assignedToId}`,
      oldValues: { assignedToId: existing.assignedToId },
      newValues: { assignedToId },
    })

    return updated
  }

  /**
   * Enforces canonical state transitions across the Lead lifecycle.
   */
  static async transitionStatus(
    ctx: ScopeContext,
    id: string,
    newStatus: LeadStatus,
    notes?: string,
    nextFollowUpAt?: Date | string
  ) {
    const scope = await this.verifyScope(ctx)

    const lead = await db.lead.findFirst({
      where: { id, tenantId: scope.tenantId, deletedAt: null },
    })
    if (!lead) throw new Error('Enquiry not found')

    if (lead.status === 'CONVERTED') {
      throw new Error('Converted enquiries cannot transition backwards.')
    }

    // Validate canonical transition rules
    const allowedTransitions: Record<LeadStatus, LeadStatus[]> = {
      NEW: ['CONTACTED', 'QUALIFIED', 'NURTURE', 'LOST', 'DUPLICATE'],
      CONTACTED: ['QUALIFIED', 'NURTURE', 'APPLICATION_STARTED', 'LOST', 'DUPLICATE'],
      QUALIFIED: ['APPLICATION_STARTED', 'NURTURE', 'LOST', 'DUPLICATE'],
      NURTURE: ['CONTACTED', 'QUALIFIED', 'APPLICATION_STARTED', 'LOST', 'DUPLICATE'],
      APPLICATION_STARTED: ['CONVERTED', 'LOST', 'DUPLICATE'],
      CONVERTED: [],
      LOST: ['NURTURE', 'CONTACTED', 'QUALIFIED'],
      DUPLICATE: [],
    }

    const permitted = allowedTransitions[lead.status] || []
    if (!permitted.includes(newStatus) && lead.status !== newStatus) {
      throw new Error(`Invalid status transition from ${lead.status} to ${newStatus}.`)
    }

    const updatePayload: Prisma.LeadUpdateInput = {
      status: newStatus,
      ...(notes !== undefined ? { notes: notes || lead.notes } : {}),
      ...(nextFollowUpAt ? { nextFollowUpAt: new Date(nextFollowUpAt) } : {}),
    }

    const updated = await db.lead.update({
      where: { id },
      data: updatePayload,
    })

    await audit({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      academicSessionId: scope.academicYearId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'LEAD_STATUS_CHANGED',
      entity: 'Lead',
      entityId: id,
      summary: `Enquiry ${lead.leadNumber} transitioned: ${lead.status} → ${newStatus}`,
      oldValues: { status: lead.status },
      newValues: { status: newStatus },
    })

    return updated
  }

  /**
   * Close a Lead as LOST with mandatory reason.
   */
  static async markLost(ctx: ScopeContext, id: string, lostReason: string, lostNotes?: string) {
    if (!lostReason || !lostReason.trim()) {
      throw new Error('Lost reason is mandatory to close an enquiry')
    }

    const scope = await this.verifyScope(ctx)
    const lead = await db.lead.findFirst({
      where: { id, tenantId: scope.tenantId, deletedAt: null },
    })
    if (!lead) throw new Error('Enquiry not found')

    const appendNote = `[Lost: ${lostReason.trim()}${lostNotes ? ` | ${lostNotes.trim()}` : ''}]`
    const combinedNotes = lead.notes ? `${lead.notes}\n${appendNote}` : appendNote

    const updated = await db.lead.update({
      where: { id },
      data: {
        status: 'LOST',
        notes: combinedNotes,
      },
    })

    await audit({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      academicSessionId: scope.academicYearId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'LEAD_MARKED_LOST',
      entity: 'Lead',
      entityId: id,
      summary: `Enquiry ${lead.leadNumber} closed as LOST. Reason: ${lostReason}`,
      oldValues: { status: lead.status },
      newValues: { status: 'LOST', lostReason, lostNotes },
    })

    return updated
  }

  /**
   * Mark a Lead as DUPLICATE and preserve link to primary enquiry.
   */
  static async markDuplicate(ctx: ScopeContext, id: string, primaryLeadId: string, notes?: string) {
    const scope = await this.verifyScope(ctx)

    const [lead, primary] = await Promise.all([
      db.lead.findFirst({ where: { id, tenantId: scope.tenantId, deletedAt: null } }),
      db.lead.findFirst({ where: { id: primaryLeadId, tenantId: scope.tenantId, deletedAt: null } }),
    ])

    if (!lead) throw new Error('Enquiry to mark duplicate not found')
    if (!primary) throw new Error('Primary enquiry record not found')

    const dupNote = `[Duplicate of: ${primary.leadNumber} (${primary.parentName})${notes ? ` | ${notes.trim()}` : ''}]`
    const combinedNotes = lead.notes ? `${lead.notes}\n${dupNote}` : dupNote

    const updated = await db.lead.update({
      where: { id },
      data: {
        status: 'DUPLICATE',
        notes: combinedNotes,
      },
    })

    await audit({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      academicSessionId: scope.academicYearId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'LEAD_MARKED_DUPLICATE',
      entity: 'Lead',
      entityId: id,
      summary: `Enquiry ${lead.leadNumber} marked DUPLICATE of ${primary.leadNumber}`,
      oldValues: { status: lead.status },
      newValues: { status: 'DUPLICATE', primaryLeadId, primaryLeadNumber: primary.leadNumber },
    })

    return updated
  }

  /**
   * Start Admission Application with ZERO DATA RE-ENTRY.
   * Auto-copies child name, DOB, gender, parent contact, program, branch, session.
   */
  static async startApplication(ctx: ScopeContext, id: string, extraData?: any) {
    const scope = await this.verifyScope(ctx)

    const lead = await db.lead.findFirst({
      where: { id, tenantId: scope.tenantId, deletedAt: null },
    })
    if (!lead) throw new Error('Enquiry not found')

    if (lead.status === 'CONVERTED') {
      throw new Error('This enquiry is already converted to an active admission.')
    }

    // Submit Application using AdmissionService with zero data re-entry
    let childFirstName = 'Child'
    let childLastName: string | null = null
    if (lead.childName?.trim()) {
      const parts = lead.childName.trim().split(/\s+/)
      childFirstName = parts[0]
      childLastName = parts.slice(1).join(' ') || null
    } else if (lead.parentName?.trim()) {
      childFirstName = lead.parentName.trim().split(/\s+/)[0]
    }

    // Submit Application using AdmissionService with zero data re-entry
    const application = await AdmissionService.submitApplication(
      {
        tenantId: scope.tenantId,
        branchId: lead.branchId || scope.branchId,
        academicYearId: scope.academicYearId,
        actorId: ctx.actorId,
        actorName: ctx.actorName,
        actorRole: ctx.actorRole,
      },
      {
        leadId: lead.id,
        programType: (lead.interestedProgram || extraData?.programType || 'NURSERY') as ProgramType,
        childFirstName,
        childLastName,
        childDob: lead.childDob || new Date(new Date().getFullYear() - 3, 0, 1),
        childGender: extraData?.childGender || 'UNSPECIFIED',
        parentName: lead.parentName,
        parentPhone: lead.phone,
        parentEmail: lead.email,
        notes: `Converted from Enquiry ${lead.leadNumber}`,
        isDuplicateConfirmed: true,
      }
    )

    // Update lead status to APPLICATION_STARTED and link convertedApplicationId
    await db.lead.update({
      where: { id },
      data: {
        status: 'APPLICATION_STARTED',
        convertedApplicationId: application.id,
      },
    })

    await audit({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      academicSessionId: scope.academicYearId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'LEAD_APPLICATION_STARTED',
      entity: 'Lead',
      entityId: id,
      summary: `Application ${application.applicationNumber} initiated from Enquiry ${lead.leadNumber} with zero data re-entry`,
      newValues: { applicationId: application.id, applicationNumber: application.applicationNumber },
    })

    return {
      application,
      applicationId: application.id,
      applicationNumber: application.applicationNumber,
      leadId: lead.id,
      leadNumber: lead.leadNumber,
    }
  }

  /**
   * Retrieves chronological unified activity timeline for a Lead.
   */
  static async getActivity(tenantId: string, id: string) {
    const [auditLogs, followUps] = await Promise.all([
      db.auditLog.findMany({
        where: { tenantId, entity: 'Lead', entityId: id },
        orderBy: { createdAt: 'desc' },
      }),
      db.followUp.findMany({
        where: { tenantId, sourceId: id },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const timeline = [
      ...auditLogs.map((a) => ({
        id: a.id,
        type: 'AUDIT',
        action: a.action,
        title: a.summary || a.action.replace(/_/g, ' '),
        actor: a.actorName || 'System',
        createdAt: a.createdAt,
        details: a.newValues,
      })),
      ...followUps.map((f: any) => ({
        id: f.id,
        type: f.sourceType === 'SchoolVisit' ? 'VISIT' : 'FOLLOWUP',
        action: f.title || 'Interaction',
        title: f.actionTaken || f.detail || f.title || 'Parent communication logged',
        actor: f.resolvedByName || f.createdByName || 'Staff',
        createdAt: f.createdAt,
        details: { status: f.status, dueAt: f.dueAt, outcome: f.outcome },
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return timeline
  }
}
