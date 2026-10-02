/**
 * PreOne — M03.4 Waiting List Module End-to-End Architectural Test Suite
 *
 * Verifies all requirements from M03.4 Waiting List specification:
 * 1. Entry Creation from existing Application (Zero duplicate child/parent entry).
 * 2. Idempotency & Duplicate Safety (One Application -> One Active Waiting List Entry).
 * 3. Mandatory Reason Validation (NO_SEAT_AVAILABLE, PARENT_REQUESTED_LATER, FUTURE_TERM, PROGRAM_CAPACITY, OTHER with notes).
 * 4. Deterministic FIFO Queue Position Calculation.
 * 5. Priority Control (NORMAL vs HIGH) & Priority Change Audit Logging.
 * 6. Program Capacity Integration (Capacity, Occupied, Available).
 * 7. Parent Waiting List Notification (Notification != Admission Approval).
 * 8. Seat Opportunity Detection & Notification.
 * 9. Seat Offer Generation (OFFER_SENT).
 * 10. Parent Response Handling (Acceptance -> PARENT_ACCEPTED, Decline -> OFFER_DECLINED).
 * 11. Authorized Staff Review & Approval Gate (READY_FOR_ADMISSION).
 * 12. Final Admission Completion Transaction (CONVERTED -> Student + Guardian + Allocation).
 * 13. Zero Student/Parent Creation before Final Completion.
 * 14. Tenant / Branch / Academic Session Scope Isolation.
 */

import { db } from '../src/lib/db'
import { AdmissionService } from '../src/lib/admissions/admission-service'
import { WaitingListService } from '../src/lib/admissions/waiting-list-service'

let passed = 0
let failed = 0

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✓ ${desc}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${desc}`)
    failed++
  }
}

async function runWaitingListTests() {
  console.log('====================================================================')
  console.log('PREONE M03.4 WAITING LIST: PRODUCTION ARCHITECTURAL & E2E ACCEPTANCE')
  console.log('====================================================================\n')

  const testSuffix = Date.now().toString().slice(-6)
  const tenantCode = `WL-TENANT-${testSuffix}`
  let tenant: any
  let branchA: any
  let branchB: any
  let session2627: any
  let session2728: any
  let programNursery: any
  let classroomA: any
  let classroomB: any

  try {
    // -------------------------------------------------------------------------
    // [1] SETUP & FOUNDATION
    // -------------------------------------------------------------------------
    console.log('[1] Foundation & Academic Context Setup')

    tenant = await db.tenant.create({
      data: {
        name: `Waiting List Academy ${testSuffix}`,
        code: tenantCode,
        status: 'ACTIVE',
      },
    })
    assert(Boolean(tenant.id), 'Tenant master created')

    branchA = await db.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'Main Campus',
        code: `MAIN-${testSuffix}`,
      },
    })
    branchB = await db.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'North Campus',
        code: `NORTH-${testSuffix}`,
      },
    })
    assert(Boolean(branchA.id && branchB.id), 'Branch masters created (Main and North)')

    session2627 = await db.academicSession.create({
      data: {
        tenantId: tenant.id,
        name: `2026-2027 ${testSuffix}`,
        startDate: new Date('2026-04-01'),
        endDate: new Date('2027-03-31'),
        status: 'ACTIVE',
        isCurrent: true,
      },
    })
    session2728 = await db.academicSession.create({
      data: {
        tenantId: tenant.id,
        name: `2027-2028 ${testSuffix}`,
        startDate: new Date('2027-04-01'),
        endDate: new Date('2028-03-31'),
        status: 'ACTIVE',
        isCurrent: false,
      },
    })
    assert(Boolean(session2627.id && session2728.id), 'Academic session cycles created (2026-27 and 2027-28)')

    programNursery = await db.program.create({
      data: {
        tenantId: tenant.id,
        code: `NUR-${testSuffix}`,
        name: 'Nursery Prep',
        programType: 'NURSERY',
        ageMinMonths: 36,
        ageMaxMonths: 48,
        capacity: 10,
      },
    })
    assert(Boolean(programNursery.id), 'Nursery program master initialized')

    // Create Nursery-A with capacity = 1 to test full capacity triggering waitlist
    classroomA = await db.classroom.create({
      data: {
        tenantId: tenant.id,
        branchId: branchA.id,
        academicSessionId: session2627.id,
        name: 'Nursery-A',
        code: `NUR-A-${testSuffix}`,
        programType: 'NURSERY',
        capacity: 1,
        programId: programNursery.id,
      },
    })
    assert(classroomA.capacity === 1, 'Classroom Nursery-A created with strict capacity 1')

    const ctxA = {
      tenantId: tenant.id,
      branchId: branchA.id,
      academicYearId: session2627.id,
      actorId: 'admin-usr-1',
      actorName: 'Admissions Officer Maya',
      actorRole: 'ADMIN',
    }

    // -------------------------------------------------------------------------
    // [2] APPLICATION SUBMISSIONS FOR TESTING
    // -------------------------------------------------------------------------
    console.log('\n[2] Admission Applications Submission (Zero Duplicate Child Entry)')

    // Application 1: Aarav (will enroll to fill the 1 seat)
    const app1 = await AdmissionService.submitApplication(ctxA, {
      childFirstName: 'Aarav',
      childLastName: 'Mehta',
      childDob: '2023-01-15',
      childGender: 'MALE',
      parentName: 'Rohan Mehta',
      parentPhone: '9876543210',
      parentEmail: 'rohan.mehta@example.com',
      programType: 'NURSERY',
      relationship: 'FATHER',
    })
    assert(Boolean(app1.id), `Application 1 created: ${app1.applicationNumber}`)

    // Verify all docs and enroll Aarav to completely fill Nursery-A (1/1)
    const app1Docs = await db.applicationDocument.findMany({ where: { applicationId: app1.id } })
    for (const d of app1Docs) {
      await AdmissionService.updateDocumentStatus(ctxA, d.id, 'VERIFY')
    }
    await AdmissionService.approveApplication(ctxA, app1.id, 'Principal approval')
    const enroll1 = await AdmissionService.completeEnrollment(ctxA, app1.id, classroomA.id)
    assert(Boolean(enroll1.student.id), `Student Aarav enrolled (${enroll1.student.admissionNo}). Nursery-A is now FULL (1/1)`)

    // Application 2: Siya (eligible candidate waiting for seat)
    const app2 = await AdmissionService.submitApplication(ctxA, {
      childFirstName: 'Siya',
      childLastName: 'Deshmukh',
      childDob: '2023-02-20',
      childGender: 'FEMALE',
      parentName: 'Pooja Deshmukh',
      parentPhone: '9876543211',
      parentEmail: 'pooja.d@example.com',
      programType: 'NURSERY',
      relationship: 'MOTHER',
    })
    assert(Boolean(app2.id), `Application 2 created: ${app2.applicationNumber}`)

    // Application 3: Kabir (second eligible candidate)
    const app3 = await AdmissionService.submitApplication(ctxA, {
      childFirstName: 'Kabir',
      childLastName: 'Verma',
      childDob: '2023-03-10',
      childGender: 'MALE',
      parentName: 'Sunil Verma',
      parentPhone: '9876543212',
      parentEmail: 'sunil.v@example.com',
      programType: 'NURSERY',
      relationship: 'FATHER',
    })
    assert(Boolean(app3.id), `Application 3 created: ${app3.applicationNumber}`)

    // Application 4: Ananya (third candidate)
    const app4 = await AdmissionService.submitApplication(ctxA, {
      childFirstName: 'Ananya',
      childLastName: 'Iyer',
      childDob: '2023-04-05',
      childGender: 'FEMALE',
      parentName: 'Deepa Iyer',
      parentPhone: '9876543213',
      parentEmail: 'deepa.iyer@example.com',
      programType: 'NURSERY',
      relationship: 'MOTHER',
    })
    assert(Boolean(app4.id), `Application 4 created: ${app4.applicationNumber}`)

    // -------------------------------------------------------------------------
    // [3] MANDATORY REASON VALIDATION & WAITING LIST ENTRY
    // -------------------------------------------------------------------------
    console.log('\n[3] Waiting List Entry & Mandatory Reason Validation')

    // Reject missing reason
    let rejectedMissingReason = false
    try {
      await WaitingListService.addToWaitingList(ctxA, {
        applicationId: app2.id,
        reason: '' as any,
      })
    } catch {
      rejectedMissingReason = true
    }
    assert(rejectedMissingReason, 'Rejected entry creation with missing reason')

    // Reject reason = OTHER without reasonNotes
    let rejectedOtherWithoutNotes = false
    try {
      await WaitingListService.addToWaitingList(ctxA, {
        applicationId: app2.id,
        reason: 'OTHER',
      })
    } catch {
      rejectedOtherWithoutNotes = true
    }
    assert(rejectedOtherWithoutNotes, 'Rejected reason OTHER without mandatory reasonNotes')

    // Successfully add Siya to Waiting List with NO_SEAT_AVAILABLE
    const wlSiya = await WaitingListService.addToWaitingList(ctxA, {
      applicationId: app2.id,
      reason: 'NO_SEAT_AVAILABLE',
      notes: 'Parent visited campus; seat full',
    })
    assert(wlSiya.entry.status === 'ACTIVE', 'Siya placed on Waiting List in ACTIVE status')
    assert(wlSiya.entry.childFirstName === 'Siya', 'Carried existing child name Siya without retyping')
    assert(wlSiya.entry.parentPhone === '9876543211', 'Carried parent phone without retyping')
    assert(wlSiya.position === 1, 'Siya assigned Queue Position #1')

    // Check application status was updated to WAITLISTED
    const app2Updated = await db.admissionApplication.findUnique({ where: { id: app2.id } })
    assert(app2Updated?.status === 'WAITLISTED', 'AdmissionApplication status updated to WAITLISTED')

    // Check NO student was created prematurely (Section 3 & 25)
    const studentCountCheck = await db.student.count({ where: { tenantId: tenant.id } })
    assert(studentCountCheck === 1, 'Strict Student boundary: Only Aarav exists, zero Student records created for waiting list candidate')

    // -------------------------------------------------------------------------
    // [4] IDEMPOTENCY & DUPLICATE SAFETY (Section 22)
    // -------------------------------------------------------------------------
    console.log('\n[4] Duplicate Safety & Idempotency Check')

    const repeatWlSiya = await WaitingListService.addToWaitingList(ctxA, {
      applicationId: app2.id,
      reason: 'NO_SEAT_AVAILABLE',
    })
    assert(repeatWlSiya.isExisting === true, 'Repeat waitlist request identified existing entry')
    assert(repeatWlSiya.entry.id === wlSiya.entry.id, 'Returned same WaitingListEntry record without creating duplicate')

    // Verify only 1 waiting list entry exists in database
    const totalEntriesInDb = await db.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*)::text as count FROM waiting_list_entries WHERE application_id = $1`,
      app2.id
    )
    assert(parseInt(totalEntriesInDb[0].count, 10) === 1, 'Database enforces exactly one entry per application')

    // -------------------------------------------------------------------------
    // [5] DETERMINISTIC FIFO QUEUE RANKING (Section 7)
    // -------------------------------------------------------------------------
    console.log('\n[5] Deterministic FIFO Queue Position Ranking')

    // Add Kabir (created 1 day after Siya)
    const wlKabir = await WaitingListService.addToWaitingList(ctxA, {
      applicationId: app3.id,
      reason: 'NO_SEAT_AVAILABLE',
      waitingSince: new Date(Date.now() + 10000), // slightly later
    })
    assert(wlKabir.position === 2, 'Kabir assigned Queue Position #2 (FIFO after Siya)')

    // Add Ananya
    const wlAnanya = await WaitingListService.addToWaitingList(ctxA, {
      applicationId: app4.id,
      reason: 'PROGRAM_CAPACITY',
      waitingSince: new Date(Date.now() + 20000),
    })
    assert(wlAnanya.position === 3, 'Ananya assigned Queue Position #3 (FIFO after Kabir)')

    // -------------------------------------------------------------------------
    // [6] CONTROLLED PRIORITY PROMOTION & AUDIT LOGGING (Section 8)
    // -------------------------------------------------------------------------
    console.log('\n[6] Priority Promotion & Mandatory Audit Logging')

    // Change Ananya to HIGH priority (e.g. Sibling or staff child quota)
    let rejectedNoReasonPriority = false
    try {
      await WaitingListService.changePriority(ctxA, wlAnanya.entry.id, {
        newPriority: 'HIGH',
        reason: '',
      })
    } catch {
      rejectedNoReasonPriority = true
    }
    assert(rejectedNoReasonPriority, 'Rejected priority change without documented reason')

    const promotedAnanya = await WaitingListService.changePriority(ctxA, wlAnanya.entry.id, {
      newPriority: 'HIGH',
      reason: 'Sibling of existing enrolled pupil in Kindergarten',
    })
    assert(promotedAnanya.priority === 'HIGH', 'Ananya priority updated to HIGH')

    // Re-verify queue ranking: Ananya (HIGH) must now be #1 ahead of Siya (#2) and Kabir (#3)
    const posAnanya = await WaitingListService.calculateQueuePosition(promotedAnanya)
    assert(posAnanya === 1, 'HIGH priority Ananya deterministically promoted to Queue Position #1')

    const siyaCurrent = await WaitingListService.getWaitingListEntry(ctxA, wlSiya.entry.id)
    assert(siyaCurrent.entry.queuePosition === 2, 'Normal priority Siya pushed to Queue Position #2')

    const kabirCurrent = await WaitingListService.getWaitingListEntry(ctxA, wlKabir.entry.id)
    assert(kabirCurrent.entry.queuePosition === 3, 'Normal priority Kabir pushed to Queue Position #3')

    // Verify priority audit entry was created in DB
    const audits = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM waiting_list_priority_audits WHERE waiting_list_entry_id = $1`,
      wlAnanya.entry.id
    )
    assert(audits.length === 1, 'Priority audit record saved in database')
    assert(audits[0].previous_priority === 'NORMAL' && audits[0].new_priority === 'HIGH', 'Audit records exact previous and new priority')
    assert(audits[0].reason.includes('Sibling'), 'Audit records staff rationale')

    // -------------------------------------------------------------------------
    // [7] PROGRAM CAPACITY & SEAT AVAILABILITY INTEGRATION (Section 9)
    // -------------------------------------------------------------------------
    console.log('\n[7] Program Capacity & Seat Availability Engine')

    // Query capacity summary
    const capBefore = await WaitingListService.getProgramCapacity(tenant.id, branchA.id, session2627.id, 'NURSERY')
    assert(capBefore[0].capacity === 1, 'Program capacity = 1')
    assert(capBefore[0].occupied === 1, 'Occupied = 1 (Aarav)')
    assert(capBefore[0].available === 0, 'Available seats = 0')
    assert(capBefore[0].activeWaitlistCount === 3, 'Active waitlist candidates count = 3 (Ananya, Siya, Kabir)')

    // Now, simulate a new division opening up: Nursery-B with capacity 2
    classroomB = await db.classroom.create({
      data: {
        tenantId: tenant.id,
        branchId: branchA.id,
        academicSessionId: session2627.id,
        name: 'Nursery-B',
        code: `NUR-B-${testSuffix}`,
        programType: 'NURSERY',
        capacity: 2,
        programId: programNursery.id,
      },
    })
    assert(Boolean(classroomB.id), 'New section Nursery-B added with capacity 2')

    const capAfter = await WaitingListService.getProgramCapacity(tenant.id, branchA.id, session2627.id, 'NURSERY')
    assert(capAfter[0].capacity === 3, 'New total capacity = 3')
    assert(capAfter[0].available === 2, 'Available seats updated to 2')

    // -------------------------------------------------------------------------
    // [8] SEAT OPPORTUNITY NOTIFICATION (Section 10 & 11)
    // -------------------------------------------------------------------------
    console.log('\n[8] Seat Opportunity Notification & Safe Communication')

    // Mark seat available for #1 candidate Ananya
    const oppAnanya = await WaitingListService.markSeatAvailable(ctxA, wlAnanya.entry.id)
    assert(oppAnanya.status === 'SEAT_AVAILABLE', 'Ananya status updated to SEAT_AVAILABLE')
    assert(Boolean(oppAnanya.seatOpportunityAt), 'Seat opportunity timestamp recorded')

    // Verify audit log has notification entry with safe wording
    const notifAudits = await db.auditLog.findMany({
      where: {
        tenantId: tenant.id,
        entityId: wlAnanya.entry.id,
        action: 'WAITLIST_SEAT_OPPORTUNITY_NOTIFICATION',
      },
    })
    assert(notifAudits.length > 0, 'Notification logged in audit trail')
    assert(notifAudits[0].summary.includes('Notification != Admission Approval'), 'Enforced safety: Notification clearly indicates not admitted')

    // -------------------------------------------------------------------------
    // [9] SEAT OFFER GENERATION & PARENT ACCEPTANCE (Section 11, 12, 14)
    // -------------------------------------------------------------------------
    console.log('\n[9] Seat Offer Generation & Parent Response Lifecycle')

    // Authorized staff creates seat offer for Ananya
    const offerResult = await WaitingListService.createSeatOffer(ctxA, wlAnanya.entry.id, {
      validDays: 5,
      terms: 'Waiting list promotion offer. Please confirm within 5 days.',
    })
    assert(offerResult.entry.status === 'OFFER_SENT', 'Ananya status transitioned to OFFER_SENT')
    assert(Boolean(offerResult.offer.id), 'Formal AdmissionOffer entity created with number')
    assert(Boolean(offerResult.entry.offerValidUntil), 'Offer validity period enforced (5 days)')

    // Parent accepts offer
    const acceptedAnanya = await WaitingListService.recordParentResponse(ctxA, wlAnanya.entry.id, {
      response: 'ACCEPTED',
      notes: 'Parent thrilled and accepted offer on portal',
    })
    assert(acceptedAnanya.status === 'PARENT_ACCEPTED', 'Ananya status transitioned to PARENT_ACCEPTED')
    assert(Boolean(acceptedAnanya.parentRespondedAt), 'Parent response timestamped')

    // Check again: Student MUST NOT be created yet (Section 14: Parent Acceptance alone must NOT admit)
    const studentCheckAfterAccept = await db.student.findFirst({
      where: { tenantId: tenant.id, firstName: 'Ananya' },
    })
    assert(studentCheckAfterAccept === null, 'Critical Safety Gate: Parent acceptance alone DID NOT create Student')

    // -------------------------------------------------------------------------
    // [10] AUTHORIZED STAFF REVIEW & COMPLETE ADMISSION (Section 13, 14, 15)
    // -------------------------------------------------------------------------
    console.log('\n[10] Authorized Staff Approval & Unified Atomic Enrollment')

    // Verify Ananya's application documents (requirement for formal staff approval)
    const app4Docs = await db.applicationDocument.findMany({ where: { applicationId: app4.id } })
    for (const d of app4Docs) {
      await AdmissionService.updateDocumentStatus(ctxA, d.id, 'VERIFY')
    }

    // Authorized Reviewer approves admission
    const approvedAnanya = await WaitingListService.approveAdmission(ctxA, wlAnanya.entry.id, 'Principal approval of waiting list promotion')
    assert(approvedAnanya.status === 'READY_FOR_ADMISSION', 'Candidate status transitioned to READY_FOR_ADMISSION')
    assert(Boolean(approvedAnanya.admissionApprovedAt), 'Approval timestamped')

    // Complete admission transaction: Allocate classroom Nursery-B
    const completeResult = await WaitingListService.completeAdmission(ctxA, wlAnanya.entry.id, classroomB.id)
    assert(completeResult.entry.status === 'CONVERTED', 'Waiting List entry status successfully marked CONVERTED')
    assert(Boolean(completeResult.student.id), `Student successfully created: ${completeResult.student.admissionNo}`)
    assert(completeResult.entry.studentId === completeResult.student.id, 'Waiting List entry references created Student')

    // Verify student is enrolled in Nursery-B
    const allocatedStudent = await db.student.findUnique({
      where: { id: completeResult.student.id },
      include: { allocations: true },
    })
    assert(allocatedStudent?.currentClassroomId === classroomB.id, 'Student allocated to Classroom Nursery-B')

    // Verify Idempotency of completeAdmission
    const repeatComplete = await WaitingListService.completeAdmission(ctxA, wlAnanya.entry.id, classroomB.id)
    assert(repeatComplete.student.id === completeResult.student.id, 'Idempotent completion: repeated call returns existing student')

    // -------------------------------------------------------------------------
    // [11] OFFER DECLINE & WITHDRAWAL OUTCOMES (Section 6, 12, 18)
    // -------------------------------------------------------------------------
    console.log('\n[11] Alternative Outcomes: Offer Decline & Candidate Withdrawal')

    // Make offer to Siya (#1 remaining candidate)
    await WaitingListService.markSeatAvailable(ctxA, wlSiya.entry.id)
    await WaitingListService.createSeatOffer(ctxA, wlSiya.entry.id, { validDays: 3 })

    // Parent declines offer (relocated to another city)
    const declinedSiya = await WaitingListService.recordParentResponse(ctxA, wlSiya.entry.id, {
      response: 'DECLINED',
      notes: 'Family relocated to Pune, unable to proceed',
    })
    assert(declinedSiya.status === 'OFFER_DECLINED', 'Siya status transitioned to OFFER_DECLINED')

    // Withdraw Kabir on parent request
    const withdrawnKabir = await WaitingListService.withdraw(ctxA, wlKabir.entry.id, 'Parent requested refund of enquiry fee and withdrawal')
    assert(withdrawnKabir.status === 'WITHDRAWN', 'Kabir status transitioned to WITHDRAWN')

    // -------------------------------------------------------------------------
    // [12] SCOPE & TENANT ISOLATION (Section 21)
    // -------------------------------------------------------------------------
    console.log('\n[12] Tenant & Branch Scope Isolation')

    // Query waiting list from Branch B (North Campus) - should be empty
    const listBranchB = await WaitingListService.listWaitingList(
      { ...ctxA, branchId: branchB.id },
      { branchId: branchB.id }
    )
    assert(listBranchB.entries.length === 0, 'Branch isolation: Branch North sees 0 entries from Branch Main')

    // Query waiting list for another tenant
    const otherTenant = await db.tenant.create({
      data: { name: `Other School ${testSuffix}`, code: `OTHER-${testSuffix}`, status: 'ACTIVE' },
    })
    const listOtherTenant = await WaitingListService.listWaitingList(
      { ...ctxA, tenantId: otherTenant.id },
      {}
    )
    assert(listOtherTenant.entries.length === 0, 'Tenant isolation: Other tenant sees 0 waiting list entries')

  } catch (err: any) {
    console.error('Test suite runner crashed:', err)
    failed++
  } finally {
    // Teardown test data
    if (tenant?.id) {
      await db.$executeRawUnsafe(`DELETE FROM waiting_list_priority_audits WHERE tenant_id = $1`, tenant.id).catch(() => null)
      await db.$executeRawUnsafe(`DELETE FROM waiting_list_entries WHERE tenant_id = $1`, tenant.id).catch(() => null)
      await db.studentAllocation.deleteMany({ where: { student: { tenantId: tenant.id } } }).catch(() => null)
      await db.studentGuardian.deleteMany({ where: { student: { tenantId: tenant.id } } }).catch(() => null)
      await db.student.deleteMany({ where: { tenantId: tenant.id } }).catch(() => null)
      await db.admissionOffer.deleteMany({ where: { tenantId: tenant.id } }).catch(() => null)
      await db.applicationDocument.deleteMany({ where: { application: { tenantId: tenant.id } } }).catch(() => null)
      await db.admissionApplication.deleteMany({ where: { tenantId: tenant.id } }).catch(() => null)
      await db.followUp.deleteMany({ where: { tenantId: tenant.id } }).catch(() => null)
      await db.lead.deleteMany({ where: { tenantId: tenant.id } }).catch(() => null)
      await db.classroom.deleteMany({ where: { tenantId: tenant.id } }).catch(() => null)
      await db.program.deleteMany({ where: { tenantId: tenant.id } }).catch(() => null)
      await db.academicSession.deleteMany({ where: { tenantId: tenant.id } }).catch(() => null)
      await db.branch.deleteMany({ where: { tenantId: tenant.id } }).catch(() => null)
      await db.auditLog.deleteMany({ where: { tenantId: tenant.id } }).catch(() => null)
      await db.tenant.delete({ where: { id: tenant.id } }).catch(() => null)
    }
  }

  console.log('\n====================================================================')
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`)
  console.log('====================================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runWaitingListTests().then(() => process.exit(0))
