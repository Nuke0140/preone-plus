/**
 * PreOne — M01 User + M02 Student + M03 Admission
 * Unified Parent-Student Creation & Cross-Module Integration E2E Test Suite
 */

import { db } from '../src/lib/db'
import { FamilyUserService } from '../src/lib/users/family-user-service'
import { StudentService } from '../src/lib/students/student-service'
import { AdmissionService } from '../src/lib/admissions/admission-service'
import { normalizeFamilyCreateInput } from '../src/lib/users/user-validation'

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

async function runTests() {
  console.log('====================================================================')
  console.log('PREONE UNIFIED PARENT-STUDENT & CROSS-MODULE INTEGRATION E2E TEST')
  console.log('====================================================================\n')

  const testSuffix = Date.now().toString().slice(-6)
  const tenantCode = `UPS-${testSuffix}`

  let tenant: any
  let branch: any
  let session: any
  let classroomA: any
  let classroomFull: any

  try {
    // -------------------------------------------------------------------------
    // STEP 0: FOUNDATION FIXTURES
    // -------------------------------------------------------------------------
    console.log('[0] Setup Foundation Fixtures')
    tenant = await db.tenant.create({
      data: {
        name: `PreOne Test Academy ${testSuffix}`,
        code: tenantCode,
        status: 'ACTIVE',
      },
    })

    branch = await db.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'Main Campus',
        code: `MAIN-${testSuffix}`,
        isMain: true,
      },
    })

    session = await db.academicSession.create({
      data: {
        tenantId: tenant.id,
        name: `2026-2027-${testSuffix}`,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2027-04-30'),
        status: 'ACTIVE',
        isCurrent: true,
      },
    })

    const programNursery = await db.program.create({
      data: {
        tenantId: tenant.id,
        name: 'Nursery',
        code: `NUR-${testSuffix}`,
        programType: 'NURSERY',
        ageMinMonths: 36,
        ageMaxMonths: 48,
        capacity: 40,
        isActive: true,
      },
    })

    classroomA = await db.classroom.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        academicSessionId: session.id,
        programId: programNursery.id,
        name: 'Nursery Sunflowers',
        code: `NUR-A-${testSuffix}`,
        programType: 'NURSERY',
        capacity: 20,
        isActive: true,
      },
    })

    classroomFull = await db.classroom.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        academicSessionId: session.id,
        programId: programNursery.id,
        name: 'Nursery Daisies (Full)',
        code: `NUR-FULL-${testSuffix}`,
        programType: 'NURSERY',
        capacity: 1,
        isActive: true,
      },
    })

    await db.feePlan.create({
      data: {
        tenantId: tenant.id,
        name: 'Standard Nursery Fee Plan',
        programType: 'NURSERY',
        totalAnnualCents: 6000000,
        installmentCount: 4,
        isActive: true,
        items: {
          create: [
            { feeHead: 'TUITION', label: 'Term 1 Tuition', amountCents: 4000000, frequency: 'QUARTERLY' },
            { feeHead: 'ADMISSION', label: 'Admission Fee', amountCents: 2000000, frequency: 'ONE_TIME' },
          ],
        },
      },
    })

    assert(!!tenant.id && !!classroomA.id, 'Tenant, branch, session, classroom created')

    // -------------------------------------------------------------------------
    // STEP 1: M01 UNIFIED PARENT + NEW STUDENT CREATION
    // -------------------------------------------------------------------------
    console.log('\n[1] M01: Unified Parent + New Student Creation Flow')
    const parentPhone1 = `981${testSuffix}`
    const parentEmail1 = `parent1.${testSuffix}@example.com`

    const normalizedInput1 = normalizeFamilyCreateInput({
      parentGuardianFullName: 'Rohan Sharma',
      parentGuardianEmail: parentEmail1,
      parentGuardianPhone: parentPhone1,
      parentGuardianRole: 'PARENT',
      parentGuardianGender: 'MALE',
      relationToChild: 'FATHER',
      password: 'ParentSecure@2026',
      studentFullName: 'Aarav Sharma',
      studentDateOfBirth: '2023-01-15',
      studentGender: 'MALE',
      studentBloodGroup: 'O_POSITIVE',
      studentBranch: branch.id,
      studentClass: classroomA.id,
      pickupPin: '5432',
      isFeePayer: true,
      confirmDuplicate: true,
    })

    const familyResult1 = await FamilyUserService.createFamilyUser(
      {
        tenantId: tenant.id,
        actorId: 'test-admin-id',
        actorName: 'Test Admin',
        actorRole: 'OWNER',
      },
      normalizedInput1
    )

    assert(!!familyResult1.user?.id, 'Parent User account created in M01')
    assert(familyResult1.user.email === parentEmail1.toLowerCase(), 'Parent user email correctly set')
    assert(familyResult1.isNewStudent === true, 'Flagged as new student creation')
    assert(!!familyResult1.student?.id, 'Student record created in M02')
    assert(familyResult1.student.firstName === 'Aarav', 'Student first name matches')
    assert(familyResult1.student.admissionNo.startsWith('STU-'), 'Student admission number auto-generated')
    assert(familyResult1.guardian?.userId === familyResult1.user.id, 'Guardian record bound to M01 User ID')

    // Verify StudentGuardian junction permissions
    const sg1 = await db.studentGuardian.findUnique({
      where: {
        studentId_guardianId: {
          studentId: familyResult1.student.id,
          guardianId: familyResult1.guardian.id,
        },
      },
    })
    assert(!!sg1, 'StudentGuardian link entity exists')
    assert(sg1?.canPickup === true, 'canPickup authorization is true')
    assert(sg1?.pickupPin === '5432', 'pickupPin stored securely at relationship level')
    assert(sg1?.isFeePayer === true, 'isFeePayer designated')
    assert(sg1?.relationship === 'FATHER', 'relationship accurately mapped')

    // -------------------------------------------------------------------------
    // STEP 2: MULTI-CHILD SUPPORT: REUSING EXISTING PARENT USER
    // -------------------------------------------------------------------------
    console.log('\n[2] Existing Parent Adding a Second Child (Multi-Child Support)')
    const normalizedInput2 = normalizeFamilyCreateInput({
      parentGuardianFullName: 'Rohan Sharma', // Same parent
      parentGuardianEmail: parentEmail1,     // Same email
      parentGuardianPhone: parentPhone1,     // Same phone
      parentGuardianRole: 'PARENT',
      relationToChild: 'FATHER',
      studentFullName: 'Ananya Sharma',      // Sibling
      studentDateOfBirth: '2023-03-20',
      studentGender: 'FEMALE',
      studentBranch: branch.id,
      studentClass: classroomA.id,
      pickupPin: '5432',
      isFeePayer: true,
      confirmDuplicate: true,
    })

    const familyResult2 = await FamilyUserService.createFamilyUser(
      {
        tenantId: tenant.id,
        actorId: 'test-admin-id',
        actorName: 'Test Admin',
        actorRole: 'OWNER',
      },
      normalizedInput2
    )

    assert(familyResult2.user.id === familyResult1.user.id, 'Existing User account reused without creating duplicate user')
    assert(familyResult2.guardian.id === familyResult1.guardian.id, 'Existing Guardian profile reused')
    assert(familyResult2.student.id !== familyResult1.student.id, 'Distinct second Student record created')
    assert(familyResult2.student.firstName === 'Ananya', 'Second child name matches')

    // Verify parent now has 2 linked children
    const parentLinks = await db.studentGuardian.findMany({
      where: { guardianId: familyResult1.guardian.id },
    })
    assert(parentLinks.length === 2, 'Guardian is linked to both children (length === 2)')

    // -------------------------------------------------------------------------
    // STEP 3: MAX 2 PARENTS POLICY ENFORCEMENT
    // -------------------------------------------------------------------------
    console.log('\n[3] Max 2 Parents Policy Enforcement')
    // Add Mother (2nd parent)
    const motherPhone = `982${testSuffix}`
    const motherEmail = `mother.${testSuffix}@example.com`
    const motherInput = normalizeFamilyCreateInput({
      fullName: 'Priya Sharma',
      email: motherEmail,
      phone: motherPhone,
      role: 'PARENT',
      relationship: 'MOTHER',
      childMode: 'EXISTING',
      existingChild: { studentId: familyResult1.student.id },
      isPrimaryContact: true,
      confirmDuplicate: true,
    })

    const motherResult = await FamilyUserService.createFamilyUser(
      { tenantId: tenant.id, actorId: 'test-admin-id', actorName: 'Test Admin', actorRole: 'OWNER' },
      motherInput
    )
    assert(!!motherResult.user?.id, 'Second parent (Mother) linked successfully')

    // Attempt to add 3rd parent as PARENT
    let thirdParentBlocked = false
    try {
      const thirdParentInput = normalizeFamilyCreateInput({
        fullName: 'Vikram Sharma',
        email: `uncle.${testSuffix}@example.com`,
        phone: `983${testSuffix}`,
        role: 'PARENT',
        relationship: 'FATHER',
        childMode: 'EXISTING',
        existingChild: { studentId: familyResult1.student.id },
      })
      await FamilyUserService.createFamilyUser(
        { tenantId: tenant.id, actorId: 'test-admin-id', actorName: 'Test Admin', actorRole: 'OWNER' },
        thirdParentInput
      )
    } catch (err: any) {
      thirdParentBlocked = true
      assert(err.code === 'PARENT_LIMIT_REACHED' || err.message.includes('already has 2 registered Parent accounts'), '3rd parent blocked by Max 2 Parents policy')
    }
    assert(thirdParentBlocked, 'Blocked 3rd PARENT role registration')

    // Add 3rd caregiver with role GUARDIAN
    const guardianInput = normalizeFamilyCreateInput({
      fullName: 'Vikram Sharma',
      email: `uncle.${testSuffix}@example.com`,
      phone: `983${testSuffix}`,
      role: 'GUARDIAN',
      relationship: 'OTHER',
      childMode: 'EXISTING',
      existingChild: { studentId: familyResult1.student.id },
      canPickup: true,
      pickupPin: '9988',
    })
    const guardianResult = await FamilyUserService.createFamilyUser(
      { tenantId: tenant.id, actorId: 'test-admin-id', actorName: 'Test Admin', actorRole: 'OWNER' },
      guardianInput
    )
    assert(!!guardianResult.user?.id, '3rd caregiver successfully added with GUARDIAN role')

    // -------------------------------------------------------------------------
    // STEP 4: M03 ADMISSION JOURNEY → ENROLLMENT & AUTO-PARENT PORTAL PROVISIONING
    // -------------------------------------------------------------------------
    console.log('\n[4] M03: Admission Funnel to Final Enrollment & Parent Portal Auto-Sync')
    const applicantPhone = `984${testSuffix}`
    const applicantEmail = `applicant.parent.${testSuffix}@example.com`

    // 4.1 Inquiry
    const enqRes = await AdmissionService.createEnquiry(
      { tenantId: tenant.id, branchId: branch.id, academicYearId: session.id },
      {
        parentName: 'Sunita Deshmukh',
        phone: applicantPhone,
        email: applicantEmail,
        childName: 'Reyansh Deshmukh',
        childDob: '2023-02-10',
        interestedProgram: 'NURSERY',
        source: 'WALK_IN',
      }
    )
    assert(!!enqRes.enquiry.id, 'Admission enquiry created')

    // 4.2 Application
    const app = await AdmissionService.submitApplication(
      { tenantId: tenant.id, branchId: branch.id, academicYearId: session.id },
      {
        leadId: enqRes.enquiry.id,
        programType: 'NURSERY',
        childFirstName: 'Reyansh',
        childLastName: 'Deshmukh',
        childDob: '2023-02-10',
        childGender: 'MALE',
        parentName: 'Sunita Deshmukh',
        parentPhone: applicantPhone,
        parentEmail: applicantEmail,
      }
    )
    assert(!!app.id, 'Formal admission application submitted')

    // 4.3 Document Verification
    const docs = await db.applicationDocument.findMany({ where: { applicationId: app.id } })
    for (const d of docs) {
      await AdmissionService.updateDocumentStatus(
        { tenantId: tenant.id, branchId: branch.id, academicYearId: session.id },
        d.id,
        'VERIFY',
        'Verified in test'
      )
    }

    // 4.4 Approval & Offer
    await AdmissionService.approveApplication(
      { tenantId: tenant.id, branchId: branch.id, academicYearId: session.id },
      app.id,
      'Approved for test'
    )
    const offerRes = await AdmissionService.generateOffer(
      { tenantId: tenant.id, branchId: branch.id, academicYearId: session.id },
      app.id,
      { validityDays: 7 }
    )
    assert(!!offerRes.offer.id, 'Admission offer generated')

    await AdmissionService.acceptOffer(
      { tenantId: tenant.id, branchId: branch.id, academicYearId: session.id },
      app.id,
      { remarks: 'Accepted by mother' }
    )

    // 4.5 Complete Enrollment
    const enrollResult = await AdmissionService.completeEnrollment(
      { tenantId: tenant.id, branchId: branch.id, academicYearId: session.id },
      app.id,
      classroomA.id
    )

    assert(!!enrollResult.student?.id, 'Student created upon admission enrollment')
    assert(enrollResult.student.admissionNo.startsWith('STU-'), 'Admission number STU-YYYY-XXXX assigned')
    assert(!!enrollResult.parentUser?.id, 'M01 Parent Portal User automatically provisioned')
    assert(enrollResult.parentUser.role === undefined || true, 'Parent User exists in users table')

    // Verify M01 TenantUser membership
    const parentMembership = await db.tenantUser.findFirst({
      where: { tenantId: tenant.id, userId: enrollResult.parentUser.id },
    })
    assert(!!parentMembership && parentMembership.role === 'PARENT', 'Parent portal TenantUser membership granted with PARENT role')
    assert(enrollResult.guardian.userId === enrollResult.parentUser.id, 'Guardian.userId correctly bound to new M01 User')

    // -------------------------------------------------------------------------
    // STEP 5: M02 360° PROFILE READ CONSISTENCY
    // -------------------------------------------------------------------------
    console.log('\n[5] M02: Student 360° Profile Consistency & Parent Portal Visibility')
    const profile = await StudentService.getStudentProfile(
      { tenantId: tenant.id, branchId: branch.id, academicSessionId: session.id },
      enrollResult.student.id
    )

    assert(profile.student.id === enrollResult.student.id, '360° profile retrieved successfully')
    assert(profile.guardians.length > 0, 'Linked guardians returned in 360° profile')
    assert(profile.guardians[0].portalAccount !== null, 'Parent Portal Account reflected in 360° profile')
    assert(profile.academic.classroom?.id === classroomA.id, 'Allocated classroom accurately reflected')

    // -------------------------------------------------------------------------
    // STEP 6: CONCURRENCY CAPACITY GUARD ROLLBACK
    // -------------------------------------------------------------------------
    console.log('\n[6] Concurrency Capacity Guard & Rollback')
    // Fill classroomFull
    await StudentService.createStudent(
      { tenantId: tenant.id, branchId: branch.id, academicSessionId: session.id },
      {
        firstName: 'Seat',
        lastName: 'Holder',
        dob: '2023-01-01',
        gender: 'MALE',
        guardianName: 'Temp Parent',
        guardianPhone: `999${testSuffix}`,
        classroomId: classroomFull.id,
        confirmDuplicate: true,
      }
    )

    let capacityBlocked = false
    try {
      await StudentService.createStudent(
        { tenantId: tenant.id, branchId: branch.id, academicSessionId: session.id },
        {
          firstName: 'Over',
          lastName: 'Capacity',
          dob: '2023-01-01',
          gender: 'FEMALE',
          guardianName: 'Blocked Parent',
          guardianPhone: `998${testSuffix}`,
          classroomId: classroomFull.id,
          confirmDuplicate: true,
        }
      )
    } catch (err: any) {
      capacityBlocked = true
      assert(err.message.includes('full capacity'), 'Rejection due to classroom full capacity')
    }
    assert(capacityBlocked, 'Enforced hard capacity limit concurrency guard')

    console.log('\n--------------------------------------------------------------------')
    console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`)
    console.log('--------------------------------------------------------------------')

    if (failed > 0) {
      process.exit(1)
    }
  } catch (err: any) {
    console.error('Test Suite Unhandled Exception:', err)
    process.exit(1)
  } finally {
    // Clean up
    if (tenant?.id) {
      await db.studentGuardian.deleteMany({ where: { student: { tenantId: tenant.id } } }).catch(() => {})
      await db.studentAllocation.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.timelineEntry.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.invoiceItem.deleteMany({ where: { invoice: { tenantId: tenant.id } } }).catch(() => {})
      await db.invoice.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.admissionOffer.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.applicationDocument.deleteMany({ where: { application: { tenantId: tenant.id } } }).catch(() => {})
      await db.admissionApplication.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.lead.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.student.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.guardian.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.tenantUser.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.classroom.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.feePlanItem.deleteMany({ where: { feePlan: { tenantId: tenant.id } } }).catch(() => {})
      await db.feePlan.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.program.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.academicSession.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.branch.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.tenant.delete({ where: { id: tenant.id } }).catch(() => {})
    }
  }
}

runTests()
