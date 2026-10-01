/**
 * PreOne — M03.3 Admissions: Application Subsystem Acceptance Suite
 *
 * Validates the frozen Application flow boundary:
 * FOLLOW-UP / VISIT
 *         ↓
 * START APPLICATION (Zero data re-entry prefill from Lead)
 *         ↓
 * APPLICATION FORM & DOSSIER
 *         ↓
 * REVIEW & SUBMISSION (Status: SUBMITTED, Sequential ADM-YYYY-XXXX)
 *         ↓
 * DOCUMENT VERIFICATION (Checklist, verify/reject, gating rule: unverified blocks approval)
 *         ↓
 * COUNSELLING / MEETING (Interaction cues, parent expectations, outcome)
 *         ↓
 * ADMISSION REVIEW (Age check, docs check, capacity check, fee plan quote)
 *         ↓
 * APPROVED (Principal sign-off gate)
 *         ↓
 * SELECT FEE TEMPLATE & AUTO FEE QUOTE (Snapshot calculation, sibling concession)
 *         ↓
 * GENERATE OFFER (OFR-YYYY-XXXX-NNNN, validUntil, terms, immutable snapshot)
 *         ↓
 * PARENT ACCEPTS OFFER (Status: OFFER_ACCEPTED, Golden Rule: Parent acceptance != Student creation)
 *         ↓
 * STAFF FINAL REVIEW (Boundary gate: validates all prerequisites, marks READY_FOR_ALLOCATION)
 *         ↓
 * READY FOR NEXT MODULE (Handoff payload to M03.4 Waiting List & Allocation)
 * [STOP HERE — No premature Student, Seat Allocation, or Invoice creation]
 */

import { db } from '../src/lib/db'
import { AdmissionService } from '../src/lib/admissions/admission-service'
import { LeadService } from '../src/lib/admissions/lead-service'
import { FollowUpVisitService } from '../src/lib/admissions/followup-visit-service'

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
  console.log('PREONE M03.3 ADMISSIONS APPLICATION SUBSYSTEM: ACCEPTANCE SUITE')
  console.log('====================================================================')

  const timestamp = Date.now().toString().slice(-6)
  const tenantSlug = `app-test-${timestamp}`

  // [1] Multi-Tenant & Academic Foundation Setup
  console.log('\n[1] Tenant & Academic Session Foundation Setup')
  const tenant = await db.tenant.create({
    data: {
      name: `PreOne Test Academy ${timestamp}`,
      code: `APP-${timestamp}`,
      status: 'ACTIVE',
    },
  })
  const branch = await db.branch.create({
    data: {
      tenantId: tenant.id,
      name: 'Main Campus',
      code: `BR-${timestamp}`,
      isActive: true,
    },
  })
  const session = await db.academicSession.create({
    data: {
      tenantId: tenant.id,
      name: 'Academic Year 2026-2027',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2027-04-30'),
      isCurrent: true,
    },
  })
  const program = await db.program.create({
    data: {
      tenantId: tenant.id,
      name: 'Nursery Explorers',
      code: `NUR-${timestamp}`,
      programType: 'NURSERY',
      ageMinMonths: 30,
      ageMaxMonths: 48,
      isActive: true,
    },
  })
  const feePlan = await db.feePlan.create({
    data: {
      tenantId: tenant.id,
      name: 'Nursery Standard 2026-27',
      programType: 'NURSERY',
      totalAnnualCents: 6000000, // 60,000 INR
      installmentCount: 3,
      isActive: true,
      items: {
        create: [
          { feeHead: 'TUITION', label: 'Annual Tuition Fee', amountCents: 4500000, frequency: 'ANNUALLY' },
          { feeHead: 'ADMISSION', label: 'One-time Admission Fee', amountCents: 1000000, frequency: 'ONE_TIME' },
          { feeHead: 'ACTIVITY', label: 'Activity & Learning Kit', amountCents: 500000, frequency: 'ANNUALLY' },
        ],
      },
    },
  })

  const ctx = {
    tenantId: tenant.id,
    branchId: branch.id,
    academicYearId: session.id,
    actorId: 'usr-admissions-officer',
    actorName: 'Priya Sharma (Admissions Officer)',
    actorRole: 'ADMISSIONS_OFFICER',
  }

  assert(Boolean(tenant.id && branch.id && session.id && program.id && feePlan.id), 'Multi-tenant foundation initialized')

  // [2] Intake from Lead & School Visit (Zero Data Re-entry Prefill)
  console.log('\n[2] Intake from School Visit (Zero Data Re-entry)')
  const leadRes = await LeadService.createLead(
    {
      tenantId: tenant.id,
      branchId: branch.id,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
    },
    {
      parentName: 'Rohit Kulkarni',
      phone: '9822001122',
      email: 'rohit.k@example.com',
      childName: 'Aarav Kulkarni',
      childDob: new Date('2023-01-15'), // ~38 months, within 30-48 months range
      childGender: 'MALE',
      interestedProgram: 'NURSERY',
      academicSessionId: session.id,
      source: 'WALK_IN',
    }
  )
  assert(Boolean(leadRes.lead.id), 'Lead created for prospective family')

  const visitRes = await AdmissionService.scheduleSchoolVisit(ctx, leadRes.lead.id, {
    scheduledAt: new Date(Date.now() - 3600000), // 1 hour ago
    visitorCount: 3,
    attendees: 'Both parents with Aarav',
    tourFocus: 'Nursery classroom and learning areas',
    notes: 'Family attended tour, child Aarav participated actively',
  })
  assert(visitRes.created === true, 'School visit scheduled')

  const completeVisitRes = await AdmissionService.completeSchoolVisit(ctx, visitRes.followUp.id, {
    childInteraction: {
      comfort: 'COMFORTABLE',
      educatorInteraction: 'ENGAGED',
      communication: 'COMFORTABLE',
      activityResponse: 'INTERESTED',
      separation: 'COMFORTABLE',
      strengthsNotes: 'Aarav displayed confident curiosity and explored shapes puzzle',
      supportNotes: 'None noted',
    },
    parentFeedback: 'Loved the preschool atmosphere and safety features',
    staffNotes: 'Recommended for Nursery batch',
    outcome: 'READY_TO_PROCEED',
  })

  assert(completeVisitRes.parsedDetail.outcome === 'READY_TO_PROCEED', 'Visit completed with outcome READY_TO_PROCEED')
  assert(Boolean(completeVisitRes.applicationId), 'Admission application automatically created with zero data re-entry')
  assert(completeVisitRes.applicationNumber?.startsWith('ADM-') === true, `Valid application number generated: ${completeVisitRes.applicationNumber}`)

  // [3] Application Dossier Initial State & Fields
  console.log('\n[3] Application Dossier Initial State (Sequential ADM-YYYY-XXXX)')
  const appRes = await db.admissionApplication.findUniqueOrThrow({ where: { id: completeVisitRes.applicationId! } })
  assert(appRes.status === 'SUBMITTED', `Application status is SUBMITTED (actual: ${appRes.status})`)
  assert(appRes.childFirstName === 'Aarav', 'Child first name auto-copied: Aarav')
  assert(appRes.parentPhone === '9822001122', 'Parent phone auto-copied: 9822001122')
  assert(appRes.applicationNumber.startsWith('ADM-'), `Application number has ADM- prefix: ${appRes.applicationNumber}`)

  assert(Boolean(appRes.id), 'Admission application persisted')
  assert(appRes.status === 'SUBMITTED', `Application status is SUBMITTED (actual: ${appRes.status})`)
  assert(appRes.applicationNumber.startsWith('ADM-'), `Application number has ADM- prefix: ${appRes.applicationNumber}`)

  // [4] Document Verification Checklist & Gating Rule
  console.log('\n[4] Document Verification Gate Enforcement')
  const reviewBeforeDocs = await AdmissionService.reviewApplication(ctx, appRes.id)
  assert(reviewBeforeDocs.requirements.documentsCheck.total > 0, `Documents checklist initialized with ${reviewBeforeDocs.requirements.documentsCheck.total} items`)
  assert(!reviewBeforeDocs.requirements.documentsCheck.isComplete, 'Documents check is incomplete initially')

  // Approval gate: Attempting to approve while documents are unverified MUST fail
  let prematureApprovalFailed = false
  try {
    await AdmissionService.approveApplication(ctx, appRes.id)
  } catch (err: any) {
    prematureApprovalFailed = true
    assert(err.message.includes('pending verification'), `Premature approval blocked by document gate: "${err.message}"`)
  }
  assert(prematureApprovalFailed, 'Approval blocked when documents unverified')

  // Test document rejection behavior
  const birthCertDoc = reviewBeforeDocs.application.documents.find((d) => d.docType.includes('BIRTH') || d.title.includes('Birth'))
  const firstDoc = birthCertDoc || reviewBeforeDocs.application.documents[0]

  await AdmissionService.updateDocumentStatus(
    ctx,
    firstDoc.id,
    'REJECT',
    'Scanned image is blurred and unreadable. Please provide a clear copy.'
  )

  let rejectedDocApprovalFailed = false
  try {
    await AdmissionService.approveApplication(ctx, appRes.id)
  } catch (err: any) {
    rejectedDocApprovalFailed = true
    assert(err.message.includes('Rejected'), `Approval blocked by rejected document gate: "${err.message}"`)
  }
  assert(rejectedDocApprovalFailed, 'Approval blocked when any document is Rejected')

  // Now verify all documents properly
  for (const doc of reviewBeforeDocs.application.documents) {
    await AdmissionService.updateDocumentStatus(
      ctx,
      doc.id,
      'VERIFY',
      'Original document sighted and verified'
    )
  }

  const reviewAfterDocs = await AdmissionService.reviewApplication(ctx, appRes.id)
  assert(reviewAfterDocs.requirements.documentsCheck.isComplete, 'All documents verified successfully')

  // [5] Counselling / Parent & Child Meeting
  console.log('\n[5] Counselling & Parent Meeting')
  const counselRes = await AdmissionService.recordCounselling(ctx, appRes.id, {
    counselorName: 'Mrs. Sunita Deshmukh',
    sessionDate: new Date(),
    outcome: 'POSITIVE',
    mode: 'IN_PERSON',
    notes: 'Child Aarav demonstrated keen curiosity in tactile toys. Parents aligned with gentle separation policy.',
  })
  assert(counselRes.outcome === 'POSITIVE', 'Counselling recorded with POSITIVE outcome')
  assert(counselRes.application.status === 'COUNSELLING', `Status transitioned to COUNSELLING (actual: ${counselRes.application.status})`)

  // [6] Request More Information Flow (Alternative Branch)
  console.log('\n[6] Request More Information (UNDER_REVIEW & Follow-up Task)')
  const reqInfoRes = await AdmissionService.requestMoreInformation(ctx, appRes.id, {
    reason: 'Parent address proof update required',
    note: 'Electricity bill is older than 3 months. Need recent address proof.',
  })
  assert(reqInfoRes.application.status === 'UNDER_REVIEW', 'Status transitioned to UNDER_REVIEW')
  assert(Boolean(reqInfoRes.followUp?.followUp?.id || reqInfoRes.followUp?.id), 'Follow-up task created for admissions staff')

  // [7] Admission Review & Formal Approval Gate (Principal Sign-off)
  console.log('\n[7] Admission Review & Approval Gate')
  const reviewAssessment = await AdmissionService.reviewApplication(ctx, appRes.id)
  assert(reviewAssessment.requirements.ageRequirement.eligible, 'Age eligibility verified (38 months in 30-48 range)')
  assert(reviewAssessment.requirements.documentsCheck.isComplete, 'Documents verification complete')
  assert(reviewAssessment.requirements.feePlanQuote !== null, 'Fee plan quote available')

  const approvedApp = await AdmissionService.approveApplication(
    { ...ctx, actorRole: 'PRINCIPAL', actorName: 'Dr. Anita Joshi (Principal)' },
    appRes.id,
    'All admission requirements met. Approved for Nursery admission.'
  )
  assert(approvedApp.status === 'APPROVED', `Application successfully APPROVED (actual: ${approvedApp.status})`)
  assert(approvedApp.approvedAt !== null, 'approvedAt timestamp set')

  // [8] Fee Template Selection & Offer Generation
  console.log('\n[8] Fee Template Selection & Offer Generation')
  const offerRes = await AdmissionService.generateOffer(ctx, appRes.id, {
    validityDays: 10,
    feePlanId: feePlan.id,
    terms: 'Offer valid for 10 calendar days. Seat reserved upon acceptance.',
  })

  assert(Boolean(offerRes.offer.id), 'Admission offer record created')
  assert(offerRes.offer.offerNumber.startsWith('OFR-'), `Offer number generated: ${offerRes.offer.offerNumber}`)
  assert(offerRes.offer.status === 'ISSUED', 'Offer status is ISSUED')
  assert(offerRes.application.status === 'OFFER_SENT', 'Application status transitioned to OFFER_SENT')
  assert(offerRes.brandedLetter.feeBreakdown.length === 3, 'Offer fee snapshot contains 3 line items')
  assert(offerRes.brandedLetter.payableRupees === 60000, `Payable rupees calculated correctly: ${offerRes.brandedLetter.payableRupees}`)

  // [9] Parent Accepts Offer (Golden Rule Check)
  console.log('\n[9] Parent Accepts Offer (Parent acceptance != Student creation)')
  const acceptRes = await AdmissionService.acceptOffer(ctx, appRes.id, 'Parent accepted offer via phone call')
  assert(acceptRes.offer.status === 'ACCEPTED', 'Offer status updated to ACCEPTED')
  assert(acceptRes.application?.status === 'OFFER_ACCEPTED', 'Application status updated to OFFER_ACCEPTED')

  // Golden Rule Verification: Enforce that accepting an offer does NOT create a Student record or enroll prematurely
  const studentCheckBeforeFinalReview = await db.student.findFirst({
    where: {
      tenantId: tenant.id,
      firstName: 'Aarav',
      lastName: 'Kulkarni',
    },
  })
  assert(studentCheckBeforeFinalReview === null, 'GOLDEN RULE CONFIRMED: Parent acceptance did NOT create a Student record!')

  // [10] Staff Final Review (Boundary Gate of the Application Module)
  console.log('\n[10] Staff Final Review & Handoff to Allocation')
  const finalReviewRes = await AdmissionService.finalStaffReview(
    ctx,
    appRes.id,
    'All verification completed. Ready for downstream classroom allocation.'
  )

  assert(finalReviewRes.readyForNextModule === true, 'Application marked ready for next module')
  assert(finalReviewRes.stage === 'READY_FOR_ALLOCATION', 'Stage confirmed as READY_FOR_ALLOCATION')
  assert(Boolean(finalReviewRes.handoffPayload), 'Structured handoff payload generated')
  assert(finalReviewRes.handoffPayload.applicationId === appRes.id, 'Handoff payload contains correct applicationId')
  assert(finalReviewRes.handoffPayload.childName === 'Aarav Kulkarni', 'Handoff payload contains child name')
  assert(finalReviewRes.handoffPayload.offerId === offerRes.offer.id, 'Handoff payload contains offerId')

  // Verify audit log for final review
  const auditLogs = await db.auditLog.findMany({
    where: {
      tenantId: tenant.id,
      entityId: appRes.id,
      action: 'FINAL_REVIEW_COMPLETED',
    },
  })
  assert(auditLogs.length > 0, 'Audit event FINAL_REVIEW_COMPLETED logged')

  // Verify that even after Staff Final Review, Student is NOT prematurely created
  const studentCheckAfterFinalReview = await db.student.findFirst({
    where: {
      tenantId: tenant.id,
      firstName: 'Aarav',
      lastName: 'Kulkarni',
    },
  })
  assert(studentCheckAfterFinalReview === null, 'FROZEN BOUNDARY CONFIRMED: Staff Final Review stopped cleanly without creating Student!')

  // [11] Decline Offer Workflow
  console.log('\n[11] Parent Decline Offer Alternative Workflow')
  const declineLead = await LeadService.createLead(
    { tenantId: tenant.id, branchId: branch.id, actorId: ctx.actorId, actorName: ctx.actorName },
    {
      parentName: 'Sunil Rao',
      phone: '9822998877',
      childName: 'Tanvi Rao',
      childDob: new Date('2023-03-10'),
      childGender: 'FEMALE',
      interestedProgram: 'NURSERY',
      academicSessionId: session.id,
      source: 'DIRECT_CALL',
    }
  )

  const declineApp = await AdmissionService.submitApplication(ctx, {
    leadId: declineLead.lead.id,
    branchId: branch.id,
    academicSessionId: session.id,
    programType: 'NURSERY',
    programId: program.id,
    childFirstName: 'Tanvi',
    childLastName: 'Rao',
    childDob: new Date('2023-03-10'),
    childGender: 'FEMALE',
    parentName: 'Sunil Rao',
    parentPhone: '9822998877',
  })

  // Verify docs & approve
  const declineDocs = await db.applicationDocument.findMany({ where: { applicationId: declineApp.id } })
  for (const doc of declineDocs) {
    await AdmissionService.updateDocumentStatus(ctx, doc.id, 'VERIFY', 'Original document sighted')
  }
  await AdmissionService.approveApplication(ctx, declineApp.id)
  await AdmissionService.generateOffer(ctx, declineApp.id, 7)

  const declineRes = await AdmissionService.declineOffer(ctx, declineApp.id, 'Family relocating to another city')
  assert(declineRes.offer.status === 'DECLINED', 'Offer status is DECLINED')
  assert(declineRes.application.status === 'WITHDRAWN', 'Application status is WITHDRAWN')

  // [12] Rejection Workflow
  console.log('\n[12] Rejection Workflow with Reason')
  const rejectLead = await LeadService.createLead(
    { tenantId: tenant.id, branchId: branch.id, actorId: ctx.actorId, actorName: ctx.actorName },
    {
      parentName: 'Mahesh Patil',
      phone: '9822776655',
      childName: 'Kabir Patil',
      childDob: new Date('2023-04-15'), // Valid Nursery age (~35 mos)
      childGender: 'MALE',
      interestedProgram: 'NURSERY',
      academicSessionId: session.id,
      source: 'WEBSITE',
    }
  )

  const rejectApp = await AdmissionService.submitApplication(ctx, {
    leadId: rejectLead.lead.id,
    branchId: branch.id,
    academicSessionId: session.id,
    programType: 'NURSERY',
    childFirstName: 'Kabir',
    childLastName: 'Patil',
    childDob: new Date('2023-04-15'),
    childGender: 'MALE',
    parentName: 'Mahesh Patil',
    parentPhone: '9822776655',
  })

  const rejectedResult = await AdmissionService.rejectApplication(ctx, rejectApp.id, {
    reason: 'Parents declined school timings and distance',
    notes: 'Advised parent to seek branch closer to their residence',
  })
  assert(rejectedResult.status === 'REJECTED', 'Application status is REJECTED')
  assert(rejectedResult.rejectionReason?.includes('Parents declined') === true, 'Rejection reason stored')

  // Summary
  console.log('\n====================================================================')
  console.log(`APPLICATION SUBSYSTEM TEST SUMMARY: ${passed} passed, ${failed} failed`)
  console.log('====================================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('Unhandled test suite error:', err)
  process.exit(1)
})
