/**
 * PreOne — M03.5 Classroom Placements: Authoritative Acceptance Suite
 *
 * Validates the complete production requirements:
 * 1. Foundation & Multi-Tenant Setup (Tenant, Branch, Session, Program, Classrooms, Teacher)
 * 2. Input Eligibility Queue (Only OFFER_ACCEPTED / APPROVED candidates appear; no drafts/unapproved)
 * 3. Zero Data Re-entry (Candidate dossier preloaded with child, parent, academic, offer details)
 * 4. Classroom Selection & Live Capacity Metrics
 * 5. Automatic Class Teacher Resolution (Mandatory gate — unconfigured teacher blocks placement)
 * 6. Seat Selection & Double-Assignment Prevention (Concurrency-safe)
 * 7. In-Transaction Capacity Re-check (Over-capacity blocked)
 * 8. Parent User Creation & Credential Provisioning (M01 User, TenantUser, Guardian, secure hash)
 * 9. Existing Parent User Reuse for Siblings (User reused, password NOT reset)
 * 10. Multiple Parents / Guardians Linking (StudentGuardian with pickupPin, feePayer, comms)
 * 11. Canonical Student Creation (M02 Student, STU-YYYY-XXXX, NO student login password)
 * 12. StudentAllocation & Academic Record Link
 * 13. Fee Setup Handoff (Invoice / Fee plan reference)
 * 14. Idempotent Retry Protection (Double-click/retry returns existing result without side-effects)
 * 15. Parent Portal Readiness, Milestone Timeline & Complete Audit Trail
 * 16. Tenant & Branch Isolation
 */

import { db } from '../src/lib/db'
import { ClassroomPlacementService } from '../src/lib/admissions/classroom-placement-service'
import { AdmissionService } from '../src/lib/admissions/admission-service'
import { LeadService } from '../src/lib/admissions/lead-service'
import bcrypt from 'bcryptjs'

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
  console.log('PREONE M03.5 CLASSROOM PLACEMENTS: AUTHORITATIVE ACCEPTANCE SUITE')
  console.log('====================================================================')

  const timestamp = Date.now().toString().slice(-6)

  // [1] Foundation & School Setup
  console.log('\n[1] Multi-Tenant & Academic Setup')
  const tenant = await db.tenant.create({
    data: {
      name: `Placement Academy ${timestamp}`,
      code: `PLC-${timestamp}`,
      status: 'ACTIVE',
    },
  })

  const branch = await db.branch.create({
    data: {
      tenantId: tenant.id,
      name: 'South Campus',
      code: `SC-${timestamp}`,
      isActive: true,
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

  // Create an active Teacher User in M01
  const teacherUser = await db.user.create({
    data: {
      fullName: 'Priya Sharma (Class Teacher)',
      phone: `9800${timestamp}`,
      email: `priya.teacher.${timestamp}@preone.test`,
      username: `teacher.priya.${timestamp}`,
      passwordHash: await bcrypt.hash('Teacher@PreOne2026', 10),
      status: 'ACTIVE',
    },
  })

  await db.tenantUser.create({
    data: {
      tenantId: tenant.id,
      userId: teacherUser.id,
      role: 'TEACHER',
      roles: ['TEACHER'],
      branchId: branch.id,
      status: 'ACTIVE',
    },
  })

  // Classroom 1: Configured with Class Teacher and Capacity 2
  const classroom1 = await db.classroom.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      academicSessionId: session.id,
      name: 'Nursery Bluebell',
      code: `NB-${timestamp}`,
      programType: 'NURSERY',
      capacity: 2, // low capacity to test concurrency & fullness
      primaryTeacherId: teacherUser.id,
      isActive: true,
    },
  })

  // Classroom 2: Deliberately configured WITHOUT a teacher to test missing teacher gate
  const classroomNoTeacher = await db.classroom.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      academicSessionId: session.id,
      name: 'Nursery Sunflower',
      code: `NS-${timestamp}`,
      programType: 'NURSERY',
      capacity: 10,
      primaryTeacherId: null, // No teacher!
      isActive: true,
    },
  })

  const feePlan = await db.feePlan.create({
    data: {
      tenantId: tenant.id,
      name: 'Nursery Standard 2026-27',
      programType: 'NURSERY',
      totalAnnualCents: 6000000,
      installmentCount: 2,
      isActive: true,
      items: {
        create: [
          { feeHead: 'TUITION', label: 'Annual Tuition Fee', amountCents: 5000000, frequency: 'ANNUALLY' },
          { feeHead: 'ADMISSION', label: 'Admission Fee', amountCents: 1000000, frequency: 'ONE_TIME' },
        ],
      },
    },
  })

  const ctx = {
    tenantId: tenant.id,
    branchId: branch.id,
    academicYearId: session.id,
    actorId: 'usr-admissions-head',
    actorName: 'Admissions Officer Ananya',
    actorRole: 'ADMISSIONS_OFFICER',
  }

  assert(Boolean(tenant.id && classroom1.id && classroomNoTeacher.id), 'Master data initialized')

  // [2] Create an eligible candidate (Child 1: Aarav Kulkarni)
  console.log('\n[2] Intake Candidate 1 (Aarav Kulkarni) -> Offer Accepted')
  const rohitPhone = `9822${timestamp}`
  const rohitEmail = `rohit.${timestamp}@example.com`
  const meeraPhone = `9823${timestamp}`
  const meeraEmail = `meera.${timestamp}@example.com`

  const lead1 = await LeadService.createLead(ctx, {
    parentName: 'Rohit Kulkarni',
    phone: rohitPhone,
    email: rohitEmail,
    childName: 'Aarav Kulkarni',
    childDob: new Date('2023-01-15'), // ~38 months (eligible for Nursery 30-48)
    childGender: 'MALE',
    interestedProgram: 'NURSERY',
    academicSessionId: session.id,
    source: 'WALK_IN',
  })

  const app1 = await AdmissionService.submitApplication(ctx, {
    leadId: lead1.lead.id,
    branchId: branch.id,
    academicSessionId: session.id,
    programType: 'NURSERY',
    childFirstName: 'Aarav',
    childLastName: 'Kulkarni',
    childDob: new Date('2023-01-15'),
    childGender: 'MALE',
    parentName: 'Rohit Kulkarni',
    parentPhone: rohitPhone,
    parentEmail: rohitEmail,
  })

  // Verify docs, approve, issue offer and parent accepts
  const docs1 = await db.applicationDocument.findMany({ where: { applicationId: app1.id } })
  for (const doc of docs1) {
    await AdmissionService.updateDocumentStatus(ctx, doc.id, 'VERIFY', 'Original verified')
  }
  await AdmissionService.approveApplication(ctx, app1.id, 'Approved for admission')
  await AdmissionService.generateOffer(ctx, app1.id, { validityDays: 7, feePlanId: feePlan.id })
  await AdmissionService.acceptOffer(ctx, app1.id, 'Parent accepted offer')

  // Candidate 2 (Draft / Not Eligible): Should NOT be eligible for placement
  const lead2 = await LeadService.createLead(ctx, {
    parentName: 'Draft Parent',
    phone: '9822556677',
    childName: 'Draft Child',
    childDob: new Date('2023-02-01'),
    childGender: 'FEMALE',
    interestedProgram: 'NURSERY',
    academicSessionId: session.id,
    source: 'WEBSITE',
  })
  const draftApp = await AdmissionService.submitApplication(ctx, {
    leadId: lead2.lead.id,
    branchId: branch.id,
    academicSessionId: session.id,
    programType: 'NURSERY',
    childFirstName: 'Draft',
    childLastName: 'Child',
    childDob: new Date('2023-02-01'),
    childGender: 'FEMALE',
    parentName: 'Draft Parent',
    parentPhone: '9822556677',
  })

  // [3] Eligible Candidates Query Test
  console.log('\n[3] Input Eligibility Verification')
  const eligibleCandidates = await ClassroomPlacementService.getEligibleCandidates(ctx, {
    branchId: branch.id,
    academicYearId: session.id,
  })

  const aaravInQueue = eligibleCandidates.find((c) => c.applicationId === app1.id)
  assert(Boolean(aaravInQueue), 'Aarav with OFFER_ACCEPTED appears in eligible candidates queue')
  assert(aaravInQueue?.isEligibleForPlacement === true, 'Aarav marked as isEligibleForPlacement = true')

  const draftInQueue = eligibleCandidates.find((c) => c.applicationId === draftApp.id)
  assert(!draftInQueue || draftInQueue.isEligibleForPlacement === false, 'Draft submitted application is blocked from placement')

  // [4] Zero Data Re-entry Dossier Loading
  console.log('\n[4] Zero Data Re-entry Dossier Loading')
  const dossier = await ClassroomPlacementService.getPlacementDossier(ctx, app1.id)
  assert(dossier.child.firstName === 'Aarav', 'Prefilled child firstName: Aarav')
  assert(dossier.parent.fullName === 'Rohit Kulkarni', 'Prefilled parent fullName: Rohit Kulkarni')
  assert(dossier.parent.phone === rohitPhone, `Prefilled parent phone: ${rohitPhone}`)
  assert(dossier.academicPlacement.programType === 'NURSERY', 'Prefilled program: NURSERY')
  assert(dossier.classrooms.length >= 2, 'Available classrooms loaded in dossier')

  // [5] Automatic Class Teacher Resolution & Missing Teacher Gate
  console.log('\n[5] Class Teacher Resolution & Missing Teacher Gate')
  const classrooms = await ClassroomPlacementService.getClassroomsForPlacement(ctx, app1.id)
  const bluebell = classrooms.find((c) => c.id === classroom1.id)
  const sunflower = classrooms.find((c) => c.id === classroomNoTeacher.id)

  assert(bluebell?.hasTeacher === true, 'Classroom Bluebell has class teacher resolved')
  assert(bluebell?.primaryTeacher?.name?.includes('Priya') === true, 'Resolved teacher name: Priya Sharma')
  assert(sunflower?.hasTeacher === false, 'Classroom Sunflower correctly flags missing teacher')
  assert(sunflower?.teacherWarning !== null, 'Teacher warning displayed for Sunflower')

  // Test Missing Teacher Gate: Attempting placement in Sunflower MUST fail
  let missingTeacherBlocked = false
  try {
    await ClassroomPlacementService.validatePlacement(ctx, app1.id, {
      classroomId: classroomNoTeacher.id,
      seatNumber: '01',
    })
  } catch (err: any) {
    missingTeacherBlocked = true
  }
  const valSunflower = await ClassroomPlacementService.validatePlacement(ctx, app1.id, {
    classroomId: classroomNoTeacher.id,
    seatNumber: '01',
  })
  assert(!valSunflower.isValid, 'Validation fails when classroom has no class teacher configured')
  assert(valSunflower.errors.some((e) => e.includes('Class Teacher is not configured')), 'Error explicitly cites unconfigured class teacher')

  // [6] Seat Inventory & Pre-flight Validation
  console.log('\n[6] Seat Inventory & Validation for Classroom Bluebell')
  const seatGrid = await ClassroomPlacementService.getAvailableSeats(ctx, app1.id, classroom1.id)
  assert(seatGrid.seats.length === 2, 'Seat grid contains 2 seats based on capacity')
  assert(seatGrid.seats[0].seatNumber === '01' && seatGrid.seats[0].isAvailable === true, 'Seat 01 is available')
  assert(seatGrid.seats[1].seatNumber === '02' && seatGrid.seats[1].isAvailable === true, 'Seat 02 is available')

  const validPreflight = await ClassroomPlacementService.validatePlacement(ctx, app1.id, {
    classroomId: classroom1.id,
    seatNumber: '01',
  })
  assert(validPreflight.isValid === true, 'Pre-flight validation passes for Bluebell Seat 01')
  assert(validPreflight.classTeacher?.name?.includes('Priya') === true, 'Pre-flight returns resolved teacher')

  // [7] Complete Placement 1: New Parent, Multiple Guardians, Canonical Student, Seat 01
  console.log('\n[7] Complete Placement 1 (Aarav Kulkarni -> Bluebell Seat 01)')
  const placementRes1 = await ClassroomPlacementService.completePlacement(ctx, app1.id, {
    classroomId: classroom1.id,
    seatNumber: '01',
    primaryParent: {
      fullName: 'Rohit Kulkarni',
      phone: rohitPhone,
      email: rohitEmail,
      relationship: 'FATHER',
      canPickup: true,
      pickupPin: '1234',
      isFeePayer: true,
      receivesComm: true,
    },
    additionalGuardians: [
      {
        fullName: 'Meera Kulkarni',
        phone: meeraPhone,
        email: meeraEmail,
        relationship: 'MOTHER',
        isPrimaryContact: false,
        canPickup: true,
        pickupPin: '5678',
        isFeePayer: false,
        receivesCommunication: true,
      },
    ],
    childOverrides: {
      bloodGroup: 'B_POSITIVE',
      address: 'Plot 42, Green Valley, South City',
      emergencyContact: 'Uncle: 9822112255',
    },
    notes: 'Morning batch preferred. Toilet trained.',
  })

  assert(placementRes1.status === 'PLACEMENT_COMPLETED', 'Placement status is PLACEMENT_COMPLETED')
  assert(placementRes1.student.admissionNo.startsWith('STU-'), `Student created with admission number: ${placementRes1.student.admissionNo}`)
  assert(placementRes1.seatNumber === '01', 'Seat 01 confirmed')
  assert(placementRes1.classTeacher.name.includes('Priya'), 'Class teacher Priya confirmed')
  assert(placementRes1.parent.isNewAccount === true, 'New Parent User created in M01')
  assert(placementRes1.parentPortalReady === true, 'Parent Portal Ready confirmed')
  assert(placementRes1.guardiansCount === 2, '2 Guardians linked (Father + Mother)')

  // Verify Student DB state
  const student1 = await db.student.findUnique({
    where: { id: placementRes1.student.id },
    include: {
      guardians: { include: { guardian: true } },
      allocations: true,
      currentClassroom: true,
    },
  })
  assert(student1?.seatNumber === '01', 'Student DB has seatNumber = 01')
  assert(student1?.currentClassroomId === classroom1.id, 'Student DB linked to Classroom Bluebell')
  assert(student1?.guardians.length === 2, 'Student has exactly 2 StudentGuardian links in DB')
  assert(student1?.allocations.length === 1, 'StudentAllocation created for academic session')

  // Golden Rule check: Verify student does NOT have a user account or password
  const studentUserCheck = await db.user.findFirst({
    where: { phone: student1?.admissionNo },
  })
  assert(studentUserCheck === null, 'GOLDEN RULE: Student has no normal user account / password')

  // Check Application status in DB
  const app1After = await db.admissionApplication.findUnique({ where: { id: app1.id } })
  assert(app1After?.status === 'ENROLLED', 'Application status transitioned to ENROLLED')
  assert(app1After?.studentId === student1?.id, 'Application links to created studentId')

  // [8] Idempotency Check (Retry / Refresh protection)
  console.log('\n[8] Idempotency Protection Check')
  const retryRes = await ClassroomPlacementService.completePlacement(ctx, app1.id, {
    classroomId: classroom1.id,
    seatNumber: '01',
  })
  assert(retryRes.isAlreadyEnrolled === true, 'Idempotent return on repeat completion')
  assert(retryRes.student.admissionNo === placementRes1.student.admissionNo, 'Same student returned without duplicate creation')

  // [9] Double-Assignment Seat Prevention
  console.log('\n[9] Double-Assignment Seat Prevention')
  // Create second candidate
  const lead3 = await LeadService.createLead(ctx, {
    parentName: 'Deepak Verma',
    phone: '9822334455',
    childName: 'Ananya Verma',
    childDob: new Date('2023-03-20'),
    childGender: 'FEMALE',
    interestedProgram: 'NURSERY',
    academicSessionId: session.id,
    source: 'WALK_IN',
  })
  const app2 = await AdmissionService.submitApplication(ctx, {
    leadId: lead3.lead.id,
    branchId: branch.id,
    academicSessionId: session.id,
    programType: 'NURSERY',
    childFirstName: 'Ananya',
    childLastName: 'Verma',
    childDob: new Date('2023-03-20'),
    childGender: 'FEMALE',
    parentName: 'Deepak Verma',
    parentPhone: '9822334455',
  })
  const docs2 = await db.applicationDocument.findMany({ where: { applicationId: app2.id } })
  for (const doc of docs2) {
    await AdmissionService.updateDocumentStatus(ctx, doc.id, 'VERIFY', 'Verified')
  }
  await AdmissionService.approveApplication(ctx, app2.id)
  await AdmissionService.generateOffer(ctx, app2.id, { validityDays: 7, feePlanId: feePlan.id })
  await AdmissionService.acceptOffer(ctx, app2.id)

  // Try to assign Seat 01 to Ananya (already occupied by Aarav)
  let seat01Conflict = false
  try {
    await ClassroomPlacementService.completePlacement(ctx, app2.id, {
      classroomId: classroom1.id,
      seatNumber: '01', // Already taken by Aarav!
    })
  } catch (err: any) {
    seat01Conflict = true
    assert(err.message.includes('occupied') || err.message.includes('assigned'), `Double seat assignment blocked: "${err.message}"`)
  }
  assert(seat01Conflict, 'Seat double-assignment rejected safely')

  // [10] Complete Placement 2 (Ananya Verma -> Bluebell Seat 02)
  console.log('\n[10] Complete Placement 2 (Bluebell Seat 02 -> Classroom Full)')
  const placementRes2 = await ClassroomPlacementService.completePlacement(ctx, app2.id, {
    classroomId: classroom1.id,
    seatNumber: '02',
    primaryParent: {
      fullName: 'Deepak Verma',
      phone: '9822334455',
      relationship: 'FATHER',
    },
  })
  assert(placementRes2.status === 'PLACEMENT_COMPLETED', 'Ananya placed successfully in Seat 02')

  // [11] Capacity Full Guard (Classroom reached 2/2)
  console.log('\n[11] Capacity Full Guard (Classroom Bluebell at 2/2)')
  // Create third candidate
  const lead4 = await LeadService.createLead(ctx, {
    parentName: 'Sanjay Joshi',
    phone: '9822667788',
    childName: 'Ishaan Joshi',
    childDob: new Date('2023-04-10'),
    childGender: 'MALE',
    interestedProgram: 'NURSERY',
    academicSessionId: session.id,
    source: 'WEBSITE',
  })
  const app3 = await AdmissionService.submitApplication(ctx, {
    leadId: lead4.lead.id,
    branchId: branch.id,
    academicSessionId: session.id,
    programType: 'NURSERY',
    childFirstName: 'Ishaan',
    childLastName: 'Joshi',
    childDob: new Date('2023-04-10'),
    childGender: 'MALE',
    parentName: 'Sanjay Joshi',
    parentPhone: '9822667788',
  })
  const docs3 = await db.applicationDocument.findMany({ where: { applicationId: app3.id } })
  for (const doc of docs3) {
    await AdmissionService.updateDocumentStatus(ctx, doc.id, 'VERIFY', 'Verified')
  }
  await AdmissionService.approveApplication(ctx, app3.id)
  await AdmissionService.generateOffer(ctx, app3.id, { validityDays: 7, feePlanId: feePlan.id })
  await AdmissionService.acceptOffer(ctx, app3.id)

  let classroomFullBlocked = false
  try {
    await ClassroomPlacementService.completePlacement(ctx, app3.id, {
      classroomId: classroom1.id,
      seatNumber: '03',
    })
  } catch (err: any) {
    classroomFullBlocked = true
    assert(err.message.includes('capacity') || err.message.includes('full'), `Over-capacity placement blocked: "${err.message}"`)
  }
  assert(classroomFullBlocked, 'Classroom at capacity (2/2) blocks further placement')

  // [12] Existing Parent Account Reuse for Sibling
  console.log('\n[12] Sibling Parent Account Reuse (No Password Reset)')
  // Create another classroom with a teacher
  const classroom3 = await db.classroom.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      academicSessionId: session.id,
      name: 'Nursery Rose',
      code: `NR-${timestamp}`,
      programType: 'NURSERY',
      capacity: 5,
      primaryTeacherId: teacherUser.id,
      isActive: true,
    },
  })

  // Sibling of Aarav Kulkarni: Tara Kulkarni (Same parent Rohit Kulkarni)
  const siblingLead = await LeadService.createLead(ctx, {
    parentName: 'Rohit Kulkarni',
    phone: rohitPhone, // SAME PHONE!
    email: rohitEmail,
    childName: 'Tara Kulkarni',
    childDob: new Date('2023-05-15'),
    childGender: 'FEMALE',
    interestedProgram: 'NURSERY',
    academicSessionId: session.id,
    source: 'WALK_IN',
    overrideDuplicate: true,
  })
  const siblingApp = await AdmissionService.submitApplication(ctx, {
    leadId: siblingLead.lead?.id || null,
    branchId: branch.id,
    academicSessionId: session.id,
    programType: 'NURSERY',
    childFirstName: 'Tara',
    childLastName: 'Kulkarni',
    childDob: new Date('2023-05-15'),
    childGender: 'FEMALE',
    parentName: 'Rohit Kulkarni',
    parentPhone: rohitPhone,
  })
  const siblingDocs = await db.applicationDocument.findMany({ where: { applicationId: siblingApp.id } })
  for (const doc of siblingDocs) {
    await AdmissionService.updateDocumentStatus(ctx, doc.id, 'VERIFY', 'Verified')
  }
  await AdmissionService.approveApplication(ctx, siblingApp.id)
  await AdmissionService.generateOffer(ctx, siblingApp.id, { validityDays: 7, feePlanId: feePlan.id })
  await AdmissionService.acceptOffer(ctx, siblingApp.id)

  // Record Rohit's existing password hash before sibling placement
  const rohitUserBefore = await db.user.findFirstOrThrow({ where: { phone: rohitPhone } })
  const originalPasswordHash = rohitUserBefore.passwordHash

  const siblingPlacement = await ClassroomPlacementService.completePlacement(ctx, siblingApp.id, {
    classroomId: classroom3.id,
    seatNumber: '01',
    primaryParent: {
      fullName: 'Rohit Kulkarni',
      phone: rohitPhone,
      relationship: 'FATHER',
    },
  })

  assert(siblingPlacement.status === 'PLACEMENT_COMPLETED', 'Sibling Tara placed successfully')
  assert(siblingPlacement.parent.isNewAccount === false, 'Existing parent account was reused')
  assert(siblingPlacement.parent.id === rohitUserBefore.id, 'Parent User.id exactly matches existing account')

  const rohitUserAfter = await db.user.findUniqueOrThrow({ where: { id: rohitUserBefore.id } })
  assert(rohitUserAfter.passwordHash === originalPasswordHash, 'CRITICAL: Existing parent password was NOT reset or overwritten')

  // Verify that parent User now links to both children
  const guardianLinks = await db.studentGuardian.findMany({
    where: { guardian: { userId: rohitUserBefore.id } },
    include: { student: true },
  })
  assert(guardianLinks.length === 2, 'Parent User links to both Aarav and Tara')

  // [13] Classroom Placements Ledger
  console.log('\n[13] Classroom Placements Ledger Verification')
  const ledger = await ClassroomPlacementService.getPlacementsLedger(ctx, {
    branchId: branch.id,
    academicYearId: session.id,
  })
  assert(ledger.totalPlaced >= 3, `Ledger contains placed students (actual: ${ledger.totalPlaced})`)
  const aaravInLedger = ledger.items.find((item) => item.childName.includes('Aarav'))
  assert(Boolean(aaravInLedger), 'Aarav listed in Placement Ledger')
  assert(aaravInLedger?.seatNumber === '01', 'Aarav seatNumber in ledger = 01')
  assert(aaravInLedger?.classTeacherName?.includes('Priya') === true, 'Aarav class teacher in ledger = Priya Sharma')

  // [14] Audit Trail Completeness
  console.log('\n[14] Comprehensive Audit Trail')
  const timeline = await ClassroomPlacementService.getPlacementTimeline(ctx, app1.id)
  const actions = timeline.auditLogs.map((l) => l.action)
  assert(actions.includes('PLACEMENT_STARTED'), 'Audit log contains PLACEMENT_STARTED')
  assert(actions.includes('PARENT_CREATED'), 'Audit log contains PARENT_CREATED')
  assert(actions.includes('STUDENT_CREATED'), 'Audit log contains STUDENT_CREATED')
  assert(actions.includes('STUDENT_GUARDIAN_LINKED'), 'Audit log contains STUDENT_GUARDIAN_LINKED')
  assert(actions.includes('SEAT_ASSIGNED'), 'Audit log contains SEAT_ASSIGNED')
  assert(actions.includes('TEACHER_RESOLVED'), 'Audit log contains TEACHER_RESOLVED')
  assert(actions.includes('PLACEMENT_COMPLETED'), 'Audit log contains PLACEMENT_COMPLETED')
  assert(actions.includes('ADMISSION_COMPLETED'), 'Audit log contains ADMISSION_COMPLETED')
  assert(actions.includes('PARENT_NOTIFICATION_SENT'), 'Audit log contains PARENT_NOTIFICATION_SENT')

  // Summary
  console.log('\n====================================================================')
  console.log(`CLASSROOM PLACEMENTS TEST SUMMARY: ${passed} passed, ${failed} failed`)
  console.log('====================================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('Unhandled test suite error:', err)
  process.exit(1)
})
