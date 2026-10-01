/**
 * PreOne — M03 Admissions: Follow-up & School Visit Subsystem
 * Comprehensive Acceptance & Regression Test Suite
 *
 * Validates:
 * 1. Setup & Multi-Tenant Isolation
 * 2. Enquiry First Outreach (NEW -> CONTACTED)
 * 3. School Visit Scheduling (CONTACTED -> QUALIFIED)
 * 4. Structured Preschool Child Interaction Observation Recording
 * 5. Visit Outcome Evaluation:
 *    - READY_TO_PROCEED: Zero Data Re-entry Handoff to Admission Application
 *    - CONSIDERING: Enforces Next Follow-up Date & Task Scheduling
 *    - FUTURE_TERM: Transition to NURTURE with Wake-up Date
 *    - NOT_PROCEEDING: Enforces Mandatory Lost Reason & Transition to LOST
 * 6. Non-Destructive Visit Rescheduling (History Preserved, Cross-Referenced)
 * 7. Non-Destructive Visit Cancellation (Reason Captured, Optional Re-contact Reminder)
 * 8. Visit No-Show Handling (Preserves Active Lead, Automated Recovery Outreach Task)
 * 9. Daily Workspace Queues (DUE_TODAY, OVERDUE, UPCOMING, COMPLETED) & Counter Accuracy
 * 10. Immutable Audit Trail for all Operations
 */

import { db } from '../src/lib/db'
import { AdmissionService } from '../src/lib/admissions/admission-service'
import { FollowUpVisitService } from '../src/lib/admissions/followup-visit-service'
import { LeadService } from '../src/lib/admissions/lead-service'

let passed = 0
let failed = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++
    console.log(`  ✓ ${msg}`)
  } else {
    failed++
    console.error(`  ✗ FAIL: ${msg}`)
  }
}

async function runTests() {
  console.log('====================================================================')
  console.log('PREONE M03 FOLLOW-UP & SCHOOL VISIT SUBSYSTEM: ACCEPTANCE SUITE')
  console.log('====================================================================')

  const timestamp = Date.now().toString().slice(-6)
  const tenantSlug = `sch-visit-${timestamp}`

  // [1] Multi-Tenant & Academic Foundation
  console.log('\n[1] Foundation & School Setup')
  const tenant = await db.tenant.create({
    data: {
      name: `Preschool Visit Academy ${timestamp}`,
      code: `VISIT-${timestamp}`,
      status: 'ACTIVE',
    },
  })
  const branch = await db.branch.create({
    data: {
      tenantId: tenant.id,
      name: 'Main Campus',
      code: `MC${timestamp}`,
    },
  })
  const session = await db.academicSession.create({
    data: {
      tenantId: tenant.id,
      name: 'Academic Year 2026-27',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2027-04-30'),
      isCurrent: true,
    },
  })

  // Setup PLAYGROUP and NURSERY programs
  const playgroup = await db.program.create({
    data: {
      tenantId: tenant.id,
      name: 'Playgroup',
      code: 'PLAYGROUP',
      programType: 'PLAYGROUP',
      ageMinMonths: 24,
      ageMaxMonths: 36,
      isActive: true,
    },
  })
  const nursery = await db.program.create({
    data: {
      tenantId: tenant.id,
      name: 'Nursery',
      code: 'NURSERY',
      programType: 'NURSERY',
      ageMinMonths: 36,
      ageMaxMonths: 48,
      isActive: true,
    },
  })

  const ctx = {
    tenantId: tenant.id,
    branchId: branch.id,
    academicYearId: session.id,
    actorId: 'counselor-1',
    actorName: 'Admissions Counselor Priya',
    actorRole: 'COUNSELOR',
  }

  assert(tenant.id !== undefined, 'Tenant master created')
  assert(branch.id !== undefined, 'Branch master created')
  assert(session.id !== undefined, 'Academic session created')
  assert(playgroup.id !== undefined, 'Playgroup program created')
  assert(nursery.id !== undefined, 'Nursery program created')

  // [2] Enquiry First Outreach (NEW -> CONTACTED)
  console.log('\n[2] Enquiry First Outreach & Status Progression')
  const enq1Res = await LeadService.createLead(ctx, {
    parentName: 'Sneha Patel',
    phone: '9820011223',
    email: 'sneha.patel@example.com',
    childName: 'Reyan Patel',
    childDob: new Date('2024-03-15'),
    interestedProgram: 'PLAYGROUP',
    source: 'WEBSITE',
    notes: 'Interested in morning playgroup batch',
  })
  const enq1 = enq1Res.lead
  assert(enq1.status === 'NEW', 'Enquiry initialized in NEW status')

  const fu1 = await AdmissionService.addEnquiryFollowUp(ctx, enq1.id, {
    type: 'Phone Call',
    note: 'First phone outreach. Discussed playgroup timing and curriculum.',
    dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  })
  assert(fu1.created === true, 'First follow-up task created')

  const enq1AfterFU = await db.lead.findUnique({ where: { id: enq1.id } })
  assert(enq1AfterFU?.status === 'CONTACTED', 'Enquiry auto-progressed from NEW to CONTACTED on first outreach')
  assert(enq1AfterFU?.nextFollowUpAt !== null, 'Enquiry nextFollowUpAt pointer updated')

  // [3] School Visit Scheduling (CONTACTED -> QUALIFIED)
  console.log('\n[3] School Visit Scheduling & Progression to QUALIFIED')
  const visitDate1 = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  const visit1 = await AdmissionService.scheduleSchoolVisit(ctx, enq1.id, {
    scheduledAt: visitDate1,
    visitorCount: 3,
    attendees: 'Both parents with Reyan',
    tourFocus: 'Playgroup classroom, sensory zone, and playground',
    notes: 'Parents want to see outdoor play area and meet head educator',
  })
  assert(visit1.created === true, 'School visit scheduled via FollowUp aggregate')

  const enq1AfterVisit = await db.lead.findUnique({ where: { id: enq1.id } })
  assert(enq1AfterVisit?.status === 'QUALIFIED', 'Enquiry auto-progressed to QUALIFIED upon visit scheduling')
  assert(enq1AfterVisit?.nextFollowUpAt?.getTime() === visitDate1.getTime(), 'Enquiry nextFollowUpAt aligned with visit time')

  const visitDetails1 = await AdmissionService.getVisitDetails(tenant.id, visit1.followUp.id)
  assert(visitDetails1.visit.parsedDetail.visitStatus === 'SCHEDULED', 'Structured visit detail parsed correctly')
  assert(visitDetails1.visit.parsedDetail.visitorCount === 3, 'Visitor count stored accurately')
  assert(visitDetails1.visit.parsedDetail.tourFocus?.includes('sensory zone') === true, 'Tour focus preserved')

  // [4] Complete School Visit with READY_TO_PROCEED (Zero Data Re-entry to Application)
  console.log('\n[4] Complete Visit: READY_TO_PROCEED & Zero Data Re-entry Application Handoff')
  const completeRes1 = await AdmissionService.completeSchoolVisit(ctx, visit1.followUp.id, {
    childInteraction: {
      comfort: 'COMFORTABLE',
      educatorInteraction: 'ENGAGED',
      communication: 'COMFORTABLE',
      activityResponse: 'INTERESTED',
      separation: 'COMFORTABLE',
      strengthsNotes: 'Very curious, quickly explored blocks and story corner',
      supportNotes: 'None noted',
    },
    parentFeedback: 'Loved the classroom atmosphere and small batch size',
    staffNotes: 'Recommended for Morning Playgroup Batch A',
    outcome: 'READY_TO_PROCEED',
  })

  assert(completeRes1.visit.status === 'RESOLVED', 'Visit FollowUp record marked RESOLVED')
  assert(completeRes1.parsedDetail.visitStatus === 'COMPLETED', 'Visit operational status is COMPLETED')
  assert(completeRes1.parsedDetail.outcome === 'READY_TO_PROCEED', 'Visit outcome recorded as READY_TO_PROCEED')
  assert(completeRes1.applicationId !== null, 'Admission application automatically created with zero data re-entry')
  assert(completeRes1.applicationNumber?.startsWith('ADM-') === true, 'Valid application number generated')

  const enq1Completed = await db.lead.findUnique({ where: { id: enq1.id } })
  assert(enq1Completed?.status === 'APPLICATION_STARTED', 'Enquiry transitioned to APPLICATION_STARTED')
  assert(enq1Completed?.convertedApplicationId === completeRes1.applicationId, 'Bi-directional pointer convertedApplicationId linked')

  const appCreated = await db.admissionApplication.findUnique({ where: { id: completeRes1.applicationId } })
  assert(appCreated?.childFirstName === 'Reyan', 'Child first name auto-copied without re-typing')
  assert(appCreated?.parentPhone === '9820011223', 'Parent phone auto-copied without re-typing')
  assert(appCreated?.programType === 'PLAYGROUP', 'Program type auto-copied without re-typing')

  // [5] School Visit Outcome: CONSIDERING (Enforces Next Follow-up Date)
  console.log('\n[5] Visit Outcome: CONSIDERING & Next Follow-up Guard')
  const enq2Res = await LeadService.createLead(ctx, {
    parentName: 'Vikram Malhotra',
    phone: '9833445566',
    childName: 'Ananya Malhotra',
    childDob: new Date('2022-08-15'),
    interestedProgram: 'NURSERY',
    source: 'REFERRAL',
  })
  const visit2 = await AdmissionService.scheduleSchoolVisit(ctx, enq2Res.lead.id, {
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })

  let consideringErrorCaught = false
  try {
    await AdmissionService.completeSchoolVisit(ctx, visit2.followUp.id, {
      outcome: 'CONSIDERING',
      // omitting nextFollowUpAt intentionally to test guard
    })
  } catch (err: any) {
    consideringErrorCaught = true
  }
  assert(consideringErrorCaught, 'Enforces next follow-up date when family is CONSIDERING')

  const nextFollowUpDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)
  const completeRes2 = await AdmissionService.completeSchoolVisit(ctx, visit2.followUp.id, {
    outcome: 'CONSIDERING',
    nextFollowUpAt: nextFollowUpDate,
    staffNotes: 'Parent comparing with another school closer to residence',
  })
  assert(completeRes2.visit.status === 'RESOLVED', 'Visit marked completed with CONSIDERING')

  const enq2After = await db.lead.findUnique({ where: { id: enq2Res.lead.id } })
  assert(enq2After?.status === 'QUALIFIED', 'Lead remains active in QUALIFIED state')
  assert(enq2After?.nextFollowUpAt?.getTime() === nextFollowUpDate.getTime(), 'Next follow-up date updated on Lead')

  // [6] School Visit Outcome: FUTURE_TERM (Moves to NURTURE with Wake-up Date)
  console.log('\n[6] Visit Outcome: FUTURE_TERM (Transition to NURTURE)')
  const enq3Res = await LeadService.createLead(ctx, {
    parentName: 'Deepa Rao',
    phone: '9811223344',
    childName: 'Kabir Rao',
    childDob: new Date('2024-02-10'), // Young child
    interestedProgram: 'PLAYGROUP',
  })
  const visit3 = await AdmissionService.scheduleSchoolVisit(ctx, enq3Res.lead.id, {
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })

  const wakeUpDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 3 months later
  await AdmissionService.completeSchoolVisit(ctx, visit3.followUp.id, {
    outcome: 'FUTURE_TERM',
    nextFollowUpAt: wakeUpDate,
    staffNotes: 'Child will be age-eligible in Term 2 (October)',
  })

  const enq3After = await db.lead.findUnique({ where: { id: enq3Res.lead.id } })
  assert(enq3After?.status === 'NURTURE', 'Lead transitioned to NURTURE for future term')
  assert(enq3After?.nextFollowUpAt?.getTime() === wakeUpDate.getTime(), 'Wake-up date recorded on Lead')

  // [7] School Visit Outcome: NOT_PROCEEDING (Mandatory Drop-off Reason & LOST Transition)
  console.log('\n[7] Visit Outcome: NOT_PROCEEDING (Mandatory Reason & LOST Transition)')
  const enq4Res = await LeadService.createLead(ctx, {
    parentName: 'Manish Verma',
    phone: '9877001122',
    childName: 'Rohan Verma',
    childDob: new Date('2022-05-20'),
    interestedProgram: 'NURSERY',
  })
  const visit4 = await AdmissionService.scheduleSchoolVisit(ctx, enq4Res.lead.id, {
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })

  let lostReasonGuardCaught = false
  try {
    await AdmissionService.completeSchoolVisit(ctx, visit4.followUp.id, {
      outcome: 'NOT_PROCEEDING',
      // omitting lostReason intentionally
    })
  } catch (err: any) {
    lostReasonGuardCaught = true
  }
  assert(lostReasonGuardCaught, 'Enforces mandatory reason when family is NOT_PROCEEDING')

  await AdmissionService.completeSchoolVisit(ctx, visit4.followUp.id, {
    outcome: 'NOT_PROCEEDING',
    lostReason: 'LOCATION',
    staffNotes: 'Family relocating to another city next month',
  })

  const enq4After = await db.lead.findUnique({ where: { id: enq4Res.lead.id } })
  assert(enq4After?.status === 'LOST', 'Lead marked LOST')
  assert(enq4After?.notes?.includes('LOCATION') === true, 'Lost reason preserved in notes')

  // [8] Non-Destructive Visit Rescheduling
  console.log('\n[8] Non-Destructive Visit Rescheduling')
  const enq5Res = await LeadService.createLead(ctx, {
    parentName: 'Ananya Gupta',
    phone: '9844556677',
    childName: 'Vivaan Gupta',
    childDob: new Date('2024-04-10'),
    interestedProgram: 'PLAYGROUP',
  })
  const initialVisitTime = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const visit5Initial = await AdmissionService.scheduleSchoolVisit(ctx, enq5Res.lead.id, {
    scheduledAt: initialVisitTime,
  })

  const newVisitTime = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
  const rescheduleRes = await AdmissionService.rescheduleSchoolVisit(ctx, visit5Initial.followUp.id, {
    newScheduledAt: newVisitTime,
    reason: 'Parent has an urgent work commitment; requested weekend slot',
  })

  assert(rescheduleRes.originalVisitId === visit5Initial.followUp.id, 'Original visit preserved')
  assert(rescheduleRes.newVisit.id !== visit5Initial.followUp.id, 'New distinct visit record created')

  // Verify historical record integrity
  const oldVisitInDb = await db.followUp.findUnique({ where: { id: visit5Initial.followUp.id } })
  assert(oldVisitInDb?.outcome === 'RESCHEDULED', 'Old visit marked RESCHEDULED')
  const oldParsed = FollowUpVisitService.parseVisitDetail(oldVisitInDb?.detail)
  assert(oldParsed.visitStatus === 'RESCHEDULED', 'Old visit detail status updated')
  assert(oldParsed.rescheduledTo === newVisitTime.toISOString(), 'Cross reference to new visit date preserved')

  // Verify new visit
  const newVisitInDb = await db.followUp.findUnique({ where: { id: rescheduleRes.newVisit.id } })
  assert(newVisitInDb?.status === 'OPEN', 'New visit is OPEN')
  assert(newVisitInDb?.dueAt?.getTime() === newVisitTime.getTime(), 'New visit scheduled at requested time')

  const enq5After = await db.lead.findUnique({ where: { id: enq5Res.lead.id } })
  assert(enq5After?.nextFollowUpAt?.getTime() === newVisitTime.getTime(), 'Lead pointer aligned with new visit date')

  // [9] Visit No-Show & Automated Recovery Outreach
  console.log('\n[9] Visit No-Show & Automated Recovery Outreach')
  const enq6Res = await LeadService.createLead(ctx, {
    parentName: 'Rohit Kulkarni',
    phone: '9866778899',
    childName: 'Tara Kulkarni',
    childDob: new Date('2022-11-05'),
    interestedProgram: 'NURSERY',
  })
  const visit6 = await AdmissionService.scheduleSchoolVisit(ctx, enq6Res.lead.id, {
    scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Scheduled 2 hours ago
  })

  const noShowRes = await AdmissionService.recordVisitNoShow(ctx, visit6.followUp.id, {
    notes: 'Family did not arrive and phone was temporarily unreachable',
  })

  assert(noShowRes.visit.outcome === 'NO_SHOW', 'Visit recorded as NO_SHOW')
  assert(noShowRes.recoveryFollowUp.id !== undefined, 'Automated recovery follow-up task created')
  assert(noShowRes.recoveryFollowUp.title.includes('No-Show Recovery Call'), 'Recovery follow-up title clearly designated')

  const enq6After = await db.lead.findUnique({ where: { id: enq6Res.lead.id } })
  assert(enq6After?.status === 'QUALIFIED', 'Lead remains active in QUALIFIED state (zero lead drop on no-show)')
  assert(enq6After?.nextFollowUpAt !== null, 'Lead nextFollowUpAt scheduled for recovery call')

  // [10] Non-Destructive Visit Cancellation
  console.log('\n[10] Non-Destructive Visit Cancellation')
  const enq7Res = await LeadService.createLead(ctx, {
    parentName: 'Sanjay Nair',
    phone: '9899887766',
    childName: 'Meera Nair',
    childDob: new Date('2023-03-01'),
    interestedProgram: 'PLAYGROUP',
  })
  const visit7 = await AdmissionService.scheduleSchoolVisit(ctx, enq7Res.lead.id, {
    scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
  })

  let cancelGuardCaught = false
  try {
    await AdmissionService.cancelSchoolVisit(ctx, visit7.followUp.id, {
      reason: '', // empty reason
    })
  } catch (err: any) {
    cancelGuardCaught = true
  }
  assert(cancelGuardCaught, 'Enforces cancellation reason')

  const recontactDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
  const cancelRes = await AdmissionService.cancelSchoolVisit(ctx, visit7.followUp.id, {
    reason: 'Child is unwell; will plan visit next week',
    nextFollowUpAt: recontactDate,
  })
  assert(cancelRes.outcome === 'CANCELLED', 'Visit outcome set to CANCELLED')

  const enq7After = await db.lead.findUnique({ where: { id: enq7Res.lead.id } })
  assert(enq7After?.nextFollowUpAt?.getTime() === recontactDate.getTime(), 'Re-contact date updated on Lead')

  // [11] Daily Workspace Queues & Counter Accuracy
  console.log('\n[11] Daily Workspace Queues & Operational Counters')
  const workspaceData = await AdmissionService.listFollowUpWorkspace(tenant.id, {
    branchId: branch.id,
  })

  assert(workspaceData.counts.upcomingVisits >= 1, 'Upcoming visits counter correctly reports scheduled visits')
  assert(workspaceData.counts.completed >= 3, 'Completed counter accurately tallies resolved interactions')
  assert(Array.isArray(workspaceData.items), 'Workspace items returned as structured array')

  // [12] Immutable Audit Logging
  console.log('\n[12] Immutable Audit Trail Verification')
  const auditEntries = await db.auditLog.findMany({
    where: { tenantId: tenant.id },
  })
  const actionsLogged = new Set(auditEntries.map((a) => a.action))
  assert(actionsLogged.has('FOLLOWUP_CREATED'), 'FOLLOWUP_CREATED audit event logged')
  assert(actionsLogged.has('SCHEDULE_VISIT'), 'SCHEDULE_VISIT audit event logged')
  assert(actionsLogged.has('VISIT_COMPLETED'), 'VISIT_COMPLETED audit event logged')
  assert(actionsLogged.has('VISIT_RESCHEDULED'), 'VISIT_RESCHEDULED audit event logged')
  assert(actionsLogged.has('VISIT_NO_SHOW'), 'VISIT_NO_SHOW audit event logged')
  assert(actionsLogged.has('VISIT_CANCELLED'), 'VISIT_CANCELLED audit event logged')

  // [13] Cross-Tenant Isolation
  console.log('\n[13] Tenant Isolation Verification')
  const tenantOther = await db.tenant.create({
    data: {
      name: 'Other School',
      code: `OTH-${timestamp}`,
      status: 'ACTIVE',
    },
  })
  const otherWorkspace = await AdmissionService.listFollowUpWorkspace(tenantOther.id)
  assert(otherWorkspace.items.length === 0, 'Zero cross-tenant leakage in follow-up workspace')
  assert(otherWorkspace.counts.upcomingVisits === 0, 'Other tenant has 0 upcoming visits')

  console.log('\n====================================================================')
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`)
  console.log('====================================================================')

  if (failed > 0) process.exit(1)
}

runTests().catch((err) => {
  console.error('Test run failed:', err)
  process.exit(1)
})
