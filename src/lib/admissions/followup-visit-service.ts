/**
 * PreOne — M03 Admissions: Follow-up & School Visit Subsystem
 *
 * Operational Bridge:
 * Early Enquiry Intake
 *   ↓
 * First Outreach / Follow-up (NEW -> CONTACTED)
 *   ↓
 * School Visit Scheduled (CONTACTED -> QUALIFIED)
 *   ↓
 * Visit Executed & Child Interaction Recorded (Non-clinical preschool cues)
 *   ↓
 * Visit Outcome Evaluated:
 *   · READY_TO_PROCEED  -> Start Application (Zero data re-entry handoff)
 *   · CONSIDERING       -> Mandatory Next Follow-up Date
 *   · FUTURE_TERM       -> Move to NURTURE with wake-up date
 *   · NOT_PROCEEDING    -> Mark LOST with mandatory drop-off reason
 *   ↓
 * Non-Destructive Reschedule & Cancellation (History preserved)
 * Visit No-Show Handling (Automated Recovery Follow-up)
 */

import { db } from '@/lib/db'
import { audit } from '@/lib/sequence'
import { raiseFollowUp, FollowUpStatus } from '@/lib/followups'
import { LeadService, CANONICAL_LOST_REASONS, LostReasonCode } from '@/lib/admissions/lead-service'
import type { SchoolRole } from '@/lib/auth'

export type VisitOperationalStatus =
  | 'SCHEDULED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'RESCHEDULED'

export type VisitOutcomeType =
  | 'READY_TO_PROCEED'
  | 'CONSIDERING'
  | 'FUTURE_TERM'
  | 'NOT_PROCEEDING'

export interface ChildInteractionObservation {
  comfort?: 'COMFORTABLE' | 'TOOK_SOME_TIME' | 'NEEDED_SUPPORT'
  educatorInteraction?: 'ENGAGED' | 'LIMITED' | 'OBSERVED'
  communication?: 'COMFORTABLE' | 'SOME_INTERACTION' | 'LIMITED'
  activityResponse?: 'INTERESTED' | 'PARTICIPATED_WITH_SUPPORT' | 'OBSERVED_ONLY'
  separation?: 'COMFORTABLE' | 'NEEDED_SUPPORT' | 'NOT_OBSERVED'
  strengthsNotes?: string
  supportNotes?: string
}

export interface VisitStructuredDetail {
  visitStatus: VisitOperationalStatus
  visitorCount?: number
  attendees?: string
  tourFocus?: string
  notes?: string
  scheduledAt?: string
  childInteraction?: ChildInteractionObservation
  parentFeedback?: string
  staffNotes?: string
  outcome?: VisitOutcomeType
  outcomeDate?: string
  rescheduledTo?: string
  rescheduledFrom?: string
  rescheduleReason?: string
  cancellationReason?: string
  noShowNotes?: string
}

export interface ScopeContext {
  tenantId: string
  branchId?: string | null
  academicYearId?: string | null
  actorId?: string | null
  actorName?: string | null
  actorRole?: string | null
}

export class FollowUpVisitService {
  /**
   * Helper: Parse structured JSON detail safely with fallback
   */
  static parseVisitDetail(detail: string | null | undefined): VisitStructuredDetail {
    if (!detail) {
      return { visitStatus: 'SCHEDULED' }
    }
    try {
      const parsed = JSON.parse(detail)
      if (typeof parsed === 'object' && parsed !== null && parsed.visitStatus) {
        return parsed as VisitStructuredDetail
      }
    } catch {
      // Plain text detail fallback
    }
    return {
      visitStatus: 'SCHEDULED',
      notes: detail,
    }
  }

  /**
   * 1. Log an Enquiry Follow-up Action
   * Advances Lead from NEW -> CONTACTED on first outreach.
   * Updates Lead.nextFollowUpAt if dueAt is provided.
   */
  static async addFollowUp(
    ctx: ScopeContext,
    leadId: string,
    input: {
      type: string
      note: string
      dueAt?: Date | string
      outcome?: string
      responsibleRole?: SchoolRole
    }
  ) {
    if (!ctx.tenantId) throw new Error('Tenant context required')
    if (!input.note?.trim()) throw new Error('Note is required for follow-up')

    const lead = await db.lead.findFirst({
      where: { id: leadId, tenantId: ctx.tenantId, deletedAt: null },
    })
    if (!lead) throw new Error('Enquiry not found')

    const dueDateTime = input.dueAt ? new Date(input.dueAt) : new Date(Date.now() + 24 * 60 * 60 * 1000)

    const fu = await raiseFollowUp({
      tenantId: ctx.tenantId,
      branchId: ctx.branchId || lead.branchId,
      academicSessionId: ctx.academicYearId || lead.academicSessionId,
      domain: 'ADMISSION',
      severity: 'INFO',
      title: `${input.type || 'Phone Call'}: ${lead.childName || lead.parentName}`,
      detail: input.note.trim(),
      sourceType: 'EnquiryFollowUp',
      sourceId: leadId,
      dedupeKey: `enquiry-fu:${leadId}:${Date.now()}`,
      dueAt: dueDateTime,
      responsibleRole: input.responsibleRole || 'PRINCIPAL',
      actorId: ctx.actorId,
      actorName: ctx.actorName,
    })

    // Advance NEW -> CONTACTED on first follow-up
    let leadStatusUpdated = false
    const updateData: any = {}
    if (input.dueAt) {
      updateData.nextFollowUpAt = dueDateTime
    }
    if (lead.status === 'NEW') {
      updateData.status = 'CONTACTED'
      leadStatusUpdated = true
    }

    if (Object.keys(updateData).length > 0) {
      await db.lead.update({
        where: { id: leadId },
        data: updateData,
      })
    }

    // Immutable audit logs
    await audit({
      tenantId: ctx.tenantId,
      branchId: ctx.branchId || lead.branchId || undefined,
      academicSessionId: ctx.academicYearId || lead.academicSessionId || undefined,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'FOLLOWUP_CREATED',
      entity: 'Lead',
      entityId: leadId,
      summary: `Follow-up logged for ${lead.leadNumber} (${input.type || 'Phone Call'}): ${input.note.slice(0, 100)}`,
      newValues: { type: input.type, dueAt: dueDateTime, outcome: input.outcome },
    })

    if (leadStatusUpdated) {
      await audit({
        tenantId: ctx.tenantId,
        branchId: ctx.branchId || lead.branchId || undefined,
        academicSessionId: ctx.academicYearId || lead.academicSessionId || undefined,
        actorId: ctx.actorId,
        actorName: ctx.actorName,
        actorRole: ctx.actorRole,
        action: 'LEAD_STATUS_CHANGED',
        entity: 'Lead',
        entityId: leadId,
        summary: `Enquiry ${lead.leadNumber} transitioned from NEW to CONTACTED via outreach`,
        oldValues: { status: 'NEW' },
        newValues: { status: 'CONTACTED' },
      })
    }

    return fu
  }

  /**
   * 2. Schedule School Visit / Campus Tour
   * Advances Lead from CONTACTED (or NEW) -> QUALIFIED.
   * Sets Lead.nextFollowUpAt to scheduledAt.
   */
  static async scheduleVisit(
    ctx: ScopeContext,
    leadId: string,
    input: {
      scheduledAt: Date | string
      visitorCount?: number
      attendees?: string
      tourFocus?: string
      notes?: string
      assignedUserId?: string
    }
  ) {
    if (!ctx.tenantId) throw new Error('Tenant context required')
    if (!input.scheduledAt) throw new Error('Scheduled date and time is required')

    const lead = await db.lead.findFirst({
      where: { id: leadId, tenantId: ctx.tenantId, deletedAt: null },
    })
    if (!lead) throw new Error('Enquiry not found')

    const visitTime = new Date(input.scheduledAt)

    const structuredDetail: VisitStructuredDetail = {
      visitStatus: 'SCHEDULED',
      visitorCount: input.visitorCount || 2,
      attendees: input.attendees || 'Parents with Child',
      tourFocus: input.tourFocus || 'Classroom & Facilities Tour',
      notes: input.notes || '',
      scheduledAt: visitTime.toISOString(),
    }

    const fu = await raiseFollowUp({
      tenantId: ctx.tenantId,
      branchId: ctx.branchId || lead.branchId,
      academicSessionId: ctx.academicYearId || lead.academicSessionId,
      domain: 'ADMISSION',
      severity: 'INFO',
      title: `School Visit: ${lead.childName || lead.parentName}`,
      detail: JSON.stringify(structuredDetail),
      sourceType: 'SchoolVisit',
      sourceId: leadId,
      dedupeKey: `visit:${leadId}:${visitTime.toISOString().slice(0, 16)}`,
      dueAt: visitTime,
      responsibleRole: 'PRINCIPAL',
      actorId: ctx.actorId,
      actorName: ctx.actorName,
    })

    // Advance status to QUALIFIED if currently NEW or CONTACTED
    const leadUpdates: any = { nextFollowUpAt: visitTime }
    let statusChanged = false
    if (['NEW', 'CONTACTED'].includes(lead.status)) {
      leadUpdates.status = 'QUALIFIED'
      statusChanged = true
    }

    await db.lead.update({
      where: { id: leadId },
      data: leadUpdates,
    })

    await audit({
      tenantId: ctx.tenantId,
      branchId: ctx.branchId || lead.branchId || undefined,
      academicSessionId: ctx.academicYearId || lead.academicSessionId || undefined,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'SCHEDULE_VISIT',
      entity: 'Lead',
      entityId: leadId,
      summary: `School visit scheduled for ${lead.leadNumber} on ${visitTime.toLocaleString('en-IN')}`,
      newValues: {
        scheduledAt: visitTime.toISOString(),
        visitorCount: structuredDetail.visitorCount,
        attendees: structuredDetail.attendees,
      },
    })

    if (statusChanged) {
      await audit({
        tenantId: ctx.tenantId,
        branchId: ctx.branchId || lead.branchId || undefined,
        academicSessionId: ctx.academicYearId || lead.academicSessionId || undefined,
        actorId: ctx.actorId,
        actorName: ctx.actorName,
        actorRole: ctx.actorRole,
        action: 'LEAD_STATUS_CHANGED',
        entity: 'Lead',
        entityId: leadId,
        summary: `Enquiry ${lead.leadNumber} progressed to QUALIFIED upon visit scheduling`,
        oldValues: { status: lead.status },
        newValues: { status: 'QUALIFIED' },
      })
    }

    return fu
  }

  /**
   * 3. Complete School Visit & Record Child Interaction Observations + Visit Outcome
   *
   * Outcomes:
   *  · READY_TO_PROCEED  -> Auto-starts application (Zero data re-entry handoff)
   *  · CONSIDERING       -> Mandatory nextFollowUpAt scheduled
   *  · FUTURE_TERM       -> Moves Lead to NURTURE with wake-up date
   *  · NOT_PROCEEDING    -> Marks Lead LOST with mandatory lostReason
   */
  static async completeVisit(
    ctx: ScopeContext,
    visitId: string,
    input: {
      childInteraction?: ChildInteractionObservation
      parentFeedback?: string
      staffNotes?: string
      outcome: VisitOutcomeType
      nextFollowUpAt?: Date | string
      lostReason?: LostReasonCode | string
      autoStartApplication?: boolean
    }
  ) {
    if (!ctx.tenantId) throw new Error('Tenant context required')
    if (!input.outcome) throw new Error('Visit outcome is required')

    const visit = await db.followUp.findFirst({
      where: { id: visitId, tenantId: ctx.tenantId },
    })
    if (!visit) throw new Error('Visit record not found')

    const leadId = visit.sourceId
    if (!leadId) throw new Error('Visit record has no associated enquiry ID')

    const lead = await db.lead.findFirst({
      where: { id: leadId, tenantId: ctx.tenantId, deletedAt: null },
    })
    if (!lead) throw new Error('Enquiry associated with visit not found')

    // Validation per outcome
    if (input.outcome === 'CONSIDERING' && !input.nextFollowUpAt) {
      throw new Error('Next follow-up date is mandatory when family is considering')
    }
    if (input.outcome === 'FUTURE_TERM' && !input.nextFollowUpAt) {
      throw new Error('Wake-up / reminder date is mandatory for future term nurture')
    }
    if (input.outcome === 'NOT_PROCEEDING' && !input.lostReason) {
      throw new Error('Reason is mandatory when prospect is not proceeding')
    }

    // Merge existing detail with completion details
    const existing = this.parseVisitDetail(visit.detail)
    const completedDetail: VisitStructuredDetail = {
      ...existing,
      visitStatus: 'COMPLETED',
      childInteraction: input.childInteraction || existing.childInteraction,
      parentFeedback: input.parentFeedback || existing.parentFeedback,
      staffNotes: input.staffNotes || existing.staffNotes,
      outcome: input.outcome,
      outcomeDate: new Date().toISOString(),
    }

    // Update FollowUp record as RESOLVED
    const updatedVisit = await db.followUp.update({
      where: { id: visitId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedByName: ctx.actorName || 'Staff',
        outcome: input.outcome,
        actionTaken: `Visit completed. Outcome: ${input.outcome}`,
        detail: JSON.stringify(completedDetail),
      },
    })

    // Execute outcome action on Lead
    let applicationResult: any = null

    if (input.outcome === 'READY_TO_PROCEED') {
      // Handoff to Admission Application with zero data re-entry
      if (lead.status !== 'APPLICATION_STARTED' && lead.status !== 'CONVERTED') {
        applicationResult = await LeadService.startApplication(
          {
            tenantId: ctx.tenantId,
            branchId: ctx.branchId || lead.branchId,
            academicYearId: ctx.academicYearId || lead.academicSessionId,
            actorId: ctx.actorId,
            actorName: ctx.actorName,
            actorRole: ctx.actorRole,
          },
          leadId
        )
      }
    } else if (input.outcome === 'CONSIDERING') {
      const nextDate = new Date(input.nextFollowUpAt!)
      await db.lead.update({
        where: { id: leadId },
        data: { nextFollowUpAt: nextDate },
      })
      // Auto-schedule follow-up task
      await raiseFollowUp({
        tenantId: ctx.tenantId,
        branchId: ctx.branchId || lead.branchId,
        academicSessionId: ctx.academicYearId || lead.academicSessionId,
        domain: 'ADMISSION',
        severity: 'INFO',
        title: `Decision Follow-up: ${lead.childName || lead.parentName}`,
        detail: `Parent is considering admission after campus tour. Notes: ${input.staffNotes || input.parentFeedback || ''}`,
        sourceType: 'EnquiryFollowUp',
        sourceId: leadId,
        dedupeKey: `enquiry-decision-fu:${leadId}:${nextDate.toISOString().slice(0, 10)}`,
        dueAt: nextDate,
        responsibleRole: 'PRINCIPAL',
        actorId: ctx.actorId,
        actorName: ctx.actorName,
      })
    } else if (input.outcome === 'FUTURE_TERM') {
      const wakeUpDate = new Date(input.nextFollowUpAt!)
      await db.lead.update({
        where: { id: leadId },
        data: {
          status: 'NURTURE',
          nextFollowUpAt: wakeUpDate,
        },
      })
      await audit({
        tenantId: ctx.tenantId,
        branchId: ctx.branchId || lead.branchId || undefined,
        academicSessionId: ctx.academicYearId || lead.academicSessionId || undefined,
        actorId: ctx.actorId,
        actorName: ctx.actorName,
        actorRole: ctx.actorRole,
        action: 'LEAD_STATUS_CHANGED',
        entity: 'Lead',
        entityId: leadId,
        summary: `Enquiry ${lead.leadNumber} moved to NURTURE (Future Term) with reminder on ${wakeUpDate.toLocaleDateString('en-IN')}`,
        oldValues: { status: lead.status },
        newValues: { status: 'NURTURE', nextFollowUpAt: wakeUpDate },
      })
    } else if (input.outcome === 'NOT_PROCEEDING') {
      await LeadService.markLost(
        {
          tenantId: ctx.tenantId,
          branchId: ctx.branchId || lead.branchId,
          academicYearId: ctx.academicYearId || lead.academicSessionId,
          actorId: ctx.actorId,
          actorName: ctx.actorName,
          actorRole: ctx.actorRole,
        },
        leadId,
        input.lostReason as LostReasonCode,
        input.staffNotes || input.parentFeedback || 'Decided not to proceed after school visit'
      )
    }

    await audit({
      tenantId: ctx.tenantId,
      branchId: ctx.branchId || lead.branchId || undefined,
      academicSessionId: ctx.academicYearId || lead.academicSessionId || undefined,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'VISIT_COMPLETED',
      entity: 'FollowUp',
      entityId: visitId,
      summary: `School visit completed for ${lead.leadNumber}. Outcome: ${input.outcome}`,
      newValues: {
        outcome: input.outcome,
        childInteraction: input.childInteraction,
        parentFeedback: input.parentFeedback,
        staffNotes: input.staffNotes,
        applicationCreated: Boolean(applicationResult),
      },
    })

    return {
      visit: updatedVisit,
      parsedDetail: completedDetail,
      leadId,
      application: applicationResult?.application || null,
      applicationId: applicationResult?.applicationId || null,
      applicationNumber: applicationResult?.applicationNumber || null,
    }
  }

  /**
   * 4. Record Visit No-Show
   * Updates visit status to NO_SHOW.
   * Keeps Lead active in QUALIFIED state.
   * Automatically schedules next-day recovery call.
   */
  static async recordVisitNoShow(
    ctx: ScopeContext,
    visitId: string,
    input?: {
      notes?: string
      recoveryCallDueAt?: Date | string
    }
  ) {
    if (!ctx.tenantId) throw new Error('Tenant context required')

    const visit = await db.followUp.findFirst({
      where: { id: visitId, tenantId: ctx.tenantId },
    })
    if (!visit) throw new Error('Visit record not found')

    const leadId = visit.sourceId
    if (!leadId) throw new Error('Visit record has no associated enquiry ID')

    const lead = await db.lead.findFirst({
      where: { id: leadId, tenantId: ctx.tenantId, deletedAt: null },
    })
    if (!lead) throw new Error('Enquiry not found')

    const existing = this.parseVisitDetail(visit.detail)
    const updatedDetail: VisitStructuredDetail = {
      ...existing,
      visitStatus: 'NO_SHOW',
      noShowNotes: input?.notes || 'Family did not arrive for scheduled school visit',
    }

    const updatedVisit = await db.followUp.update({
      where: { id: visitId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedByName: ctx.actorName || 'Staff',
        outcome: 'NO_SHOW',
        actionTaken: 'Marked as No-Show. Recovery outreach scheduled.',
        detail: JSON.stringify(updatedDetail),
      },
    })

    // Recovery call due tomorrow morning (+24h default)
    const recoveryDue = input?.recoveryCallDueAt
      ? new Date(input.recoveryCallDueAt)
      : new Date(Date.now() + 24 * 60 * 60 * 1000)

    await db.lead.update({
      where: { id: leadId },
      data: { nextFollowUpAt: recoveryDue },
    })

    // Raise recovery follow-up task
    const recoveryTask = await raiseFollowUp({
      tenantId: ctx.tenantId,
      branchId: ctx.branchId || lead.branchId,
      academicSessionId: ctx.academicYearId || lead.academicSessionId,
      domain: 'ADMISSION',
      severity: 'WARNING',
      title: `No-Show Recovery Call: ${lead.childName || lead.parentName}`,
      detail: `Family missed school visit scheduled for ${visit.dueAt ? new Date(visit.dueAt).toLocaleString('en-IN') : 'earlier'}. Call parent to check in and offer rescheduling.`,
      sourceType: 'EnquiryFollowUp',
      sourceId: leadId,
      dedupeKey: `recovery-fu:${leadId}:${Date.now()}`,
      dueAt: recoveryDue,
      responsibleRole: 'PRINCIPAL',
      actorId: ctx.actorId,
      actorName: ctx.actorName,
    })

    await audit({
      tenantId: ctx.tenantId,
      branchId: ctx.branchId || lead.branchId || undefined,
      academicSessionId: ctx.academicYearId || lead.academicSessionId || undefined,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'VISIT_NO_SHOW',
      entity: 'FollowUp',
      entityId: visitId,
      summary: `School visit for ${lead.leadNumber} marked NO-SHOW. Recovery call scheduled for ${recoveryDue.toLocaleDateString('en-IN')}`,
      newValues: { recoveryFollowUpId: recoveryTask.followUp.id, dueAt: recoveryDue },
    })

    return {
      visit: updatedVisit,
      recoveryFollowUp: recoveryTask.followUp,
    }
  }

  /**
   * 5. Reschedule School Visit (Non-Destructive)
   * Marks original visit as RESCHEDULED.
   * Creates brand new visit with new date and preserves cross-reference.
   * Updates Lead.nextFollowUpAt.
   */
  static async rescheduleVisit(
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
    if (!ctx.tenantId) throw new Error('Tenant context required')
    if (!input.newScheduledAt) throw new Error('New scheduled date and time is required')

    const visit = await db.followUp.findFirst({
      where: { id: visitId, tenantId: ctx.tenantId },
    })
    if (!visit) throw new Error('Visit record not found')

    const leadId = visit.sourceId
    if (!leadId) throw new Error('Visit record has no associated enquiry ID')

    const lead = await db.lead.findFirst({
      where: { id: leadId, tenantId: ctx.tenantId, deletedAt: null },
    })
    if (!lead) throw new Error('Enquiry not found')

    const newVisitTime = new Date(input.newScheduledAt)
    const existing = this.parseVisitDetail(visit.detail)

    // 1. Mark existing visit as RESCHEDULED
    const updatedOldDetail: VisitStructuredDetail = {
      ...existing,
      visitStatus: 'RESCHEDULED',
      rescheduledTo: newVisitTime.toISOString(),
      rescheduleReason: input.reason || 'Parent requested new visit timing',
    }

    await db.followUp.update({
      where: { id: visitId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedByName: ctx.actorName || 'Staff',
        outcome: 'RESCHEDULED',
        actionTaken: `Rescheduled to ${newVisitTime.toLocaleString('en-IN')}`,
        detail: JSON.stringify(updatedOldDetail),
      },
    })

    // 2. Create new visit
    const newStructuredDetail: VisitStructuredDetail = {
      visitStatus: 'SCHEDULED',
      visitorCount: input.visitorCount || existing.visitorCount || 2,
      attendees: input.attendees || existing.attendees || 'Parents with Child',
      tourFocus: input.tourFocus || existing.tourFocus || 'Campus Tour',
      rescheduledFrom: visitId,
      rescheduleReason: input.reason,
      scheduledAt: newVisitTime.toISOString(),
    }

    const newVisit = await raiseFollowUp({
      tenantId: ctx.tenantId,
      branchId: ctx.branchId || lead.branchId,
      academicSessionId: ctx.academicYearId || lead.academicSessionId,
      domain: 'ADMISSION',
      severity: 'INFO',
      title: `School Visit (Rescheduled): ${lead.childName || lead.parentName}`,
      detail: JSON.stringify(newStructuredDetail),
      sourceType: 'SchoolVisit',
      sourceId: leadId,
      dedupeKey: `visit:${leadId}:${newVisitTime.toISOString().slice(0, 16)}`,
      dueAt: newVisitTime,
      responsibleRole: 'PRINCIPAL',
      actorId: ctx.actorId,
      actorName: ctx.actorName,
    })

    // 3. Update Lead nextFollowUpAt pointer
    await db.lead.update({
      where: { id: leadId },
      data: { nextFollowUpAt: newVisitTime },
    })

    await audit({
      tenantId: ctx.tenantId,
      branchId: ctx.branchId || lead.branchId || undefined,
      academicSessionId: ctx.academicYearId || lead.academicSessionId || undefined,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'VISIT_RESCHEDULED',
      entity: 'FollowUp',
      entityId: visitId,
      summary: `School visit for ${lead.leadNumber} rescheduled to ${newVisitTime.toLocaleString('en-IN')}. Reason: ${input.reason || 'None given'}`,
      newValues: {
        originalVisitId: visitId,
        newVisitId: newVisit.followUp.id,
        newScheduledAt: newVisitTime.toISOString(),
        reason: input.reason,
      },
    })

    return {
      originalVisitId: visitId,
      newVisit: newVisit.followUp,
    }
  }

  /**
   * 6. Cancel School Visit (Non-Destructive)
   * Marks visit as CANCELLED with reason.
   * If re-contact date provided, sets follow-up task.
   */
  static async cancelVisit(
    ctx: ScopeContext,
    visitId: string,
    input: {
      reason: string
      nextFollowUpAt?: Date | string
    }
  ) {
    if (!ctx.tenantId) throw new Error('Tenant context required')
    if (!input.reason?.trim()) throw new Error('Cancellation reason is required')

    const visit = await db.followUp.findFirst({
      where: { id: visitId, tenantId: ctx.tenantId },
    })
    if (!visit) throw new Error('Visit record not found')

    const leadId = visit.sourceId
    if (!leadId) throw new Error('Visit record has no associated enquiry ID')

    const lead = await db.lead.findFirst({
      where: { id: leadId, tenantId: ctx.tenantId, deletedAt: null },
    })
    if (!lead) throw new Error('Enquiry not found')

    const existing = this.parseVisitDetail(visit.detail)
    const cancelledDetail: VisitStructuredDetail = {
      ...existing,
      visitStatus: 'CANCELLED',
      cancellationReason: input.reason.trim(),
    }

    const updatedVisit = await db.followUp.update({
      where: { id: visitId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedByName: ctx.actorName || 'Staff',
        outcome: 'CANCELLED',
        actionTaken: `Cancelled: ${input.reason.trim()}`,
        detail: JSON.stringify(cancelledDetail),
      },
    })

    // If future contact requested
    if (input.nextFollowUpAt) {
      const nextDate = new Date(input.nextFollowUpAt)
      await db.lead.update({
        where: { id: leadId },
        data: { nextFollowUpAt: nextDate },
      })
      await raiseFollowUp({
        tenantId: ctx.tenantId,
        branchId: ctx.branchId || lead.branchId,
        academicSessionId: ctx.academicYearId || lead.academicSessionId,
        domain: 'ADMISSION',
        severity: 'INFO',
        title: `Re-contact after visit cancellation: ${lead.childName || lead.parentName}`,
        detail: `Visit cancelled due to: ${input.reason}. Re-connect with family to plan another visit.`,
        sourceType: 'EnquiryFollowUp',
        sourceId: leadId,
        dedupeKey: `cancel-recovery:${leadId}:${nextDate.toISOString().slice(0, 10)}`,
        dueAt: nextDate,
        responsibleRole: 'PRINCIPAL',
        actorId: ctx.actorId,
        actorName: ctx.actorName,
      })
    }

    await audit({
      tenantId: ctx.tenantId,
      branchId: ctx.branchId || lead.branchId || undefined,
      academicSessionId: ctx.academicYearId || lead.academicSessionId || undefined,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'VISIT_CANCELLED',
      entity: 'FollowUp',
      entityId: visitId,
      summary: `School visit for ${lead.leadNumber} cancelled. Reason: ${input.reason}`,
      newValues: { reason: input.reason, nextFollowUpAt: input.nextFollowUpAt },
    })

    return updatedVisit
  }

  /**
   * 7. Get Visit Details (Structured)
   */
  static async getVisitDetails(tenantId: string, visitId: string) {
    const visit = await db.followUp.findFirst({
      where: { id: visitId, tenantId },
    })
    if (!visit) throw new Error('Visit not found')

    const parsedDetail = this.parseVisitDetail(visit.detail)

    let lead: any = null
    let history: any[] = []

    if (visit.sourceId) {
      lead = await db.lead.findFirst({
        where: { id: visit.sourceId, tenantId, deletedAt: null },
      })
      history = await db.followUp.findMany({
        where: { tenantId, sourceId: visit.sourceId },
        orderBy: { createdAt: 'desc' },
      })
    }

    return {
      visit: {
        ...visit,
        parsedDetail,
      },
      lead,
      history: history.map((h) => ({
        ...h,
        parsedDetail: this.parseVisitDetail(h.detail),
      })),
    }
  }

  /**
   * 8. List Follow-ups & Visits Workspace Queues
   * Supports: DUE_TODAY, OVERDUE, UPCOMING, COMPLETED
   * Returns exact metrics counts for preschool daily dashboard.
   */
  static async listWorkspaceQueues(
    tenantId: string,
    params?: {
      branchId?: string
      queue?: 'DUE_TODAY' | 'OVERDUE' | 'UPCOMING' | 'COMPLETED'
      limit?: number
    }
  ) {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    const baseWhere: any = {
      tenantId,
      domain: 'ADMISSION',
      sourceType: { in: ['SchoolVisit', 'EnquiryFollowUp'] },
    }
    if (params?.branchId) {
      baseWhere.branchId = params.branchId
    }

    // Fetch all relevant admission follow-ups to compute accurate counts & active lists
    const allRecords = await db.followUp.findMany({
      where: baseWhere,
      orderBy: { dueAt: 'asc' },
      take: 500,
    })

    // Fetch associated leads
    const leadIds = Array.from(new Set(allRecords.map((r) => r.sourceId).filter(Boolean))) as string[]
    const leads = await db.lead.findMany({
      where: { id: { in: leadIds }, deletedAt: null },
    })
    const leadMap = new Map<string, any>(leads.map((l) => [l.id, l]))

    const enrichedRecords = allRecords.map((r) => {
      const parsed = this.parseVisitDetail(r.detail)
      const lead = r.sourceId ? leadMap.get(r.sourceId) : null
      return {
        ...r,
        parsedDetail: parsed,
        lead: lead
          ? {
              id: lead.id,
              leadNumber: lead.leadNumber,
              parentName: lead.parentName,
              phone: lead.phone,
              email: lead.email,
              childName: lead.childName,
              childDob: lead.childDob,
              status: lead.status,
              interestedProgram: lead.interestedProgram,
            }
          : null,
      }
    })

    // Operational Buckets:
    // DUE_TODAY: OPEN items with dueAt <= endOfToday
    const dueToday = enrichedRecords.filter((r) => {
      if (r.status !== 'OPEN') return false
      if (!r.dueAt) return true
      return new Date(r.dueAt) <= endOfToday
    })

    // OVERDUE: OPEN items with dueAt < startOfToday
    const overdue = enrichedRecords.filter((r) => {
      if (r.status !== 'OPEN') return false
      if (!r.dueAt) return false
      return new Date(r.dueAt) < startOfToday
    })

    // UPCOMING: OPEN visits with dueAt > now
    const upcomingVisits = enrichedRecords.filter((r) => {
      if (r.sourceType !== 'SchoolVisit') return false
      if (r.status !== 'OPEN') return false
      if (!r.dueAt) return false
      return new Date(r.dueAt) > now
    })

    // COMPLETED: RESOLVED items
    const completed = enrichedRecords.filter((r) => ['RESOLVED', 'CLOSED'].includes(r.status))

    const counts = {
      dueToday: dueToday.length,
      overdue: overdue.length,
      upcomingVisits: upcomingVisits.length,
      completed: completed.length,
    }

    let items = dueToday
    if (params?.queue === 'OVERDUE') items = overdue
    else if (params?.queue === 'UPCOMING') items = upcomingVisits
    else if (params?.queue === 'COMPLETED') items = completed

    return {
      counts,
      items: params?.limit ? items.slice(0, params.limit) : items,
    }
  }
}
