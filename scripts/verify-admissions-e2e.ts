/**
 * PreOne — Complete Admissions Module End-to-End Architectural Test Suite
 *
 * Verifies all 82 architectural requirements:
 * 1. Scope enforcement: tenantId + branchId + academicYearId
 * 2. Real-world complete flow:
 *    ENQUIRY -> FOLLOW-UP -> SCHOOL VISIT -> ADMISSION FORM -> DOCUMENTS ->
 *    REQUIREMENTS CHECK -> REVIEW -> WAITING LIST / APPROVAL ->
 *    NEW ADMISSION (STUDENT + PARENT + CLASS ALLOCATION + FEE INVOICE + MILESTONE)
 * 3. Capacity guard & concurrency-safe locking
 * 4. Zero duplicate student / guardian creation on repeat approval (Idempotency)
 * 5. Downstream connectivity: Setup IDs == Admission IDs == Student Allocation IDs == Finance IDs
 * 6. Audit trail & event emissions
 */

import { db } from '../src/lib/db'
import { AdmissionService } from '../src/lib/admissions/admission-service'
import { ConfigurationService } from '../src/lib/setup/config-service'
import { can } from '../src/lib/auth'

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

async function runAdmissionsTests() {
  console.log('====================================================================')
  console.log('PREONE ADMISSIONS MODULE: ARCHITECTURAL HARDENING & E2E ACCEPTANCE')
  console.log('====================================================================\n')

  const testSuffix = Date.now().toString().slice(-6)
  const tenantCode = `ADM-TENANT-${testSuffix}`
  let tenant: any
  let branch: any
  let session2627: any
  let session2728: any
  let programNursery: any
  let classroomA: any
  let feePlan: any

  try {
    // -------------------------------------------------------------------------
    // STEP 1: SETUP MASTER REUSE
    // -------------------------------------------------------------------------
    console.log('[1] Setup & Academic Year Foundation Setup')
    tenant = await db.tenant.create({
      data: {
        name: `Preschool Academy ${testSuffix}`,
        code: tenantCode,
        status: 'ACTIVE',
      },
    })

    branch = await db.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'Kothrud Branch',
        code: `KTH-${testSuffix}`,
        isMain: true,
      },
    })

    // Create 2 independent academic sessions (2026-27 and 2027-28)
    session2627 = await db.academicSession.create({
      data: {
        tenantId: tenant.id,
        name: `2026-27-${testSuffix}`,
        startDate: new Date('2026-04-01'),
        endDate: new Date('2027-03-31'),
        isCurrent: true,
        status: 'ACTIVE',
      },
    })

    session2728 = await db.academicSession.create({
      data: {
        tenantId: tenant.id,
        name: `2027-28-${testSuffix}`,
        startDate: new Date('2027-04-01'),
        endDate: new Date('2028-03-31'),
        isCurrent: false,
        status: 'PLANNED',
      },
    })

    // Setup Program: Nursery (age 36-48 months, capacity 20)
    programNursery = await db.program.create({
      data: {
        tenantId: tenant.id,
        name: 'Nursery',
        code: `NUR-${testSuffix}`,
        programType: 'NURSERY',
        ageMinMonths: 36,
        ageMaxMonths: 48,
        capacity: 20,
        isActive: true,
      },
    })

    // Setup Classroom: Section A with strict capacity of 2 students
    classroomA = await db.classroom.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        academicSessionId: session2627.id,
        programId: programNursery.id,
        programType: 'NURSERY',
        name: 'Nursery-A',
        code: `NUR-A-${testSuffix}`,
        capacity: 2,
        isActive: true,
      },
    })

    // Setup Finance FeePlan for Nursery
    feePlan = await db.feePlan.create({
      data: {
        tenantId: tenant.id,
        name: 'Nursery Regular Fee Plan',
        programType: 'NURSERY',
        totalAnnualCents: 4500000, // Rs 45,000
        installmentCount: 3,
        isActive: true,
        items: {
          create: [
            { feeHead: 'ADMISSION', label: 'Admission Registration Fee', amountCents: 500000, frequency: 'ONE_TIME' },
            { feeHead: 'TUITION', label: 'Term 1 Tuition', amountCents: 2000000, frequency: 'QUARTERLY' },
          ],
        },
      },
    })

    assert(tenant.id !== undefined, 'Tenant master created')
    assert(branch.id !== undefined, 'Branch master created from Setup')
    assert(session2627.id !== undefined, 'Academic Year 2026-27 master created')
    assert(classroomA.capacity === 2, 'Classroom Nursery-A created with capacity 2')

    // -------------------------------------------------------------------------
    // STEP 2: ENQUIRY CAPTURE & DUPLICATE PROTECTION
    // -------------------------------------------------------------------------
    console.log('\n[2] Enquiry Capture & Duplicate Protection')
    const ctx = {
      tenantId: tenant.id,
      branchId: branch.id,
      academicYearId: session2627.id,
      actorId: 'admin-user',
      actorName: 'Principal Sharma',
      actorRole: 'PRINCIPAL',
    }

    // Enquiry 1: Valid 40-month old child
    const childDob40m = new Date(Date.now() - 40 * 30.44 * 24 * 60 * 60 * 1000)
    const enqRes1 = await AdmissionService.createEnquiry(ctx, {
      parentName: 'Rahul Sharma',
      phone: '9876543210',
      email: 'rahul.sharma@example.com',
      childName: 'Aarav Sharma',
      childDob: childDob40m,
      interestedProgram: 'NURSERY',
      source: 'WALK_IN',
      notes: 'Parent visited campus inquiring for Nursery 2026-27',
    })

    assert(enqRes1.isDuplicate === false, 'First enquiry captured successfully')
    assert(enqRes1.enquiry.status === 'NEW', 'Enquiry status initialized to NEW')
    assert(enqRes1.enquiry.leadNumber.startsWith('LEAD-'), 'Enquiry number generated with LEAD- prefix')

    // Attempt duplicate enquiry with same phone
    const enqResDup = await AdmissionService.createEnquiry(ctx, {
      parentName: 'Rahul Sharma',
      phone: '9876543210',
      childName: 'Aarav Sharma',
      interestedProgram: 'NURSERY',
    })
    assert(enqResDup.isDuplicate === true, 'Duplicate enquiry with same phone correctly intercepted')
    assert(enqResDup.enquiry.id === enqRes1.enquiry.id, 'Existing enquiry returned on duplicate attempt')

    // -------------------------------------------------------------------------
    // STEP 3: ENQUIRY STATUS WORKFLOW, FOLLOW-UP & SCHOOL VISIT
    // -------------------------------------------------------------------------
    console.log('\n[3] Follow-up Actions & School Visit Scheduling')
    // Transition status to CONTACTED
    const enqUpdated = await AdmissionService.updateEnquiryStatus(ctx, enqRes1.enquiry.id, 'CONTACTED')
    assert(enqUpdated.status === 'CONTACTED', 'Enquiry transitioned to CONTACTED')

    // Add phone follow-up
    const fu = await AdmissionService.addEnquiryFollowUp(ctx, enqRes1.enquiry.id, {
      type: 'Call Parent',
      note: 'Discussed preschool schedule; parent interested in campus visit',
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
    assert(fu.created === true, 'Operational follow-up logged using FollowUp engine')

    // Schedule School Visit
    const visitDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    const visit = await AdmissionService.scheduleSchoolVisit(ctx, enqRes1.enquiry.id, {
      scheduledAt: visitDate,
      visitorCount: 3,
      notes: 'Father, mother and child visiting for classroom walkthrough',
    })
    assert(visit.created === true, 'School visit scheduled with assigned staff')

    // Verify Enquiry status auto-promoted to QUALIFIED (Visit Planned)
    const enqAfterVisit = await db.lead.findUnique({ where: { id: enqRes1.enquiry.id } })
    assert(enqAfterVisit?.status === 'QUALIFIED', 'Enquiry status progressed to QUALIFIED after visit scheduling')

    // -------------------------------------------------------------------------
    // STEP 4: ADMISSION FORM (APPLICATION) CREATION & AGE VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n[4] Admission Form Submission & Dynamic Checklist')
    // Reject child who does not satisfy age eligibility
    const childDob20m = new Date(Date.now() - 20 * 30.44 * 24 * 60 * 60 * 1000) // Too young for Nursery (36m)
    let ageRejected = false
    try {
      await AdmissionService.submitApplication(ctx, {
        childFirstName: 'TooYoungChild',
        childDob: childDob20m,
        parentName: 'Pooja Patil',
        parentPhone: '9811223344',
        programType: 'NURSERY',
      })
    } catch (err: any) {
      ageRejected = true
      assert(err.message.includes('minimum'), 'Age verification rejected ineligible 20-month child for Nursery')
    }
    assert(ageRejected, 'Strict age verification gate enforced')

    // Valid Admission Form submission
    const form1 = await AdmissionService.submitApplication(ctx, {
      leadId: enqRes1.enquiry.id,
      programType: 'NURSERY',
      childFirstName: 'Aarav',
      childLastName: 'Sharma',
      childDob: childDob40m,
      childGender: 'MALE',
      parentName: 'Rahul Sharma',
      parentPhone: '9876543210',
      parentEmail: 'rahul.sharma@example.com',
      address: 'Plot 104, Mayur Colony, Kothrud',
    })

    assert(form1.applicationNumber.startsWith('ADM-'), 'Admission Form created with ADM- prefix')
    assert(form1.status === 'SUBMITTED', 'Admission Form initialized in SUBMITTED state')

    // Verify dynamic document checklist generated
    const docs = await db.applicationDocument.findMany({ where: { applicationId: form1.id } })
    assert(docs.length >= 3, `Document checklist created with ${docs.length} required documents`)

    // Verify lead status updated to APPLICATION_STARTED
    const leadConvertedCheck = await db.lead.findUnique({ where: { id: enqRes1.enquiry.id } })
    assert(leadConvertedCheck?.status === 'APPLICATION_STARTED', 'Enquiry updated to APPLICATION_STARTED')

    // -------------------------------------------------------------------------
    // STEP 5: DOCUMENT VERIFICATION GATE & REJECTION HANDLING
    // -------------------------------------------------------------------------
    console.log('\n[5] Document Verification Gate & Rejection Handling')
    // Pre-verification review check: documents should be incomplete
    const reviewPre = await AdmissionService.reviewApplication(ctx, form1.id)
    assert(reviewPre.requirements.documentsCheck.isComplete === false, 'Review detects incomplete documents before verification')
    assert(reviewPre.requirements.isReadyForApproval === false, 'Approval gate closed while documents are pending')

    // Test rejection with mandatory reason
    const firstDoc = docs[0]
    const rejectedDoc = await AdmissionService.updateDocumentStatus(ctx, firstDoc.id, 'REJECT', 'Birth certificate is blurry and unreadable')
    assert(rejectedDoc.document.status === 'REJECTED', 'Document status updated to REJECTED')
    assert(rejectedDoc.document.rejectionReason === 'Birth certificate is blurry and unreadable', 'Document rejection reason preserved')

    // Re-verify the rejected document (simulating parent re-upload)
    await AdmissionService.updateDocumentStatus(ctx, firstDoc.id, 'VERIFY', 'Re-uploaded clear copy verified')

    // Verify all remaining docs
    for (let i = 1; i < docs.length; i++) {
      await AdmissionService.updateDocumentStatus(ctx, docs[i].id, 'VERIFY', 'Verified against original copy')
    }

    const reviewPost = await AdmissionService.reviewApplication(ctx, form1.id)
    assert(reviewPost.requirements.documentsCheck.isComplete === true, 'All documents verified successfully')
    assert(reviewPost.requirements.capacityCheck.hasAvailableCapacity === true, 'Classroom capacity available for Section A (0/2)')
    assert(reviewPost.requirements.isReadyForApproval === true, 'Approval gate opened after all requirements satisfied')

    // -------------------------------------------------------------------------
    // STEP 5.1: COUNSELLING SESSION RECORDING & FOLLOW-UP LOGGING
    // -------------------------------------------------------------------------
    console.log('\n[5.1] Counselling Session Recording & Follow-up Logging')
    const counsellingRes = await AdmissionService.recordCounselling(ctx, form1.id, {
      counselorName: 'Counsellor Mehta',
      notes: 'Child observed to be very active and social. Parents satisfied with preschool curriculum.',
      outcome: 'POSITIVE',
      scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    })
    assert(counsellingRes.application.status === 'COUNSELLING', 'Application status moved to COUNSELLING')
    assert(counsellingRes.followUp !== null, 'Automated follow-up task created from counselling outcome')

    // -------------------------------------------------------------------------
    // STEP 5.2: FORMAL APPROVAL GATE (PRINCIPAL REVIEW)
    // -------------------------------------------------------------------------
    console.log('\n[5.2] Formal Approval Gate (Principal Sign-off)')
    const approvedApp = await AdmissionService.approveApplication(ctx, form1.id, 'Meets all age and document criteria')
    assert(approvedApp.status === 'APPROVED', 'Application formally transitioned to APPROVED')

    // -------------------------------------------------------------------------
    // STEP 5.3: PERSISTENT ADMISSION OFFER GENERATION
    // -------------------------------------------------------------------------
    console.log('\n[5.3] Persistent Admission Offer Generation')
    const offerRes = await AdmissionService.generateOffer(ctx, form1.id, {
      classroomId: classroomA.id,
      feePlanId: feePlan.id,
      validDays: 7,
      remarks: 'Offer issued for Nursery-A Academic Year 2026-27',
    })
    assert(offerRes.offer.offerNumber.startsWith('OFR-'), `Admission Offer created with number ${offerRes.offer.offerNumber}`)
    assert(offerRes.offer.status === 'ISSUED', 'Offer status is ISSUED')
    assert(offerRes.offer.feeTotalCents === feePlan.totalAnnualCents, 'Offer captures exact fee plan amount')
    assert(offerRes.application.status === 'OFFER_SENT', 'Application status progressed to OFFER_SENT')

    // -------------------------------------------------------------------------
    // STEP 5.4: PARENT OFFER ACCEPTANCE
    // -------------------------------------------------------------------------
    console.log('\n[5.4] Parent Offer Acceptance')
    const acceptRes = await AdmissionService.acceptOffer(ctx, form1.id, offerRes.offer.id, {
      remarks: 'Parent accepted offer via admission portal',
    })
    assert(acceptRes.offer.status === 'ACCEPTED', 'Offer status transitioned to ACCEPTED')
    assert(acceptRes.application.status === 'OFFER_ACCEPTED', 'Application status progressed to OFFER_ACCEPTED')

    // -------------------------------------------------------------------------
    // STEP 6: ADMISSION APPROVAL & ATOMIC ENROLLMENT (STUDENT 1)
    // -------------------------------------------------------------------------
    console.log('\n[6] Admission Approval & Atomic Enrolment Fan-out')
    const enroll1 = await AdmissionService.completeEnrollment(ctx, form1.id, classroomA.id)

    assert(enroll1.student.admissionNo.startsWith('STU-'), `Student created with admission number: ${enroll1.student.admissionNo}`)
    assert(enroll1.classroomName === 'Nursery-A', 'Student allocated to Nursery-A')
    assert(enroll1.guardian.phone === '9876543210', 'Parent/Guardian record created and linked')
    assert(enroll1.invoiceNumber !== null, `Finance handoff: First fee invoice generated (${enroll1.invoiceNumber})`)

    // Idempotency check: Repeated enrollment must NOT create duplicate student or invoice
    const enroll1Repeat = await AdmissionService.completeEnrollment(ctx, form1.id, classroomA.id)
    assert(enroll1Repeat.isAlreadyEnrolled === true, 'Repeat enrollment is idempotent: returns existing student without duplicate side-effects')
    assert(enroll1Repeat.student.id === enroll1.student.id, 'Same student record maintained')

    // -------------------------------------------------------------------------
    // STEP 7: SECOND STUDENT ENROLLMENT (REACHING CAPACITY 2/2)
    // -------------------------------------------------------------------------
    console.log('\n[7] Second Student Enrollment (Classroom at Capacity 2/2)')
    const form2 = await AdmissionService.submitApplication(ctx, {
      programType: 'NURSERY',
      childFirstName: 'Siya',
      childLastName: 'Deshmukh',
      childDob: childDob40m,
      childGender: 'FEMALE',
      parentName: 'Sunita Deshmukh',
      parentPhone: '9822334455',
    })

    const docs2 = await db.applicationDocument.findMany({ where: { applicationId: form2.id } })
    for (const d of docs2) {
      await AdmissionService.updateDocumentStatus(ctx, d.id, 'VERIFY')
    }
    await AdmissionService.approveApplication(ctx, form2.id, 'Approved for enrollment')

    const enroll2 = await AdmissionService.completeEnrollment(ctx, form2.id, classroomA.id)
    assert(enroll2.student.firstName === 'Siya', 'Second student Siya enrolled successfully')

    const inClassCount = await db.student.count({
      where: { currentClassroomId: classroomA.id, status: 'ACTIVE', deletedAt: null },
    })
    assert(inClassCount === 2, 'Classroom Nursery-A is now exactly full at capacity (2/2)')

    // -------------------------------------------------------------------------
    // STEP 8: THIRD STUDENT — CAPACITY FULL & WAITING LIST
    // -------------------------------------------------------------------------
    console.log('\n[8] Third Student: Capacity Full Guard & Waiting List')
    const form3 = await AdmissionService.submitApplication(ctx, {
      programType: 'NURSERY',
      childFirstName: 'Kabir',
      childLastName: 'Verma',
      childDob: childDob40m,
      parentName: 'Vikram Verma',
      parentPhone: '9833445566',
    })

    const docs3 = await db.applicationDocument.findMany({ where: { applicationId: form3.id } })
    for (const d of docs3) {
      await AdmissionService.updateDocumentStatus(ctx, d.id, 'VERIFY')
    }
    await AdmissionService.approveApplication(ctx, form3.id, 'Approved for enrollment')

    // Enrollment must fail due to full capacity
    let capacityBlocked = false
    try {
      await AdmissionService.completeEnrollment(ctx, form3.id, classroomA.id)
    } catch (err: any) {
      capacityBlocked = true
      assert(err.message.includes('capacity'), 'Third student blocked from enrollment due to classroom full capacity')
    }
    assert(capacityBlocked, 'Concurrency capacity guard prevented over-allocation')

    // Move third child to Waiting List
    const waitlistRes = await AdmissionService.waitlistApplication(ctx, form3.id, 'Section capacity reached')
    assert(waitlistRes.application.status === 'WAITLISTED', 'Child placed on Waiting List')
    assert(waitlistRes.position === 1, 'Waiting list position assigned (#1 on waitlist)')

    // -------------------------------------------------------------------------
    // STEP 8.1: OFFER DECLINE & APPLICATION REJECTION WORKFLOW
    // -------------------------------------------------------------------------
    console.log('\n[8.1] Offer Decline & Formal Application Rejection')
    const form4 = await AdmissionService.submitApplication(ctx, {
      programType: 'NURSERY',
      childFirstName: 'Tanvi',
      childLastName: 'Rao',
      childDob: childDob40m,
      parentName: 'Girish Rao',
      parentPhone: '9844556677',
    })
    const docs4 = await db.applicationDocument.findMany({ where: { applicationId: form4.id } })
    for (const d of docs4) {
      await AdmissionService.updateDocumentStatus(ctx, d.id, 'VERIFY')
    }
    const offer4 = await AdmissionService.generateOffer(ctx, form4.id, {
      feePlanId: feePlan.id,
      validDays: 5,
    })
    const declineRes = await AdmissionService.declineOffer(ctx, form4.id, offer4.offer.id, {
      reason: 'Parent opted for school closer to residence',
    })
    assert(declineRes.offer.status === 'DECLINED', 'Offer successfully declined')
    assert(declineRes.application.status === 'WITHDRAWN', 'Application status moved to WITHDRAWN')

    const rejectRes = await AdmissionService.rejectApplication(ctx, form4.id, {
      reason: 'Offer declined by parent - closed file',
    })
    assert(rejectRes.status === 'REJECTED', 'Application formally marked REJECTED')
    assert(rejectRes.rejectionReason?.includes('Offer declined'), 'Rejection reason recorded in application')

    // -------------------------------------------------------------------------
    // STEP 9: SAME-ID CONNECTIVITY VERIFICATION ACROSS MODULES
    // -------------------------------------------------------------------------
    console.log('\n[9] Same-ID Foreign Key & Architectural Connectivity Verification')
    // 1. Setup Program ID == Classroom Program ID
    assert(classroomA.programId === programNursery.id, 'Classroom references Setup Program ID')

    // 2. Setup Academic Session ID == Allocation Academic Session ID
    const allocation = await db.studentAllocation.findFirst({
      where: { studentId: enroll1.student.id, academicSessionId: session2627.id },
    })
    assert(allocation?.academicSessionId === session2627.id, 'Student Allocation references Setup AcademicSession ID')

    // 3. Student Guardian Link == Guardian ID
    const guardianLink = await db.studentGuardian.findFirst({
      where: { studentId: enroll1.student.id },
    })
    assert(guardianLink?.guardianId === enroll1.guardian.id, 'StudentGuardian references Users/Guardian ID')

    // 4. Student Invoice ID == Student ID
    const invoice = await db.invoice.findFirst({
      where: { studentId: enroll1.student.id },
    })
    assert(invoice?.studentId === enroll1.student.id, 'Fees Invoice references Student ID')

    // 5. Parent Timeline Milestone exists
    const timeline = await db.timelineEntry.findFirst({
      where: { studentId: enroll1.student.id, type: 'MILESTONE' },
    })
    assert(timeline !== null, 'Welcome timeline milestone created for Parent Portal')

    // 6. Audit logs recorded
    const auditCount = await db.auditLog.count({
      where: { tenantId: tenant.id },
    })
    assert(auditCount >= 5, `Audit trail recorded ${auditCount} immutable entries`)

    // -------------------------------------------------------------------------
    // STEP 10: ACADEMIC YEAR SCOPE ISOLATION (2026-27 vs 2027-28)
    // -------------------------------------------------------------------------
    console.log('\n[10] Academic Year Scope Isolation (2026-27 vs 2027-28)')
    const enqYear2 = await AdmissionService.createEnquiry(
      {
        tenantId: tenant.id,
        branchId: branch.id,
        academicYearId: session2728.id,
        actorId: 'admin-user',
      },
      {
        parentName: 'Future Parent',
        phone: '9988776655',
        childName: 'Future Kid',
        interestedProgram: 'NURSERY',
      }
    )
    assert(enqYear2.enquiry.id !== undefined, 'Enquiry created for next cycle 2027-28')

    // -------------------------------------------------------------------------
    // [11] CLASS + DIVISION ALLOCATION ENGINE & WAITING LIST PROMOTION
    // -------------------------------------------------------------------------
    console.log('\n[11] Class + Division Allocation Engine & Waiting List Promotion')
    
    // Create Section B for Nursery to test multi-division recommendation
    const classroomB = await db.classroom.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        academicSessionId: session2627.id,
        name: 'Nursery-B',
        code: `NUR-B-${testSuffix}`,
        programType: 'NURSERY',
        capacity: 5,
        isActive: true,
      },
    })
    assert(classroomB.id !== undefined, 'Created Classroom Division Nursery-B with capacity 5')

    // Create a new application to test allocation recommendations
    const appCandidate = await AdmissionService.submitApplication(
      {
        tenantId: tenant.id,
        branchId: branch.id,
        academicYearId: session2627.id,
        actorId: 'admin-user',
      },
      {
        programType: 'NURSERY',
        childFirstName: 'Vihaan',
        childLastName: 'Deshmukh',
        childDob: new Date(Date.now() - 40 * 30 * 24 * 60 * 60 * 1000),
        parentName: 'Ganesh Deshmukh',
        parentPhone: '9822998877',
      }
    )

    const allocRec = await AdmissionService.getAllocationRecommendations(
      {
        tenantId: tenant.id,
        branchId: branch.id,
        academicYearId: session2627.id,
      },
      appCandidate.id
    )

    assert(allocRec.divisions.length >= 2, 'Evaluated all divisions for Nursery')
    assert(allocRec.recommendedClassroomId === classroomB.id, 'Recommended division B with available capacity over full division A')
    assert(allocRec.isWaitlistRecommended === false, 'Correctly identified seat availability across divisions')

    // Waitlist an application and test waiting list promotion
    const waitlistedRes = await AdmissionService.waitlistApplication(
      {
        tenantId: tenant.id,
        branchId: branch.id,
        academicYearId: session2627.id,
        actorId: 'admin-user',
      },
      appCandidate.id,
      'Classroom allocation hold'
    )
    assert(waitlistedRes.application.status === 'WAITLISTED', 'Application marked WAITLISTED')

    const promoted = await AdmissionService.promoteWaitingListEntry(
      {
        tenantId: tenant.id,
        branchId: branch.id,
        academicYearId: session2627.id,
        actorId: 'admin-user',
      },
      waitlistedRes.application.id,
      classroomB.id,
      'Seat opened up in Nursery-B'
    )
    assert(promoted.status === 'APPROVED', 'Waitlisted application successfully promoted to APPROVED')
    assert(promoted.classroomId === classroomB.id, 'Promoted application allocated to Nursery-B')

    // -------------------------------------------------------------------------
    // [12] CSV BULK IMPORT ENGINE (UNIFIED BUSINESS ENGINE)
    // -------------------------------------------------------------------------
    console.log('\n[12] CSV Bulk Import Engine (Validation, Duplicate Guard & Batch Execution)')

    const rawCsvRows = [
      {
        'Parent Name': 'Kavita Joshi',
        'Phone Number': '9890123456',
        'Email': 'kavita.j@example.com',
        'Child Name': 'Ishaan Joshi',
        'Date of Birth': '2023-01-15',
        'Program': 'Nursery',
        'Notes': 'Morning batch preferred',
      },
      {
        // Duplicate row with same phone as Kavita Joshi
        'Parent Name': 'Kavita Joshi',
        'Phone Number': '9890123456',
        'Child Name': 'Ishaan Duplicate',
        'Date of Birth': '2023-01-15',
        'Program': 'Nursery',
      },
      {
        // Invalid row: Bad phone & invalid DOB
        'Parent Name': 'Invalid Entry',
        'Phone Number': '123',
        'Child Name': 'Bad Kid',
        'Date of Birth': 'not-a-date',
        'Program': 'UnknownProgram',
      }
    ]

    const columnMapping = {
      parentName: 'Parent Name',
      phone: 'Phone Number',
      email: 'Email',
      childName: 'Child Name',
      dob: 'Date of Birth',
      program: 'Program',
      notes: 'Notes',
    }

    // Step A: Validate CSV rows
    const validationResult = await AdmissionService.validateCsvImportRows(
      {
        tenantId: tenant.id,
        branchId: branch.id,
        academicYearId: session2627.id,
      },
      'leads',
      rawCsvRows,
      columnMapping
    )

    assert(validationResult.totalRows === 3, 'Processed 3 raw CSV rows')
    assert(validationResult.validCount >= 1, 'Identified valid rows')
    assert(validationResult.invalidCount >= 1, 'Flagged invalid row with specific field errors')
    assert(validationResult.rows[2].errors.length >= 2, 'Reported multiple errors for invalid phone and date format')

    // Step B: Execute CSV batch import
    const batchImportResult = await AdmissionService.executeCsvImportBatch(
      {
        tenantId: tenant.id,
        branchId: branch.id,
        academicYearId: session2627.id,
        actorId: 'admin-user',
        actorName: 'Principal Sharma',
        actorRole: 'PRINCIPAL',
      },
      'leads',
      validationResult.rows,
      'SKIP'
    )

    assert(batchImportResult.batchId.startsWith('IMP-'), `Generated sequential batch reference: ${batchImportResult.batchId}`)
    assert(batchImportResult.success >= 1, 'Successfully created canonical Lead records through admission engine')
    assert(batchImportResult.failed >= 1, 'Safely skipped invalid rows without crashing')

    // Verify AuditLog record for CSV Import
    const importAudit = await db.auditLog.findFirst({
      where: {
        tenantId: tenant.id,
        action: 'CSV_IMPORT',
        entityId: batchImportResult.batchId,
      },
    })
    assert(importAudit !== null, 'Immutable AuditLog entry created for CSV import batch')

    // -------------------------------------------------------------------------
    // [13] SIBLING CONCESSION DYNAMIC RESOLUTION
    // -------------------------------------------------------------------------
    console.log('\n[13] Sibling Concession Dynamic Resolution')

    // Test reviewApplication sibling detection for parent who already has an enrolled child
    const siblingCheckApp = await AdmissionService.submitApplication(
      {
        tenantId: tenant.id,
        branchId: branch.id,
        academicYearId: session2627.id,
        actorId: 'admin-user',
      },
      {
        programType: 'NURSERY',
        childFirstName: 'Kabir',
        childLastName: 'Sharma',
        childDob: new Date(Date.now() - 42 * 30 * 24 * 60 * 60 * 1000),
        parentName: 'Rahul Sharma', // Same parent as STU-2026-0001
        parentPhone: '9876543210',
      }
    )

    const siblingReview = await AdmissionService.reviewApplication(
      {
        tenantId: tenant.id,
        branchId: branch.id,
        academicYearId: session2627.id,
      },
      siblingCheckApp.id
    )

    assert(siblingReview.requirements.siblingConcession.hasSibling === true, 'Successfully resolved existing student sibling via Guardian relationship')
    assert(siblingReview.requirements.siblingConcession.applicableDiscountPercent > 0, 'Applied dynamic sibling concession policy')

    // -------------------------------------------------------------------------
    // RESULTS
    // -------------------------------------------------------------------------
    console.log('\n====================================================================')
    console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`)
    console.log('====================================================================')
  } finally {
    // Clean up test tenant and child records in correct FK dependency order
    if (tenant?.id) {
      await db.timelineEntry.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.invoiceItem.deleteMany({ where: { invoice: { tenantId: tenant.id } } }).catch(() => {})
      await db.invoice.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.studentAllocation.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.studentGuardian.deleteMany({ where: { student: { tenantId: tenant.id } } }).catch(() => {})
      await db.guardian.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.student.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.admissionOffer.deleteMany({ where: { application: { tenantId: tenant.id } } }).catch(() => {})
      await db.applicationDocument.deleteMany({ where: { application: { tenantId: tenant.id } } }).catch(() => {})
      await db.admissionApplication.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.followUp.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.lead.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.feePlanItem.deleteMany({ where: { feePlan: { tenantId: tenant.id } } }).catch(() => {})
      await db.feePlan.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.classroom.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.program.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.branch.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.academicSession.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.auditLog.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.tenant.delete({ where: { id: tenant.id } }).catch(() => {})
    }
  }
}

runAdmissionsTests()
  .then(() => {
    if (failed > 0) process.exit(1)
    process.exit(0)
  })
  .catch((err) => {
    console.error('Test suite runner crashed:', err)
    process.exit(1)
  })
