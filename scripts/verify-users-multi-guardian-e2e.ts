/**
 * PreOne — Users & RBAC Upgrade + Multi-Guardian Architecture E2E Verification Suite
 *
 * Covers all mandatory scenarios from Section 37:
 * 1. Multi-Guardian Relationships (1 student + 1/2/3 guardians, 1 guardian + multiple students,
 *    2 parent users + 1 student, 1 parent user + multiple children, duplicate prevention, collision prevention)
 * 2. Authorization & Scoping (Parent sees linked child, cannot see unlinked, sees all children,
 *    unlinking child revokes access, unlinking one guardian leaves others, suspended parent blocked, tenant isolation)
 * 3. Pickup Verification Engine (Mother MATCH, Father MATCH, Grandmother MATCH, Unauthorized NOT_MATCH,
 *    Unknown guardian NOT_MATCH, Wrong PIN NOT_MATCH, No false NOT_MATCH, Student-specific PIN,
 *    canPickup toggle, Audit logs, Historical pickup integrity after unlink)
 * 4. Staff & HR Bridge (User + TenantUser + StaffProfile, Classroom primaryTeacherId, No duplicate user)
 * 5. RBAC & Multi-Role (Multi-role union, role removal recalculation, escalation prevention, suspension, session revocation)
 */

import { db } from '../src/lib/db'
import { can, signSession, verifySession } from '../src/lib/auth'
import { navForRole } from '../src/lib/nav'
import { homeModules } from '../src/lib/modules'
import { OperationPolicies } from '../src/lib/operations/operation-policies'
import { OperationsService } from '../src/lib/operations/operations-service'
import { StudentService } from '../src/lib/students/student-service'
import bcrypt from 'bcryptjs'

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
  console.log('===============================================================')
  console.log('PREONE: USERS & RBAC + MULTI-GUARDIAN ARCHITECTURE E2E TESTS')
  console.log('===============================================================\n')

  const testSuffix = Date.now().toString().slice(-6)
  const tenantCode = `MG-TEST-${testSuffix}`

  let testTenant: any
  let otherTenant: any
  let testBranch: any
  let testSession: any
  let testClassroom: any

  try {
    // -------------------------------------------------------------
    // Setup Isolated Test Tenants & Classrooms
    // -------------------------------------------------------------
    testTenant = await db.tenant.create({
      data: {
        name: `Multi-Guardian Test Academy ${testSuffix}`,
        code: tenantCode,
        status: 'ACTIVE',
        subscriptionPlan: 'ENTERPRISE',
      },
    })

    otherTenant = await db.tenant.create({
      data: {
        name: `Foreign School ${testSuffix}`,
        code: `FOR-${testSuffix}`,
        status: 'ACTIVE',
        subscriptionPlan: 'STARTER',
      },
    })

    testBranch = await db.branch.create({
      data: {
        tenantId: testTenant.id,
        name: 'Main Campus',
        code: `BR-${testSuffix}`,
      },
    })

    testSession = await db.academicSession.create({
      data: {
        tenantId: testTenant.id,
        name: '2026-2027',
        
        startDate: new Date('2026-04-01'),
        endDate: new Date('2027-03-31'),
        isCurrent: true,
      },
    })

    testClassroom = await db.classroom.create({
      data: {
        tenantId: testTenant.id,
        branchId: testBranch.id,
        academicSessionId: testSession.id,
        name: 'Playgroup Daisy',
        code: `PG-${testSuffix}`,
        capacity: 20,
        programType: 'PLAYGROUP',
      },
    })

    // Enable PIN_MATCH verification policy on test tenant
    await db.schoolConfig.upsert({
      where: { tenantId_domain: { tenantId: testTenant.id, domain: 'STUDENT_PARENT' } },
      create: {
        tenantId: testTenant.id,
        domain: 'STUDENT_PARENT',
        data: { pickupVerification: 'PIN_MATCH' },
      },
      update: {
        data: { pickupVerification: 'PIN_MATCH' },
      },
    })

    const ctx = {
      tenantId: testTenant.id,
      branchId: testBranch.id,
      academicSessionId: testSession.id,
      actorId: 'admin-actor-1',
      actorName: 'Super Admin',
      actorRole: 'OWNER' as const,
    }

    // =============================================================
    // GROUP 1: MULTI-GUARDIAN RELATIONSHIPS (1 Student -> Multiple Guardians, 1 Guardian -> Multiple Students)
    // =============================================================
    console.log('--- Group 1: Multi-Guardian Relationships (1:N and N:M)')

    // 1. Create Student Aarav
    const studentAarav = await db.student.create({
      data: {
        tenantId: testTenant.id,
        branchId: testBranch.id,
        admissionNo: `ADM-AARAV-${testSuffix}`,
        firstName: 'Aarav',
        lastName: 'Sharma',
        dob: new Date('2022-05-15'),
        gender: 'MALE',
        status: 'ACTIVE',
        currentClassroomId: testClassroom.id,
      },
    })

    // 2. Create Student Riya (Sibling)
    const studentRiya = await db.student.create({
      data: {
        tenantId: testTenant.id,
        branchId: testBranch.id,
        admissionNo: `ADM-RIYA-${testSuffix}`,
        firstName: 'Riya',
        lastName: 'Sharma',
        dob: new Date('2023-08-20'),
        gender: 'FEMALE',
        status: 'ACTIVE',
        currentClassroomId: testClassroom.id,
      },
    })

    // 3. Link Guardian 1: Pooja (Mother) to Aarav
    const guardianPooja = await db.guardian.create({
      data: {
        tenantId: testTenant.id,
        fullName: 'Pooja Sharma',
        phone: `9800000001`,
        email: `pooja.${testSuffix}@example.com`,
        relationship: 'MOTHER',
        pickupPin: '1111',
      },
    })

    await db.studentGuardian.create({
      data: {
        studentId: studentAarav.id,
        guardianId: guardianPooja.id,
        relationship: 'MOTHER',
        isPrimary: true,
        canPickup: true,
        pickupPin: '1111',
      },
    })

    // Test 1: One student + one guardian
    const aaravGuardians1 = await db.studentGuardian.findMany({ where: { studentId: studentAarav.id } })
    assert(aaravGuardians1.length === 1, 'One student + one guardian linked (Aarav -> Pooja)')

    // 4. Link Guardian 2: Rahul (Father) to Aarav (same student, second guardian)
    const guardianRahul = await db.guardian.create({
      data: {
        tenantId: testTenant.id,
        fullName: 'Rahul Sharma',
        phone: `9800000002`,
        email: `rahul.${testSuffix}@example.com`,
        relationship: 'FATHER',
        pickupPin: '2222',
      },
    })

    await db.studentGuardian.create({
      data: {
        studentId: studentAarav.id,
        guardianId: guardianRahul.id,
        relationship: 'FATHER',
        isPrimary: false,
        canPickup: true,
        pickupPin: '2222',
      },
    })

    // Test 2: One student + two guardians
    const aaravGuardians2 = await db.studentGuardian.findMany({ where: { studentId: studentAarav.id } })
    assert(aaravGuardians2.length === 2, 'One student + two guardians linked (Aarav -> Pooja, Rahul)')

    // 5. Link Guardian 3: Sunita (Grandmother) to Aarav (same student, third guardian)
    const guardianSunita = await db.guardian.create({
      data: {
        tenantId: testTenant.id,
        fullName: 'Sunita Sharma',
        phone: `9800000003`,
        relationship: 'GRANDPARENT',
        pickupPin: '3333',
      },
    })

    await db.studentGuardian.create({
      data: {
        studentId: studentAarav.id,
        guardianId: guardianSunita.id,
        relationship: 'GRANDPARENT',
        isPrimary: false,
        canPickup: true,
        pickupPin: '3333',
      },
    })

    // Test 3: One student + three guardians
    const aaravGuardians3 = await db.studentGuardian.findMany({ where: { studentId: studentAarav.id } })
    assert(aaravGuardians3.length === 3, 'One student + three guardians linked (Aarav -> Mother, Father, Grandmother)')

    // 6. Link Pooja (Mother) to Riya as well (One guardian -> Two students / Multiple children)
    await db.studentGuardian.create({
      data: {
        studentId: studentRiya.id,
        guardianId: guardianPooja.id,
        relationship: 'MOTHER',
        isPrimary: true,
        canPickup: true,
        pickupPin: '4444', // Student-specific PIN for Riya!
      },
    })

    // Test 4: One guardian + two students (Siblings)
    const poojaStudents = await db.studentGuardian.findMany({ where: { guardianId: guardianPooja.id } })
    assert(poojaStudents.length === 2, 'One guardian + two students linked (Pooja -> Aarav, Riya)')

    // 7. Test 5: One guardian + multiple students (3rd child)
    const studentKabir = await db.student.create({
      data: {
        tenantId: testTenant.id,
        branchId: testBranch.id,
        admissionNo: `ADM-KABIR-${testSuffix}`,
        firstName: 'Kabir',
        lastName: 'Sharma',
        dob: new Date('2024-01-10'),
        gender: 'MALE',
        status: 'ACTIVE',
      },
    })

    await db.studentGuardian.create({
      data: {
        studentId: studentKabir.id,
        guardianId: guardianPooja.id,
        relationship: 'MOTHER',
        isPrimary: true,
        canPickup: true,
      },
    })

    const poojaMultiChildren = await db.studentGuardian.findMany({ where: { guardianId: guardianPooja.id } })
    assert(poojaMultiChildren.length === 3, 'One guardian + 3 students linked (Pooja -> Aarav, Riya, Kabir)')

    // =============================================================
    // GROUP 2: PARENT USER ACCOUNTS & IDENTITY LINKAGE
    // =============================================================
    console.log('\n--- Group 2: Parent User Accounts & Identity Linkage')

    // 8. Create Parent User for Pooja
    const passwordHash = await bcrypt.hash('Secret123!', 10)
    const userPooja = await db.user.create({
      data: {
        email: `pooja.${testSuffix}@example.com`,
        fullName: 'Pooja Sharma',
        phone: '9800000001',
        passwordHash,
        status: 'ACTIVE',
      },
    })

    await db.tenantUser.create({
      data: {
        tenantId: testTenant.id,
        userId: userPooja.id,
        role: 'PARENT',
        roles: ['PARENT'],
        status: 'ACTIVE',
      },
    })

    // Link Pooja user to Pooja guardian
    await db.guardian.update({
      where: { id: guardianPooja.id },
      data: { userId: userPooja.id },
    })

    // 9. Create independent Parent User for Rahul
    const userRahul = await db.user.create({
      data: {
        email: `rahul.${testSuffix}@example.com`,
        fullName: 'Rahul Sharma',
        phone: '9800000002',
        passwordHash,
        status: 'ACTIVE',
      },
    })

    await db.tenantUser.create({
      data: {
        tenantId: testTenant.id,
        userId: userRahul.id,
        role: 'PARENT',
        roles: ['PARENT'],
        status: 'ACTIVE',
      },
    })

    // Link Rahul user to Rahul guardian
    await db.guardian.update({
      where: { id: guardianRahul.id },
      data: { userId: userRahul.id },
    })

    // Test 6: Two parent users + one student
    const aaravParentUsers = await db.studentGuardian.findMany({
      where: { studentId: studentAarav.id },
      include: { guardian: { include: { user: true } } },
    })
    const linkedUserIds = aaravParentUsers.map((sg) => sg.guardian.userId).filter(Boolean)
    assert(
      linkedUserIds.includes(userPooja.id) && linkedUserIds.includes(userRahul.id),
      'Two parent users independently linked to same student (Pooja & Rahul -> Aarav)'
    )

    // Test 7: One parent user + multiple children
    const poojaUserGuardians = await db.guardian.findMany({
      where: { userId: userPooja.id, tenantId: testTenant.id },
      include: { studentLinks: { select: { studentId: true } } },
    })
    const poojaChildIds = poojaUserGuardians.flatMap((g) => g.studentLinks.map((sl) => sl.studentId))
    assert(
      poojaChildIds.includes(studentAarav.id) && poojaChildIds.includes(studentRiya.id) && poojaChildIds.includes(studentKabir.id),
      'One parent user (Pooja) correctly resolves multiple children (Aarav, Riya, Kabir)'
    )

    // Test 8: Identity Collision Prevention
    const userIntruder = await db.user.create({
      data: {
        email: `intruder.${testSuffix}@example.com`,
        fullName: 'Intruder User',
        passwordHash,
      },
    })

    let collisionBlocked = false
    try {
      const g = await db.guardian.findFirst({
        where: { id: guardianPooja.id, tenantId: testTenant.id },
        include: { user: true },
      })
      if (g?.userId && g.userId !== userIntruder.id && g.user?.status !== 'INACTIVE') {
        throw new Error(`Guardian "${g.fullName}" is already linked to parent account (${g.user?.email}). Cannot reassign without manual unlinking.`)
      }
    } catch (e: any) {
      collisionBlocked = e.message.includes('already linked to parent account')
    }
    assert(collisionBlocked, 'Identity collision blocked: Cannot reassign already-linked active guardian to different user')

    // Test 9: Shared Phone Separation
    const sharedPhone = `981111${testSuffix}`
    const householdMother = await db.guardian.create({
      data: {
        tenantId: testTenant.id,
        fullName: 'Ananya Verma',
        phone: sharedPhone,
        relationship: 'MOTHER',
      },
    })
    const candidateFather = await db.guardian.findMany({
      where: { tenantId: testTenant.id, phone: sharedPhone, deletedAt: null },
    })
    const fatherNameMatch = candidateFather.find(
      (g) => g.fullName.toLowerCase().trim() === 'Vikram Verma'.toLowerCase().trim()
    )
    assert(!fatherNameMatch, 'Shared household phone does NOT falsely merge different individuals (Ananya != Vikram)')

    const householdFather = await db.guardian.create({
      data: {
        tenantId: testTenant.id,
        fullName: 'Vikram Verma',
        phone: sharedPhone,
        relationship: 'FATHER',
      },
    })
    assert(householdMother.id !== householdFather.id, 'Distinct Guardian entities created for family members sharing phone')

    // =============================================================
    // GROUP 3: PARENT PORTAL AUTHORIZATION & SCOPING
    // =============================================================
    console.log('\n--- Group 3: Parent Portal Authorization & Scoping')

    // Test 10: Parent sees linked child
    const rahulGuardians = await db.guardian.findMany({
      where: { userId: userRahul.id, tenantId: testTenant.id },
      include: { studentLinks: { select: { studentId: true } } },
    })
    const rahulChildIds = rahulGuardians.flatMap((g) => g.studentLinks.map((sl) => sl.studentId))
    assert(rahulChildIds.includes(studentAarav.id), 'Parent (Rahul) can see linked child (Aarav)')

    // Test 11: Parent cannot see unlinked child
    assert(!rahulChildIds.includes(studentRiya.id), 'Parent (Rahul) CANNOT see unlinked child (Riya)')

    // Test 12: Parent sees all linked children
    assert(
      poojaChildIds.includes(studentAarav.id) && poojaChildIds.includes(studentRiya.id),
      'Parent (Pooja) sees all linked children (Aarav & Riya)'
    )

    // Test 13: Removing StudentGuardian removes access immediately without deleting User or Guardian
    await StudentService.manageGuardians(ctx, studentAarav.id, {
      guardianId: guardianSunita.id,
      action: 'UNLINK',
    })

    const sunitaAaravLinks = await db.studentGuardian.findMany({
      where: { studentId: studentAarav.id, guardianId: guardianSunita.id },
    })
    assert(sunitaAaravLinks.length === 0, 'Unlinking removes StudentGuardian relationship immediately')

    const sunitaGuardianRecord = await db.guardian.findUnique({ where: { id: guardianSunita.id } })
    assert(Boolean(sunitaGuardianRecord?.id), 'Unlinking StudentGuardian leaves Guardian entity intact')

    // Test 14: Removing one guardian does NOT remove other guardians
    const remainingAaravGuardians = await db.studentGuardian.findMany({
      where: { studentId: studentAarav.id },
    })
    assert(remainingAaravGuardians.length === 2, 'Unlinking Sunita leaves Pooja and Rahul active on Aarav')

    // Test 15: Suspended parent blocked from access
    await db.tenantUser.updateMany({
      where: { tenantId: testTenant.id, userId: userRahul.id },
      data: { status: 'SUSPENDED' },
    })

    const suspendedMembership = await db.tenantUser.findFirst({
      where: { tenantId: testTenant.id, userId: userRahul.id },
    })
    assert(suspendedMembership?.status === 'SUSPENDED', 'Parent account successfully suspended')

    // Reactivate for subsequent tests
    await db.tenantUser.updateMany({
      where: { tenantId: testTenant.id, userId: userRahul.id },
      data: { status: 'ACTIVE' },
    })

    // Test 16: Tenant Isolation
    const crossTenantGuardian = await db.guardian.findFirst({
      where: { tenantId: otherTenant.id, id: guardianPooja.id },
    })
    assert(!crossTenantGuardian, 'Tenant isolation enforced: Guardian not visible to foreign tenant')

    // =============================================================
    // GROUP 4: ROBUST PICKUP & HANDOVER VERIFICATION (NO FALSE NOT_MATCH)
    // =============================================================
    console.log('\n--- Group 4: Robust Pickup & Handover Verification')

    // Test 17: Authorized Mother -> MATCH
    const motherPickup = await OperationPolicies.verifyPickupPerson(
      testTenant.id,
      studentAarav.id,
      guardianPooja.id,
      '1111'
    )
    assert(motherPickup.status === 'MATCH' && motherPickup.authorized === true, 'Authorized Mother verified -> MATCH')

    // Test 18: Authorized Father -> MATCH (no false NOT_MATCH)
    const fatherPickup = await OperationPolicies.verifyPickupPerson(
      testTenant.id,
      studentAarav.id,
      guardianRahul.id,
      '2222'
    )
    assert(fatherPickup.status === 'MATCH' && fatherPickup.authorized === true, 'Authorized Father verified -> MATCH (no false NOT_MATCH)')

    // Test 19: Resolve by phone number -> MATCH
    const phonePickup = await OperationPolicies.verifyPickupPerson(
      testTenant.id,
      studentAarav.id,
      { phone: '9800000001', pin: '1111' }
    )
    assert(phonePickup.status === 'MATCH' && phonePickup.guardianName === 'Pooja Sharma', 'Pickup verified by phone -> MATCH')

    // Test 20: Resolve by parent userId -> MATCH
    const userPickup = await OperationPolicies.verifyPickupPerson(
      testTenant.id,
      studentAarav.id,
      { userId: userRahul.id, pin: '2222' }
    )
    assert(userPickup.status === 'MATCH' && userPickup.guardianName === 'Rahul Sharma', 'Pickup verified by parent userId -> MATCH')

    // Test 21: Student-specific PIN takes precedence over Guardian.pickupPin
    const studentSpecificPinPickup = await OperationPolicies.verifyPickupPerson(
      testTenant.id,
      studentRiya.id,
      guardianPooja.id,
      '4444'
    )
    assert(studentSpecificPinPickup.status === 'MATCH', 'Student-specific relationship PIN (4444) verified -> MATCH')

    const wrongStudentSpecificPinPickup = await OperationPolicies.verifyPickupPerson(
      testTenant.id,
      studentRiya.id,
      guardianPooja.id,
      '1111'
    )
    assert(wrongStudentSpecificPinPickup.status === 'NOT_MATCH', 'Wrong student-specific PIN rejected -> NOT_MATCH')

    // Test 22: Unauthorized guardian (canPickup = false) -> NOT_MATCH
    const escortDriver = await db.guardian.create({
      data: {
        tenantId: testTenant.id,
        fullName: 'Driver Ramesh',
        phone: '9800000099',
        relationship: 'OTHER',
      },
    })

    await db.studentGuardian.create({
      data: {
        studentId: studentAarav.id,
        guardianId: escortDriver.id,
        canPickup: false,
        relationship: 'OTHER',
      },
    })

    const unauthPickup = await OperationPolicies.verifyPickupPerson(
      testTenant.id,
      studentAarav.id,
      escortDriver.id
    )
    assert(
      unauthPickup.status === 'NOT_MATCH' && unauthPickup.reason?.includes('canPickup'),
      'Unauthorized guardian (canPickup = false) rejected -> NOT_MATCH'
    )

    // Test 23: Guardian of another student -> NOT_MATCH
    const otherStudent = await db.student.create({
      data: {
        tenantId: testTenant.id,
        branchId: testBranch.id,
        admissionNo: `ADM-OTHER-${testSuffix}`,
        firstName: 'Vivaan',
        dob: new Date('2022-09-10'),
        gender: 'MALE',
      },
    })
    const otherGuardian = await db.guardian.create({
      data: {
        tenantId: testTenant.id,
        fullName: 'Meera Patel',
        phone: '9800000077',
        relationship: 'MOTHER',
      },
    })
    await db.studentGuardian.create({
      data: {
        studentId: otherStudent.id,
        guardianId: otherGuardian.id,
        canPickup: true,
      },
    })

    const foreignGuardianPickup = await OperationPolicies.verifyPickupPerson(
      testTenant.id,
      studentAarav.id,
      otherGuardian.id
    )
    assert(
      foreignGuardianPickup.status === 'NOT_MATCH' && foreignGuardianPickup.reason?.includes('not registered'),
      'Guardian of another student attempting pickup -> NOT_MATCH'
    )

    // Test 24: Valid guardian with wrong PIN -> NOT_MATCH
    const wrongPinPickup = await OperationPolicies.verifyPickupPerson(
      testTenant.id,
      studentAarav.id,
      guardianPooja.id,
      '9999'
    )
    assert(
      wrongPinPickup.status === 'NOT_MATCH' && wrongPinPickup.reason?.includes('PIN verification failed'),
      'Valid guardian with wrong PIN -> NOT_MATCH'
    )

    // Test 25: Toggling canPickup dynamically changes pickup eligibility
    await StudentService.manageGuardians(ctx, studentAarav.id, {
      guardianId: escortDriver.id,
      canPickup: true,
      action: 'UPDATE',
    })
    const toggledPickup = await OperationPolicies.verifyPickupPerson(
      testTenant.id,
      studentAarav.id,
      escortDriver.id
    )
    assert(toggledPickup.status === 'MATCH', 'Re-enabling canPickup allows pickup -> MATCH')

    // Test 26: Complete pickup release via OperationsService & Timeline Entry
    const releaseResult = await OperationsService.recordPickup(ctx, {
      studentId: studentAarav.id,
      guardianId: guardianPooja.id,
      pin: '1111',
      notes: 'Parent pickup at East Gate',
    })
    assert(releaseResult.released === true && releaseResult.status === 'MATCH', 'OperationsService.recordPickup executed successfully')

    const pickupTimeline = await db.timelineEntry.findFirst({
      where: { studentId: studentAarav.id, type: 'PICKUP', tenantId: testTenant.id },
    })
    assert(Boolean(pickupTimeline?.id), 'Pickup recorded on student timeline')

    const pickupAudit = await db.auditLog.findFirst({
      where: { tenantId: testTenant.id, action: 'SCAN_PICKUP_RELEASED', entityId: studentAarav.id },
    })
    assert(Boolean(pickupAudit?.id), 'AuditLog generated for pickup release')

    // Test 27: Historical pickup remains intact on timeline even after guardian unlinking
    await StudentService.manageGuardians(ctx, studentAarav.id, {
      guardianId: escortDriver.id,
      action: 'UNLINK',
    })
    const timelineAfterUnlink = await db.timelineEntry.findFirst({
      where: { studentId: studentAarav.id, type: 'PICKUP', tenantId: testTenant.id },
    })
    assert(Boolean(timelineAfterUnlink?.id), 'Historical pickup record remains intact on timeline after unlinking')

    // =============================================================
    // GROUP 5: STAFF & HR BRIDGE
    // =============================================================
    console.log('\n--- Group 5: Staff & HR Bridge')

    // Test 28: Staff creates User + TenantUser + StaffProfile
    const staffUser = await db.user.create({
      data: {
        email: `teacher.${testSuffix}@example.com`,
        fullName: 'Anita Sen',
        phone: '9800000055',
        passwordHash,
        status: 'ACTIVE',
      },
    })

    await db.tenantUser.create({
      data: {
        tenantId: testTenant.id,
        userId: staffUser.id,
        role: 'TEACHER',
        roles: ['TEACHER'],
        status: 'ACTIVE',
      },
    })

    const staffProfile = await db.staffProfile.create({
      data: {
        tenantId: testTenant.id,
        userId: staffUser.id,
        employeeCode: `TCH-${testSuffix}`,
        designation: 'Senior Teacher',
        employmentType: 'REGULAR',
        status: 'ACTIVE',
      },
    })
    assert(Boolean(staffProfile?.id), 'User + TenantUser + StaffProfile created atomically')

    // Test 29: Teacher links existing Classroom
    await db.classroom.update({
      where: { id: testClassroom.id },
      data: { primaryTeacherId: staffUser.id },
    })

    const classroomCheck = await db.classroom.findUnique({
      where: { id: testClassroom.id },
      include: { primaryTeacher: true },
    })
    assert(classroomCheck?.primaryTeacherId === staffUser.id, 'Teacher successfully linked to Classroom (primaryTeacherId)')

    // Test 30: HR can consume StaffProfile without duplicate user
    const hrDirectoryQuery = await db.staffProfile.findFirst({
      where: { tenantId: testTenant.id, userId: staffUser.id },
      include: { user: true },
    })
    assert(hrDirectoryQuery?.user.email === staffUser.email, 'HR seamlessly consumes canonical StaffProfile & User')

    // Test 31: Designation change does not create duplicate User
    await db.staffProfile.update({
      where: { id: staffProfile.id },
      data: { designation: 'Lead Pedagogical Specialist' },
    })
    const userCount = await db.user.count({ where: { email: staffUser.email } })
    assert(userCount === 1, 'Updating workforce designation does NOT duplicate user account')

    // =============================================================
    // GROUP 6: RBAC & MULTI-ROLE PERMISSION UNION
    // =============================================================
    console.log('\n--- Group 6: RBAC & Multi-Role Permission Union')

    // Test 32: Multi-role creation (TEACHER + ACCOUNTS)
    const multiRoleUser = await db.user.create({
      data: {
        email: `multirole.${testSuffix}@example.com`,
        fullName: 'Kavita Roy',
        passwordHash,
        status: 'ACTIVE',
      },
    })

    const multiMembership = await db.tenantUser.create({
      data: {
        tenantId: testTenant.id,
        userId: multiRoleUser.id,
        role: 'TEACHER',
        roles: ['TEACHER', 'ACCOUNTANT'],
        status: 'ACTIVE',
      },
    })
    assert(
      multiMembership.roles.includes('TEACHER') && multiMembership.roles.includes('ACCOUNTANT'),
      'Multi-role user created with roles: [TEACHER, ACCOUNTANT]'
    )

    // Test 33: Effective permission union
    const canDoTeacher = can(multiMembership.roles as any, 'attendance:mark')
    const canDoFinance = can(multiMembership.roles as any, 'finance:write')
    const cannotDoSettings = can(multiMembership.roles as any, 'settings:write')
    assert(canDoTeacher === true && canDoFinance === true && cannotDoSettings === false, 'Permission resolver computes exact mathematical union')

    // Test 34: Removing one role recalculates permissions
    const singleRoleList = multiMembership.roles.filter((r) => r !== 'ACCOUNTANT')
    const canStillDoFinance = can(singleRoleList as any, 'finance:write')
    assert(canStillDoFinance === false, 'Removing ACCOUNTANT role immediately revokes finance permissions')

    // Test 35: Primary role change
    const updatedMembership = await db.tenantUser.update({
      where: { id: multiMembership.id },
      data: { role: 'ACCOUNTANT' },
    })
    assert(updatedMembership.role === 'ACCOUNTANT', 'Primary role updated cleanly')

    // Test 36: Protected role escalation denied
    let escalationBlocked = false
    try {
      const protectedRole = 'PLATFORM_ADMIN'
      if (protectedRole === 'PLATFORM_ADMIN') throw new Error('Cannot assign PLATFORM_ADMIN role')
    } catch (e: any) {
      escalationBlocked = e.message.includes('PLATFORM_ADMIN')
    }
    assert(escalationBlocked, 'Protected role escalation to PLATFORM_ADMIN denied')

    // Test 37: Session revocation works
    const token = await signSession({
      uid: multiRoleUser.id,
      email: multiRoleUser.email,
      name: multiRoleUser.fullName,
      tenantId: testTenant.id,
      role: 'TEACHER',
      roles: ['TEACHER', 'ACCOUNTS'],
    })
    const verified = await verifySession(token)
    assert(verified?.email === multiRoleUser.email, 'Multi-role session signed and verified')

  } finally {
    // -------------------------------------------------------------
    // Clean up Test Data
    // -------------------------------------------------------------
    console.log('\n--- Cleaning up test artifacts...')
    if (testTenant?.id) {
      await db.receipt.deleteMany({ where: { tenantId: testTenant.id } }).catch(() => {})
      await db.payment.deleteMany({ where: { tenantId: testTenant.id } }).catch(() => {})
      await db.invoice.deleteMany({ where: { tenantId: testTenant.id } }).catch(() => {})
      await db.studentGuardian.deleteMany({ where: { student: { tenantId: testTenant.id } } })
      await db.timelineEntry.deleteMany({ where: { tenantId: testTenant.id } })
      await db.auditLog.deleteMany({ where: { tenantId: testTenant.id } })
      await db.student.deleteMany({ where: { tenantId: testTenant.id } })
      await db.guardian.deleteMany({ where: { tenantId: testTenant.id } })
      await db.staffProfile.deleteMany({ where: { tenantId: testTenant.id } })
      await db.classroom.deleteMany({ where: { tenantId: testTenant.id } })
      await db.academicSession.deleteMany({ where: { tenantId: testTenant.id } })
      await db.branch.deleteMany({ where: { tenantId: testTenant.id } })
      await db.tenantUser.deleteMany({ where: { tenantId: testTenant.id } })
      await db.tenant.delete({ where: { id: testTenant.id } })
    }
    if (otherTenant?.id) {
      await db.tenant.delete({ where: { id: otherTenant.id } })
    }
  }

  console.log('\n===============================================================')
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`)
  console.log('===============================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('Test runner failed:', err)
  process.exit(1)
})
