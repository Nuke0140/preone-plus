import { db } from '@/lib/db'
import { AdmissionService, ScopeContext } from './admission-service'
import { raiseFollowUp } from '@/lib/followups'

// ── Types & Enums ────────────────────────────────────────────────────────────

export type WaitingListReason =
  | 'NO_SEAT_AVAILABLE'
  | 'PARENT_REQUESTED_LATER'
  | 'FUTURE_TERM'
  | 'PROGRAM_CAPACITY'
  | 'OTHER'

export type WaitingListStatus =
  | 'ACTIVE'
  | 'SEAT_AVAILABLE'
  | 'OFFER_SENT'
  | 'PARENT_ACCEPTED'
  | 'READY_FOR_ADMISSION'
  | 'CONVERTED'
  | 'PARENT_NOT_INTERESTED'
  | 'WITHDRAWN'
  | 'EXPIRED'
  | 'OFFER_DECLINED'
  | 'OFFER_EXPIRED'

export type WaitingListPriority = 'NORMAL' | 'HIGH'

export interface CreateWaitingListInput {
  applicationId: string
  reason: WaitingListReason
  reasonNotes?: string
  priority?: WaitingListPriority
  waitingSince?: Date | string
  notes?: string
}

export interface WaitingListEntryRecord {
  id: string
  tenantId: string
  branchId: string
  academicSessionId: string
  applicationId: string
  applicationNumber: string
  childFirstName: string
  childLastName: string | null
  childDob: Date
  childGender: string
  parentName: string
  parentPhone: string
  parentEmail: string | null
  programId: string | null
  programType: string
  reason: WaitingListReason
  reasonNotes: string | null
  status: WaitingListStatus
  priority: WaitingListPriority
  waitingSince: Date
  seatOpportunityAt: Date | null
  offerId: string | null
  offerSentAt: Date | null
  offerValidUntil: Date | null
  parentRespondedAt: Date | null
  parentResponse: string | null
  parentResponseNotes: string | null
  admissionApprovedAt: Date | null
  admissionApprovedBy: string | null
  convertedAt: Date | null
  studentId: string | null
  createdById: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  queuePosition?: number
  waitingDays?: number
}

export interface WaitingListFilters {
  branchId?: string
  academicSessionId?: string
  programType?: string
  status?: string
  priority?: string
  search?: string
  limit?: number
  offset?: number
}

export interface ProgramCapacitySummary {
  programType: string
  academicSessionId: string
  branchId: string
  capacity: number
  occupied: number
  available: number
  activeWaitlistCount: number
}

// ── Service Implementation ───────────────────────────────────────────────────

export class WaitingListService {
  private static schemaInitialized = false

  /**
   * Ensure the PostgreSQL tables and indices exist.
   * Runs lazily and safely via raw SQL so it is 100% database-isolated.
   */
  static async initSchema(): Promise<void> {
    if (this.schemaInitialized) return

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS waiting_list_entries (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        academic_session_id TEXT NOT NULL,
        application_id TEXT NOT NULL,
        application_number TEXT NOT NULL,
        child_first_name TEXT NOT NULL,
        child_last_name TEXT,
        child_dob TIMESTAMP WITH TIME ZONE NOT NULL,
        child_gender TEXT NOT NULL,
        parent_name TEXT NOT NULL,
        parent_phone TEXT NOT NULL,
        parent_email TEXT,
        program_id TEXT,
        program_type TEXT NOT NULL,
        reason TEXT NOT NULL,
        reason_notes TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        priority TEXT NOT NULL DEFAULT 'NORMAL',
        waiting_since TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        seat_opportunity_at TIMESTAMP WITH TIME ZONE,
        offer_id TEXT,
        offer_sent_at TIMESTAMP WITH TIME ZONE,
        offer_valid_until TIMESTAMP WITH TIME ZONE,
        parent_responded_at TIMESTAMP WITH TIME ZONE,
        parent_response TEXT,
        parent_response_notes TEXT,
        admission_approved_at TIMESTAMP WITH TIME ZONE,
        admission_approved_by TEXT,
        converted_at TIMESTAMP WITH TIME ZONE,
        student_id TEXT,
        created_by_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
      )
    `)

    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_wle_tenant_status ON waiting_list_entries(tenant_id, status)`)
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_wle_tenant_app ON waiting_list_entries(tenant_id, application_id)`)
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_wle_tenant_prog_session ON waiting_list_entries(tenant_id, program_type, academic_session_id)`)
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_wle_queue_order ON waiting_list_entries(tenant_id, program_type, academic_session_id, priority, waiting_since)`)

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS waiting_list_priority_audits (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        waiting_list_entry_id TEXT NOT NULL,
        previous_priority TEXT NOT NULL,
        new_priority TEXT NOT NULL,
        reason TEXT NOT NULL,
        changed_by_id TEXT,
        changed_by_name TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `)

    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_wl_priority_audits_entry ON waiting_list_priority_audits(waiting_list_entry_id)`)

    this.schemaInitialized = true
  }

  /**
   * Map database row (snake_case) to WaitingListEntryRecord (camelCase)
   */
  private static mapRow(row: any): WaitingListEntryRecord {
    const waitingSince = new Date(row.waiting_since || row.createdAt || Date.now())
    const diffTime = Math.abs(Date.now() - waitingSince.getTime())
    const waitingDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      academicSessionId: row.academic_session_id,
      applicationId: row.application_id,
      applicationNumber: row.application_number,
      childFirstName: row.child_first_name,
      childLastName: row.child_last_name,
      childDob: new Date(row.child_dob),
      childGender: row.child_gender,
      parentName: row.parent_name,
      parentPhone: row.parent_phone,
      parentEmail: row.parent_email,
      programId: row.program_id,
      programType: row.program_type,
      reason: row.reason as WaitingListReason,
      reasonNotes: row.reason_notes,
      status: row.status as WaitingListStatus,
      priority: row.priority as WaitingListPriority,
      waitingSince,
      seatOpportunityAt: row.seat_opportunity_at ? new Date(row.seat_opportunity_at) : null,
      offerId: row.offer_id,
      offerSentAt: row.offer_sent_at ? new Date(row.offer_sent_at) : null,
      offerValidUntil: row.offer_valid_until ? new Date(row.offer_valid_until) : null,
      parentRespondedAt: row.parent_responded_at ? new Date(row.parent_responded_at) : null,
      parentResponse: row.parent_response,
      parentResponseNotes: row.parent_response_notes,
      admissionApprovedAt: row.admission_approved_at ? new Date(row.admission_approved_at) : null,
      admissionApprovedBy: row.admission_approved_by,
      convertedAt: row.converted_at ? new Date(row.converted_at) : null,
      studentId: row.student_id,
      createdById: row.created_by_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
      waitingDays,
    }
  }

  // =========================================================================
  // 1. WAITING LIST ENTRY (M03.4)
  // =========================================================================

  /**
   * Add an existing AdmissionApplication to the Waiting List.
   * IDEMPOTENT: If an active waiting list entry exists for this application,
   * returns the existing record without creating duplicate entries.
   */
  static async addToWaitingList(
    ctx: ScopeContext,
    input: CreateWaitingListInput
  ): Promise<{ entry: WaitingListEntryRecord; position: number; isExisting: boolean }> {
    await this.initSchema()

    if (!input.applicationId) {
      throw new Error('Application ID is required to add to waiting list')
    }

    const validReasons: WaitingListReason[] = [
      'NO_SEAT_AVAILABLE',
      'PARENT_REQUESTED_LATER',
      'FUTURE_TERM',
      'PROGRAM_CAPACITY',
      'OTHER',
    ]

    if (!input.reason || !validReasons.includes(input.reason)) {
      throw new Error(`Valid waiting list reason is required. Allowed: ${validReasons.join(', ')}`)
    }

    if (input.reason === 'OTHER' && (!input.reasonNotes || !input.reasonNotes.trim())) {
      throw new Error('Reason notes are mandatory when reason is OTHER')
    }

    // Retrieve existing Application
    const app = await db.admissionApplication.findFirst({
      where: { id: input.applicationId, tenantId: ctx.tenantId, deletedAt: null },
    })

    if (!app) {
      throw new Error('Admission application not found')
    }

    if (['ENROLLED', 'ADMITTED'].includes(app.status)) {
      throw new Error(`Cannot waitlist application that is already admitted or enrolled (${app.status})`)
    }

    const scope = await AdmissionService.verifyScope(
      ctx.tenantId,
      app.branchId,
      app.academicSessionId
    )

    // IDEMPOTENCY CHECK: Check for active Waiting List entry for this application
    const existingRows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM waiting_list_entries 
       WHERE tenant_id = $1 AND application_id = $2 AND status IN ('ACTIVE', 'SEAT_AVAILABLE', 'OFFER_SENT', 'PARENT_ACCEPTED', 'READY_FOR_ADMISSION') AND deleted_at IS NULL
       LIMIT 1`,
      scope.tenantId,
      app.id
    )

    if (existingRows.length > 0) {
      const existingEntry = this.mapRow(existingRows[0])
      const position = await this.calculateQueuePosition(existingEntry)
      existingEntry.queuePosition = position
      return { entry: existingEntry, position, isExisting: true }
    }

    const priority: WaitingListPriority = input.priority === 'HIGH' ? 'HIGH' : 'NORMAL'
    const waitingSince = input.waitingSince ? new Date(input.waitingSince) : new Date()
    const entryId = crypto.randomUUID()

    // Update application status to WAITLISTED
    await db.admissionApplication.update({
      where: { id: app.id },
      data: {
        status: 'WAITLISTED',
        notes: input.notes
          ? `${app.notes || ''}\n[Waitlist: ${input.reason} - ${input.notes}]`.trim()
          : `${app.notes || ''}\n[Waitlist: ${input.reason}]`.trim(),
      },
    })

    // Insert into waiting_list_entries
    await db.$executeRawUnsafe(
      `INSERT INTO waiting_list_entries (
        id, tenant_id, branch_id, academic_session_id, application_id, application_number,
        child_first_name, child_last_name, child_dob, child_gender,
        parent_name, parent_phone, parent_email, program_id, program_type,
        reason, reason_notes, status, priority, waiting_since, created_by_id, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'ACTIVE', $18, $19, $20, NOW(), NOW()
      )`,
      entryId,
      scope.tenantId,
      scope.branchId,
      scope.academicYearId,
      app.id,
      app.applicationNumber,
      app.childFirstName,
      app.childLastName,
      app.childDob,
      app.childGender,
      app.parentName,
      app.parentPhone,
      app.parentEmail,
      app.programId,
      app.programType,
      input.reason,
      input.reasonNotes || null,
      priority,
      waitingSince,
      ctx.actorId || null
    )

    const createdRows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM waiting_list_entries WHERE id = $1 LIMIT 1`,
      entryId
    )
    const entry = this.mapRow(createdRows[0])
    const position = await this.calculateQueuePosition(entry)
    entry.queuePosition = position

    // Follow-up task creation in existing M03 follow-up system
    await raiseFollowUp({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      domain: 'ADMISSION',
      severity: priority === 'HIGH' ? 'WARNING' : 'INFO',
      title: `Waitlisted #${position}: ${entry.childFirstName} (${entry.programType})`,
      detail: `Reason: ${entry.reason}. Parent: ${entry.parentName} (${entry.parentPhone}). Priority: ${priority}`,
      sourceType: 'AdmissionApplication',
      sourceId: app.id,
      dedupeKey: `waitlist:${app.id}`,
      responsibleRole: 'PRINCIPAL',
      actorId: ctx.actorId,
      actorName: ctx.actorName,
    })

    // Audit log
    await db.auditLog.create({
      data: {
        tenantId: scope.tenantId,
        actorId: ctx.actorId,
        actorName: ctx.actorName || 'Staff',
        actorRole: ctx.actorRole || 'ADMIN',
        action: 'WAITLIST_ENTRY_CREATED',
        entity: 'WaitingListEntry',
        entityId: entryId,
        summary: `Application ${app.applicationNumber} (${entry.childFirstName}) placed on waiting list at Position #${position} [Priority: ${priority}, Reason: ${entry.reason}]`,
      },
    })

    // Parent Notification Dispatch (Notification != Admission Approval)
    await db.auditLog.create({
      data: {
        tenantId: scope.tenantId,
        actorId: ctx.actorId,
        actorName: ctx.actorName || 'PreOne Admissions System',
        actorRole: ctx.actorRole || 'SYSTEM',
        action: 'WAITLIST_NOTIFICATION_SENT',
        entity: 'WaitingListEntry',
        entityId: entryId,
        summary: `Admission update notification delivered to ${entry.parentName}. Child placed on waiting list for ${entry.programType} (Position #${position}). Next-step information provided. (Notification != Admission Approval)`,
      },
    }).catch(() => null)

    return { entry, position, isExisting: false }
  }

  // =========================================================================
  // 2. QUEUE CALCULATION & AUDITABLE RANKING
  // =========================================================================

  /**
   * Deterministically calculate queue position:
   * 1. HIGH priority ranks before NORMAL.
   * 2. Within priority, FIFO by waiting_since ASC, created_at ASC.
   * Only active candidate entries in the same program, session, branch, and tenant compete.
   */
  static async calculateQueuePosition(entry: WaitingListEntryRecord): Promise<number> {
    await this.initSchema()

    if (!['ACTIVE', 'SEAT_AVAILABLE'].includes(entry.status)) {
      return 0
    }

    const rows = await db.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*)::text as count FROM waiting_list_entries
       WHERE tenant_id = $1 
         AND branch_id = $2
         AND academic_session_id = $3
         AND program_type = $4
         AND status IN ('ACTIVE', 'SEAT_AVAILABLE')
         AND deleted_at IS NULL
         AND (
           (CASE WHEN priority = 'HIGH' THEN 1 ELSE 0 END > CASE WHEN $5 = 'HIGH' THEN 1 ELSE 0 END)
           OR (
             priority = $5
             AND (waiting_since < $6 OR (waiting_since = $6 AND created_at < $7))
           )
         )`,
      entry.tenantId,
      entry.branchId,
      entry.academicSessionId,
      entry.programType,
      entry.priority,
      entry.waitingSince,
      entry.createdAt
    )

    const aheadCount = parseInt(rows[0]?.count || '0', 10)
    return aheadCount + 1
  }

  /**
   * Change priority between NORMAL and HIGH with mandatory audit logging.
   */
  static async changePriority(
    ctx: ScopeContext,
    entryId: string,
    input: { newPriority: WaitingListPriority; reason: string }
  ): Promise<WaitingListEntryRecord> {
    await this.initSchema()

    if (!['NORMAL', 'HIGH'].includes(input.newPriority)) {
      throw new Error('Priority must be NORMAL or HIGH')
    }

    if (!input.reason || !input.reason.trim()) {
      throw new Error('A documented reason is required to change waiting list priority')
    }

    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM waiting_list_entries WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
      entryId,
      ctx.tenantId
    )

    if (rows.length === 0) {
      throw new Error('Waiting list entry not found')
    }

    const current = this.mapRow(rows[0])
    if (current.priority === input.newPriority) {
      return current
    }

    const prevPriority = current.priority

    // Update priority
    await db.$executeRawUnsafe(
      `UPDATE waiting_list_entries SET priority = $1, updated_at = NOW() WHERE id = $2`,
      input.newPriority,
      entryId
    )

    // Insert priority audit record
    const auditId = crypto.randomUUID()
    await db.$executeRawUnsafe(
      `INSERT INTO waiting_list_priority_audits (
        id, tenant_id, waiting_list_entry_id, previous_priority, new_priority, reason, changed_by_id, changed_by_name, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      auditId,
      ctx.tenantId,
      entryId,
      prevPriority,
      input.newPriority,
      input.reason.trim(),
      ctx.actorId || null,
      ctx.actorName || null
    )

    // Audit Log
    await db.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        actorId: ctx.actorId,
        actorName: ctx.actorName || 'Staff',
        actorRole: ctx.actorRole || 'ADMIN',
        action: 'WAITLIST_PRIORITY_CHANGED',
        entity: 'WaitingListEntry',
        entityId: entryId,
        summary: `Priority changed from ${prevPriority} to ${input.newPriority} for candidate ${current.childFirstName} (${current.applicationNumber}). Reason: ${input.reason}`,
      },
    })

    const updatedRows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM waiting_list_entries WHERE id = $1 LIMIT 1`,
      entryId
    )
    const updated = this.mapRow(updatedRows[0])
    updated.queuePosition = await this.calculateQueuePosition(updated)
    return updated
  }

  // =========================================================================
  // 3. SEAT AVAILABILITY & OPPORTUNITY ENGINE
  // =========================================================================

  /**
   * Check capacity and available seats for programs in branch and academic session.
   */
  static async getProgramCapacity(
    tenantId: string,
    branchId: string,
    academicSessionId: string,
    programType?: string
  ): Promise<ProgramCapacitySummary[]> {
    await this.initSchema()

    const classrooms = await db.classroom.findMany({
      where: {
        tenantId,
        branchId,
        academicSessionId,
        isActive: true,
        ...(programType ? { programType: programType as any } : {}),
      },
      include: {
        _count: { select: { students: { where: { status: 'ACTIVE' } } } },
      },
    })

    const map = new Map<string, { capacity: number; occupied: number }>()

    classrooms.forEach((c) => {
      const existing = map.get(c.programType) || { capacity: 0, occupied: 0 }
      existing.capacity += c.capacity
      existing.occupied += c._count?.students || 0
      map.set(c.programType, existing)
    })

    const summaries: ProgramCapacitySummary[] = []

    for (const [pType, cap] of map.entries()) {
      const waitlistCountRows = await db.$queryRawUnsafe<{ count: string }[]>(
        `SELECT COUNT(*)::text as count FROM waiting_list_entries
         WHERE tenant_id = $1 AND branch_id = $2 AND academic_session_id = $3 AND program_type = $4 AND status IN ('ACTIVE', 'SEAT_AVAILABLE') AND deleted_at IS NULL`,
        tenantId,
        branchId,
        academicSessionId,
        pType
      )

      summaries.push({
        programType: pType,
        academicSessionId,
        branchId,
        capacity: cap.capacity,
        occupied: cap.occupied,
        available: Math.max(0, cap.capacity - cap.occupied),
        activeWaitlistCount: parseInt(waitlistCountRows[0]?.count || '0', 10),
      })
    }

    return summaries
  }

  /**
   * Mark that a seat has become available for a waiting list candidate.
   * Notification clearly states an opportunity is available (NOT admitted).
   */
  static async markSeatAvailable(
    ctx: ScopeContext,
    entryId: string
  ): Promise<WaitingListEntryRecord> {
    await this.initSchema()

    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM waiting_list_entries WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
      entryId,
      ctx.tenantId
    )

    if (rows.length === 0) {
      throw new Error('Waiting list entry not found')
    }

    const current = this.mapRow(rows[0])
    if (['CONVERTED', 'WITHDRAWN', 'EXPIRED', 'OFFER_DECLINED'].includes(current.status)) {
      throw new Error(`Cannot mark seat available for entry in terminal status ${current.status}`)
    }

    await db.$executeRawUnsafe(
      `UPDATE waiting_list_entries SET status = 'SEAT_AVAILABLE', seat_opportunity_at = NOW(), updated_at = NOW() WHERE id = $1`,
      entryId
    )

    // Notification to parent: Admission opportunity is available (NOT ADMITTED)
    await db.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        actorId: ctx.actorId,
        actorName: ctx.actorName || 'Admissions Coordinator',
        actorRole: ctx.actorRole || 'STAFF',
        action: 'WAITLIST_SEAT_OPPORTUNITY_NOTIFICATION',
        entity: 'WaitingListEntry',
        entityId: entryId,
        summary: `Admission opportunity notification sent to ${current.parentName}. A seat has opened up for ${current.programType}. Formal offer review initiated. (Notification != Admission Approval)`,
      },
    }).catch(() => null)

    const updatedRows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM waiting_list_entries WHERE id = $1 LIMIT 1`,
      entryId
    )
    const updated = this.mapRow(updatedRows[0])
    updated.queuePosition = await this.calculateQueuePosition(updated)
    return updated
  }

  // =========================================================================
  // 4. SEAT OFFER & PARENT RESPONSE
  // =========================================================================

  /**
   * Generate an official seat offer for the waiting list candidate.
   */
  static async createSeatOffer(
    ctx: ScopeContext,
    entryId: string,
    input: { feePlanId?: string; validDays?: number; terms?: string }
  ): Promise<{ entry: WaitingListEntryRecord; offer: any }> {
    await this.initSchema()

    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM waiting_list_entries WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
      entryId,
      ctx.tenantId
    )

    if (rows.length === 0) {
      throw new Error('Waiting list entry not found')
    }

    const current = this.mapRow(rows[0])
    if (['CONVERTED', 'WITHDRAWN'].includes(current.status)) {
      throw new Error(`Cannot issue seat offer for entry in status ${current.status}`)
    }

    // Generate formal admission offer via AdmissionService
    const offerRes = await AdmissionService.generateOffer(
      ctx,
      current.applicationId,
      {
        feePlanId: input.feePlanId,
        validDays: input.validDays || 7,
        terms: input.terms || 'Seat offer from Waiting List promotion.',
      }
    )

    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + (input.validDays || 7))

    await db.$executeRawUnsafe(
      `UPDATE waiting_list_entries SET 
        status = 'OFFER_SENT',
        offer_id = $1,
        offer_sent_at = NOW(),
        offer_valid_until = $2,
        updated_at = NOW()
       WHERE id = $3`,
      offerRes.offer.id,
      validUntil,
      entryId
    )

    const updatedRows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM waiting_list_entries WHERE id = $1 LIMIT 1`,
      entryId
    )
    const updated = this.mapRow(updatedRows[0])
    updated.queuePosition = 0 // Once offer is sent, candidate is in offer workflow

    return { entry: updated, offer: offerRes.offer }
  }

  /**
   * Record parent response to the seat offer.
   * If ACCEPTED: status becomes PARENT_ACCEPTED. (Parent acceptance alone does NOT admit the child).
   * If DECLINED: status becomes OFFER_DECLINED.
   */
  static async recordParentResponse(
    ctx: ScopeContext,
    entryId: string,
    input: { response: 'ACCEPTED' | 'DECLINED'; notes?: string }
  ): Promise<WaitingListEntryRecord> {
    await this.initSchema()

    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM waiting_list_entries WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
      entryId,
      ctx.tenantId
    )

    if (rows.length === 0) {
      throw new Error('Waiting list entry not found')
    }

    const current = this.mapRow(rows[0])
    if (current.status !== 'OFFER_SENT' && current.status !== 'SEAT_AVAILABLE') {
      throw new Error(`Cannot record parent response for entry in status ${current.status}. Status must be OFFER_SENT.`)
    }

    const newStatus: WaitingListStatus = input.response === 'ACCEPTED' ? 'PARENT_ACCEPTED' : 'OFFER_DECLINED'

    // Also update formal offer in AdmissionService if present
    if (current.offerId) {
      if (input.response === 'ACCEPTED') {
        await AdmissionService.acceptOffer(ctx, current.applicationId, input.notes)
      } else {
        await AdmissionService.declineOffer(ctx, current.applicationId, input.notes)
      }
    }

    await db.$executeRawUnsafe(
      `UPDATE waiting_list_entries SET 
        status = $1,
        parent_responded_at = NOW(),
        parent_response = $2,
        parent_response_notes = $3,
        updated_at = NOW()
       WHERE id = $4`,
      newStatus,
      input.response,
      input.notes || null,
      entryId
    )

    // Audit log
    await db.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        actorId: ctx.actorId,
        actorName: ctx.actorName || 'Parent / Staff',
        actorRole: ctx.actorRole || 'GUARDIAN',
        action: input.response === 'ACCEPTED' ? 'WAITLIST_OFFER_ACCEPTED' : 'WAITLIST_OFFER_DECLINED',
        entity: 'WaitingListEntry',
        entityId: entryId,
        summary: `Parent ${input.response === 'ACCEPTED' ? 'accepted' : 'declined'} seat offer for ${current.childFirstName} (${current.applicationNumber})`,
      },
    })

    const updatedRows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM waiting_list_entries WHERE id = $1 LIMIT 1`,
      entryId
    )
    return this.mapRow(updatedRows[0])
  }

  // =========================================================================
  // 5. FINAL ADMISSION APPROVAL & COMPLETE ADMISSION (M03.4 -> Complete)
  // =========================================================================

  /**
   * Authorized staff reviewer sign-off after parent accepts seat offer.
   * Moves status to READY_FOR_ADMISSION.
   */
  static async approveAdmission(
    ctx: ScopeContext,
    entryId: string,
    notes?: string
  ): Promise<WaitingListEntryRecord> {
    await this.initSchema()

    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM waiting_list_entries WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
      entryId,
      ctx.tenantId
    )

    if (rows.length === 0) {
      throw new Error('Waiting list entry not found')
    }

    const current = this.mapRow(rows[0])
    if (current.status !== 'PARENT_ACCEPTED') {
      throw new Error(`Cannot approve admission from status ${current.status}. Parent must accept offer first.`)
    }

    // Formally approve application in AdmissionService
    await AdmissionService.approveApplication(ctx, current.applicationId, notes || 'Approved from Waiting List promotion')

    await db.$executeRawUnsafe(
      `UPDATE waiting_list_entries SET 
        status = 'READY_FOR_ADMISSION',
        admission_approved_at = NOW(),
        admission_approved_by = $1,
        updated_at = NOW()
       WHERE id = $2`,
      ctx.actorName || ctx.actorId || 'Authorized Reviewer',
      entryId
    )

    const updatedRows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM waiting_list_entries WHERE id = $1 LIMIT 1`,
      entryId
    )
    return this.mapRow(updatedRows[0])
  }

  /**
   * Final Admission Completion — Transactionally converts candidate into enrolled Student.
   * Hands off to Student, Guardian, Classroom Allocation, and Finance.
   * Updates Waiting List Entry status to CONVERTED.
   * Never sends "Admission Confirmed" before transaction success!
   */
  static async completeAdmission(
    ctx: ScopeContext,
    entryId: string,
    classroomId?: string
  ): Promise<{ entry: WaitingListEntryRecord; student: any }> {
    await this.initSchema()

    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM waiting_list_entries WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
      entryId,
      ctx.tenantId
    )

    if (rows.length === 0) {
      throw new Error('Waiting list entry not found')
    }

    const current = this.mapRow(rows[0])
    if (current.status === 'CONVERTED' && current.studentId) {
      // Idempotent return
      const existingStudent = await db.student.findUnique({ where: { id: current.studentId } })
      return { entry: current, student: existingStudent }
    }

    if (!['PARENT_ACCEPTED', 'READY_FOR_ADMISSION'].includes(current.status)) {
      throw new Error(`Cannot complete admission for entry in status ${current.status}. Must be PARENT_ACCEPTED or READY_FOR_ADMISSION.`)
    }

    // Execute atomic completion transaction using existing AdmissionService
    const enrollResult = await AdmissionService.completeEnrollment(
      ctx,
      current.applicationId,
      classroomId
    )

    // Only AFTER transaction success, update waiting list entry to CONVERTED
    await db.$executeRawUnsafe(
      `UPDATE waiting_list_entries SET 
        status = 'CONVERTED',
        converted_at = NOW(),
        student_id = $1,
        updated_at = NOW()
       WHERE id = $2`,
      enrollResult.student.id,
      entryId
    )

    // Audit log
    await db.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        actorId: ctx.actorId,
        actorName: ctx.actorName || 'Staff',
        actorRole: ctx.actorRole || 'ADMIN',
        action: 'WAITLIST_CONVERTED_TO_ADMISSION',
        entity: 'WaitingListEntry',
        entityId: entryId,
        summary: `Waiting list candidate ${current.childFirstName} converted to Student ${enrollResult.student.admissionNo}. Classroom allocated and parent portal initialized.`,
      },
    })

    const updatedRows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM waiting_list_entries WHERE id = $1 LIMIT 1`,
      entryId
    )
    return { entry: this.mapRow(updatedRows[0]), student: enrollResult.student }
  }

  /**
   * Withdraw candidate from Waiting List.
   */
  static async withdraw(
    ctx: ScopeContext,
    entryId: string,
    reason: string
  ): Promise<WaitingListEntryRecord> {
    await this.initSchema()

    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM waiting_list_entries WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
      entryId,
      ctx.tenantId
    )

    if (rows.length === 0) {
      throw new Error('Waiting list entry not found')
    }

    const current = this.mapRow(rows[0])
    if (current.status === 'CONVERTED') {
      throw new Error('Cannot withdraw candidate whose admission is already completed')
    }

    await db.$executeRawUnsafe(
      `UPDATE waiting_list_entries SET status = 'WITHDRAWN', parent_response_notes = $1, updated_at = NOW() WHERE id = $2`,
      reason,
      entryId
    )

    await db.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        actorId: ctx.actorId,
        actorName: ctx.actorName || 'Staff',
        actorRole: ctx.actorRole || 'ADMIN',
        action: 'WAITLIST_WITHDRAWN',
        entity: 'WaitingListEntry',
        entityId: entryId,
        summary: `Candidate ${current.childFirstName} withdrawn from waiting list. Reason: ${reason}`,
      },
    })

    const updatedRows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM waiting_list_entries WHERE id = $1 LIMIT 1`,
      entryId
    )
    return this.mapRow(updatedRows[0])
  }

  // =========================================================================
  // 6. QUERY & LEDGER LISTING
  // =========================================================================

  /**
   * List Waiting List ledger with full filtering, search, and dynamic queue ranking.
   */
  static async listWaitingList(
    ctx: ScopeContext,
    filters?: WaitingListFilters
  ): Promise<{
    entries: WaitingListEntryRecord[]
    total: number
    capacitySummaries: ProgramCapacitySummary[]
  }> {
    await this.initSchema()

    const conditions: string[] = ['tenant_id = $1', 'deleted_at IS NULL']
    const params: any[] = [ctx.tenantId]
    let paramIdx = 2

    if (filters?.branchId) {
      conditions.push(`branch_id = $${paramIdx++}`)
      params.push(filters.branchId)
    }

    if (filters?.academicSessionId) {
      conditions.push(`academic_session_id = $${paramIdx++}`)
      params.push(filters.academicSessionId)
    }

    if (filters?.programType && filters.programType !== 'ALL') {
      conditions.push(`program_type = $${paramIdx++}`)
      params.push(filters.programType)
    }

    if (filters?.status && filters.status !== 'ALL') {
      conditions.push(`status = $${paramIdx++}`)
      params.push(filters.status)
    }

    if (filters?.priority && filters.priority !== 'ALL') {
      conditions.push(`priority = $${paramIdx++}`)
      params.push(filters.priority)
    }

    if (filters?.search && filters.search.trim()) {
      const q = `%${filters.search.trim()}%`
      conditions.push(
        `(child_first_name ILIKE $${paramIdx} OR child_last_name ILIKE $${paramIdx} OR parent_name ILIKE $${paramIdx} OR parent_phone ILIKE $${paramIdx} OR application_number ILIKE $${paramIdx})`
      )
      params.push(q)
      paramIdx++
    }

    const whereClause = conditions.join(' AND ')

    const countRows = await db.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*)::text as count FROM waiting_list_entries WHERE ${whereClause}`,
      ...params
    )
    const total = parseInt(countRows[0]?.count || '0', 10)

    const limit = filters?.limit || 50
    const offset = filters?.offset || 0

    // Order: Priority (HIGH first), then waiting_since (FIFO), then created_at
    const query = `
      SELECT * FROM waiting_list_entries
      WHERE ${whereClause}
      ORDER BY 
        CASE WHEN priority = 'HIGH' THEN 0 ELSE 1 END ASC,
        waiting_since ASC,
        created_at ASC
      LIMIT ${limit} OFFSET ${offset}
    `

    const rows = await db.$queryRawUnsafe<any[]>(query, ...params)
    const entries = rows.map((r) => this.mapRow(r))

    // Calculate queue positions for active candidates
    for (const entry of entries) {
      entry.queuePosition = await this.calculateQueuePosition(entry)
    }

    // Capacity summaries
    const capacitySummaries = await this.getProgramCapacity(
      ctx.tenantId,
      filters?.branchId || ctx.branchId || '',
      filters?.academicSessionId || ctx.academicYearId || ''
    )

    return { entries, total, capacitySummaries }
  }

  /**
   * Get single Waiting List Entry with full inspector context (application, timeline, priority audits).
   */
  static async getWaitingListEntry(
    ctx: ScopeContext,
    id: string
  ): Promise<{
    entry: WaitingListEntryRecord
    application: any
    priorityAudits: any[]
    timeline: any[]
    capacity: ProgramCapacitySummary | null
  }> {
    await this.initSchema()

    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM waiting_list_entries WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
      id,
      ctx.tenantId
    )

    if (rows.length === 0) {
      throw new Error('Waiting list entry not found')
    }

    const entry = this.mapRow(rows[0])
    entry.queuePosition = await this.calculateQueuePosition(entry)

    const [application, priorityAudits, timeline, capList] = await Promise.all([
      db.admissionApplication.findUnique({
        where: { id: entry.applicationId },
        include: { documents: true, offers: true },
      }),
      db.$queryRawUnsafe<any[]>(
        `SELECT * FROM waiting_list_priority_audits WHERE waiting_list_entry_id = $1 ORDER BY created_at DESC`,
        id
      ),
      db.timelineEntry.findMany({
        where: {
          tenantId: ctx.tenantId,
          academicSessionId: entry.academicSessionId,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.getProgramCapacity(
        entry.tenantId,
        entry.branchId,
        entry.academicSessionId,
        entry.programType
      ),
    ])

    return {
      entry,
      application,
      priorityAudits,
      timeline,
      capacity: capList[0] || null,
    }
  }
}
