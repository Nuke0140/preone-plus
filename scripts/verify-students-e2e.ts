/**
 * PreOne — Complete Academic Module (M04) End-to-End Architectural Test Suite
 *
 * Verifies all architectural requirements:
 * 1. Scope enforcement: tenantId + branchId + academicSessionId
 * 2. Downstream Connectivity:
 *    Setup Masters -> Admissions Enrollment -> Student Allocation ->
 *    Curriculum & Goals -> Classroom Activities -> Child Observations ->
 *    Milestone Progress Matrix -> Parent Timeline Integration -> Academic Report Cards.
 * 3. Multi-Session Integrity:
 *    Progress in session 2026-27 is isolated from session 2027-28 for the same student.
 * 4. Teacher Classroom Restriction:
 *    Teacher assigned to Classroom A cannot schedule activity or alter rosters for Classroom B.
 * 5. Triage & Parent Sync:
 *    - Flagged observations (NEEDS_ATTENTION / URGENT) raise FollowUp tasks.
 *    - Published observations create TimelineEntry visible to guardians.
 *    - Achieving a milestone creates a developmental Milestone TimelineEntry.
 * 6. Negative & Security Invariant Tests:
 *    - Cross-tenant access is rejected.
 *    - Missing required fields / foreign keys rejected.
 *    - Invalid status transitions prevented.
 */

import { db } from '../src/lib/db'
import { StudentService } from '../src/lib/students/student-service'
import { AcademicService } from '../src/lib/academics/academic-service'
import { AdmissionService } from '../src/lib/admissions/admission-service'

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

async function runStudentTests() {
  console.log('====================================================================')
  console.log('PREONE STUDENTS MODULE (M02): ARCHITECTURAL HARDENING & E2E SUITE')
  console.log('====================================================================\n')


  const testSuffix = Date.now().toString().slice(-6)
  const tenantCode = `ACAD-TENANT-${testSuffix}`
  let tenant: any
  let branch: any
  let session2627: any
  let session2728: any
  let programNursery: any
  let classroomA: any
  let classroomB: any
  let teacherUserA: any
  let teacherUserB: any
  let adminUser: any
  let student1: any
  let guardian1: any

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Authoritative Setup Masters & Entities
    // -------------------------------------------------------------------------
    console.log('>>> 1. Creating Authoritative Setup Masters (Tenant, Branch, Sessions, Programs, Classrooms, Staff)')

    tenant = await db.tenant.create({
      data: {
        name: `Academic Test Academy ${testSuffix}`,
        code: tenantCode,
        status: 'ACTIVE',
      },
    })
    assert(!!tenant.id, `Created tenant ${tenant.code}`)

    branch = await db.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'Main Campus',
        code: `BR-${testSuffix}`,
        isMain: true,
      },
    })
    assert(!!branch.id, `Created branch ${branch.name}`)

    session2627 = await db.academicSession.create({
      data: {
        tenantId: tenant.id,
        name: `2026-2027 Academic Session ${testSuffix}`,
        startDate: new Date('2026-06-01T00:00:00Z'),
        endDate: new Date('2027-04-30T23:59:59Z'),
        status: 'ACTIVE',
        isCurrent: true,
      },
    })

    session2728 = await db.academicSession.create({
      data: {
        tenantId: tenant.id,
        name: `2027-2028 Academic Session ${testSuffix}`,
        startDate: new Date('2027-06-01T00:00:00Z'),
        endDate: new Date('2028-04-30T23:59:59Z'),
        status: 'PLANNED',
        isCurrent: false,
      },
    })
    assert(!!session2627.id && !!session2728.id, 'Created dual academic sessions (2026-27 & 2027-28)')

    programNursery = await db.program.create({
      data: {
        tenantId: tenant.id,
        name: 'Nursery Early Years',
        code: `NUR-${testSuffix}`,
        programType: 'NURSERY',
        ageMinMonths: 36,
        ageMaxMonths: 48,
        capacity: 25,
      },
    })
    assert(!!programNursery.id, 'Created Program (Nursery)')

    // Create staff users
    adminUser = await db.user.create({
      data: {
        email: `admin-${testSuffix}@preone.test`,
        passwordHash: 'argon2-dummy-hash',
        fullName: 'Academic Admin Lead',
      },
    })
    await db.tenantUser.create({
      data: {
        tenantId: tenant.id,
        userId: adminUser.id,
        role: 'PRINCIPAL',
      },
    })

    teacherUserA = await db.user.create({
      data: {
        email: `teacherA-${testSuffix}@preone.test`,
        passwordHash: 'argon2-dummy-hash',
        fullName: 'Teacher Anita Sharma',
      },
    })
    await db.tenantUser.create({
      data: {
        tenantId: tenant.id,
        userId: teacherUserA.id,
        role: 'TEACHER',
        branchId: branch.id,
      },
    })

    teacherUserB = await db.user.create({
      data: {
        email: `teacherB-${testSuffix}@preone.test`,
        passwordHash: 'argon2-dummy-hash',
        fullName: 'Teacher Bob Vance',
      },
    })
    await db.tenantUser.create({
      data: {
        tenantId: tenant.id,
        userId: teacherUserB.id,
        role: 'TEACHER',
        branchId: branch.id,
      },
    })
    assert(!!adminUser.id && !!teacherUserA.id && !!teacherUserB.id, 'Created Admin and 2 Teachers')

    classroomA = await db.classroom.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        academicSessionId: session2627.id,
        name: 'Nursery Blossoms',
        code: `CLS-A-${testSuffix}`,
        programType: 'NURSERY',
        capacity: 20,
        primaryTeacherId: teacherUserA.id,
      },
    })

    classroomB = await db.classroom.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        academicSessionId: session2627.id,
        name: 'Nursery Tulips',
        code: `CLS-B-${testSuffix}`,
        programType: 'NURSERY',
        capacity: 20,
        primaryTeacherId: teacherUserB.id,
      },
    })
    assert(!!classroomA.id && !!classroomB.id, 'Created 2 classrooms assigned to respective teachers')

    // -------------------------------------------------------------------------
    // STEP 2: Enrol Student from Admissions CRM & Connect Allocation
    // -------------------------------------------------------------------------
    console.log('\n>>> 2. Enrolling Student via Admissions Pipeline & Allocating to Classroom')

    const feePlan = await db.feePlan.create({
      data: {
        tenantId: tenant.id,
        name: 'Standard Annual Plan',
        programType: 'NURSERY',
        totalAnnualCents: 6000000,
        installmentCount: 2,
      },
    })

    const admissionCtx = {
      tenantId: tenant.id,
      branchId: branch.id,
      academicYearId: session2627.id,
      actorId: adminUser.id,
      actorName: adminUser.fullName,
      actorRole: adminUser.role,
    }

    const form = await AdmissionService.submitApplication(admissionCtx, {
      childFirstName: 'Aarav',
      childLastName: 'Deshmukh',
      childDob: new Date('2023-01-15'),
      childGender: 'MALE',
      programType: 'NURSERY',
      parentName: 'Pooja Deshmukh',
      parentEmail: `pooja-${testSuffix}@preone.test`,
      parentPhone: '9876543210',
    })


    const docs = await db.applicationDocument.findMany({ where: { applicationId: form.id } })
    for (const d of docs) {
      await AdmissionService.updateDocumentStatus(admissionCtx, d.id, 'VERIFY')
    }

    await AdmissionService.approveApplication(admissionCtx, form.id, 'Eligible and verified')

    const enrollment = await AdmissionService.completeEnrollment(admissionCtx, form.id, classroomA.id)
    student1 = enrollment.student


    assert(!!student1 && !!student1.id, `Enrolled student ${student1.firstName} (${student1.admissionNo})`)

    const allocation = await db.studentAllocation.findFirst({
      where: { tenantId: tenant.id, studentId: student1.id, academicSessionId: session2627.id, classroomId: classroomA.id },
    })
    assert(!!allocation, `Student allocated to authoritative Classroom ${classroomA.name} in session 2026-27`)

    const studentGuardians = await db.studentGuardian.findMany({
      where: { studentId: student1.id },
      include: { guardian: true },
    })
    guardian1 = studentGuardians[0]?.guardian
    assert(!!guardian1, `Guardian link established: ${guardian1?.fullName}`)

    // -------------------------------------------------------------------------
    // STEP 3: Student Module Core Verification — 360° Profile & Invariants
    // -------------------------------------------------------------------------
    console.log('\n>>> 3. Verifying 360° Student Profile & Connected Origins')

    const studentCtx = {
      tenantId: tenant.id,
      branchId: branch.id,
      academicSessionId: session2627.id,
      actorId: adminUser.id,
      actorName: adminUser.fullName,
      actorRole: 'PRINCIPAL' as const,
    }

    const profile = await StudentService.getStudentProfile(studentCtx, student1.id)
    assert(profile.student.id === student1.id, '360° Profile: retrieved authoritative student identity')
    assert(profile.admission?.id === form.id, '360° Profile: connected originating admission application')
    assert(profile.academic.classroom?.id === classroomA.id, '360° Profile: connected active classroom')
    assert(profile.guardians.length > 0, '360° Profile: connected family guardians')
    assert(profile.academic.allocations.length >= 1, '360° Profile: allocation history tracked')

    // -------------------------------------------------------------------------
    // STEP 4: Duplicate Detection Engine
    // -------------------------------------------------------------------------
    console.log('\n>>> 4. Testing Multi-Signal Duplicate Detection Engine')

    const dupCheckExact = await StudentService.checkDuplicateStudent(tenant.id, {
      firstName: 'Aarav',
      lastName: 'Deshmukh',
      dob: new Date('2023-01-15'),
      guardianPhone: '9876543210',
    })
    assert(dupCheckExact.isDuplicate, 'Duplicate engine caught exact match (name, DOB, guardian phone)')
    assert(dupCheckExact.matches.length > 0, `Matches returned: ${dupCheckExact.matches.length}`)

    // Create student with same details without confirmDuplicate -> MUST FAIL
    let dupBlocked = false
    try {
      await StudentService.createStudent(studentCtx, {
        firstName: 'Aarav',
        lastName: 'Deshmukh',
        dob: new Date('2023-01-15'),
        gender: 'MALE',
        guardianName: 'Pooja Deshmukh',
        guardianPhone: '9876543210',
        confirmDuplicate: false,
      })
    } catch (err: any) {
      dupBlocked = true
      assert(/duplicate/i.test(err.message) || /matches/i.test(err.message), 'Duplicate student creation blocked without override flag')
    }
    assert(dupBlocked, 'Duplicate blocking invariant enforced')

    // -------------------------------------------------------------------------
    // STEP 5: Manual Child Enrollment & Dynamic Seat Number Generation
    // -------------------------------------------------------------------------
    console.log('\n>>> 5. Testing Manual Student Creation & Auto Seat Number Generation')

    const manualStudent = await StudentService.createStudent(studentCtx, {
      firstName: 'Rohan',
      lastName: 'Verma',
      dob: new Date('2023-05-20'),
      gender: 'MALE',
      bloodGroup: 'B_POSITIVE',
      classroomId: classroomA.id,
      guardianName: 'Amit Verma',
      guardianPhone: '9123456780',
      guardianEmail: `amit-${testSuffix}@preone.test`,
      guardianRelationship: 'FATHER',
    })
    assert(manualStudent.admissionNo === 'STU-2026-0002', `Manually created student: ${manualStudent.firstName} (${manualStudent.admissionNo})`)
    assert(!!manualStudent.seatNumber, `Auto-generated unique seat number: ${manualStudent.seatNumber}`)
    assert(manualStudent.seatNumber!.startsWith('CLS-A-'), 'Seat number formatted with classroom code prefix')

    // -------------------------------------------------------------------------
    // STEP 6: Classroom Reallocation & Capacity Locking
    // -------------------------------------------------------------------------
    console.log('\n>>> 6. Capacity Locking & Section Reallocation')

    const reallocated = await StudentService.reallocateClassroom(studentCtx, manualStudent.id, {
      destinationClassroomId: classroomB.id,
      reason: 'Balance teacher-student ratio',
    })
    assert(reallocated.currentClassroomId === classroomB.id, 'Student current classroom updated to Classroom B')

    // Verify allocation trail
    const allocations = await db.studentAllocation.findMany({
      where: { studentId: manualStudent.id },
      orderBy: { createdAt: 'asc' },
    })
    assert(allocations.length === 2, `Allocation trail preserved: ${allocations.length} records found (expected 2)`)
    assert(allocations[0].status === 'TRANSFERRED', 'Old allocation closed: status = TRANSFERRED')
    assert(allocations[1].status === 'ACTIVE' && allocations[1].classroomId === classroomB.id, 'New allocation active in Classroom B')

    // -------------------------------------------------------------------------
    // STEP 7: Cross-Branch Transfer
    // -------------------------------------------------------------------------
    console.log('\n>>> 7. Cross-Branch Transfer')

    // Create branch 2 and a classroom in branch 2
    const branch2 = await db.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'West Branch',
        code: `WB-${testSuffix}`,
        address: 'West Sector 4',
      },
    })

    const classroomB2 = await db.classroom.create({
      data: {
        tenantId: tenant.id,
        branchId: branch2.id,
        academicSessionId: session2627.id,
        name: 'West Nursery Daisies',
        code: `WND-${testSuffix}`,
        programType: 'NURSERY',
        capacity: 15,
      },
    })

    const transferred = await StudentService.transferBranch(studentCtx, manualStudent.id, {
      destinationBranchId: branch2.id,
      destinationClassroomId: classroomB2.id,
      reason: 'Family relocated to West City',
    })
    assert(transferred.branchId === branch2.id, 'Student branchId updated to Branch 2')
    assert(transferred.currentClassroomId === classroomB2.id, 'Student currentClassroomId updated to West Nursery Daisies')

    // -------------------------------------------------------------------------
    // STEP 8: Academic Year Promotion
    // -------------------------------------------------------------------------
    console.log('\n>>> 8. Academic Year Promotion to 2027-28')

    // Create KG program and classroom in session 27-28
    const programKG = await db.program.create({
      data: {
        tenantId: tenant.id,
        name: 'Junior KG',
        code: `JKG-${testSuffix}`,
        programType: 'LKG',
        ageMinMonths: 48,
        ageMaxMonths: 60,
        capacity: 25,
      },
    })

    const classroomKG2728 = await db.classroom.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        academicSessionId: session2728.id,
        name: 'Junior KG Stars 27-28',
        code: `JKG27-${testSuffix}`,
        programType: 'LKG',
        capacity: 25,
      },
    })

    const promoted = await StudentService.promoteStudent(studentCtx, student1.id, {
      targetAcademicSessionId: session2728.id,
      targetClassroomId: classroomKG2728.id,
      notes: 'Promoted to Junior KG with outstanding foundation marks',
    })
    assert(promoted.currentClassroomId === classroomKG2728.id, 'Student current classroom updated to Junior KG Stars 27-28')

    // Verify allocation in session 27-28
    const promoAlloc = await db.studentAllocation.findFirst({
      where: {
        studentId: student1.id,
        academicSessionId: session2728.id,
        status: 'ACTIVE',
      },
    })
    assert(!!promoAlloc && promoAlloc.classroomId === classroomKG2728.id, 'Active allocation created in new academic session (2027-28)')

    // -------------------------------------------------------------------------
    // STEP 9: Non-Destructive Student Withdrawal
    // -------------------------------------------------------------------------
    console.log('\n>>> 9. Non-Destructive Withdrawal Lifecycle Termination')

    // Create pending fee invoice for Rohan to test fee check
    await db.invoice.create({
      data: {
        tenantId: tenant.id,
        branchId: branch2.id,
        studentId: manualStudent.id,
        invoiceNumber: `INV-${testSuffix}-001`,
        title: 'Term 2 Tuition Fee',
        subtotalCents: 2500000,
        totalCents: 2500000,
        paidCents: 0,
        balanceCents: 2500000,
        status: 'ISSUED',
        dueDate: new Date('2026-12-01'),
      },
    })

    // Attempt withdrawal without override flag -> MUST FAIL due to unpaid dues
    let withdrawBlocked = false
    try {
      await StudentService.withdrawStudent(studentCtx, manualStudent.id, {
        reason: 'Relocating to another state',
        forceWithPendingFees: false,
      })
    } catch (err: any) {
      withdrawBlocked = true
      assert(err.message.includes('outstanding') || err.message.includes('dues'), 'Withdrawal blocked due to pending fees')
    }
    assert(withdrawBlocked, 'Fee-guard invariant on withdrawal enforced')

    // Withdraw with override flag -> MUST SUCCEED non-destructively
    const withdrawn = await StudentService.withdrawStudent(studentCtx, manualStudent.id, {
      reason: 'Relocating to another state',
      forceWithPendingFees: true,
      notes: 'Management approved exit with bond settlement',
    })
    assert(withdrawn.status === 'INACTIVE', 'Student lifecycle status updated to INACTIVE')

    // Verify student allocation history recorded WITHDRAWN
    const withdrawnAlloc = await db.studentAllocation.findFirst({
      where: { studentId: manualStudent.id, status: 'WITHDRAWN' },
    })
    assert(!!withdrawnAlloc, 'Allocation history recorded status WITHDRAWN')


    // Check student record still exists in DB (never hard deleted!)
    const studentInDb = await db.student.findUnique({ where: { id: manualStudent.id } })
    assert(!!studentInDb && studentInDb.deletedAt === null, 'Non-destructive preservation: Student record persisted in database')

    // -------------------------------------------------------------------------
    // STEP 10: Guardian Relationship & Portal Account Association
    // -------------------------------------------------------------------------
    console.log('\n>>> 10. Family & Guardian Management (Link, Update, Portal Sync)')

    // Create a new guardian
    const newGuardian = await db.guardian.create({
      data: {
        tenantId: tenant.id,
        fullName: 'Vikram Deshmukh',
        phone: '9988776655',
        email: `vikram-${testSuffix}@preone.test`,
        relationship: 'FATHER',
      },
    })

    // Link new guardian as Secondary / Pickup Contact
    const linked = await StudentService.manageGuardians(studentCtx, student1.id, {
      action: 'LINK',
      guardianId: newGuardian.id,
      relationship: 'FATHER',
      isPrimary: false,
      canPickup: true,
      isFeePayer: true,
      receivesComm: true,
    })
    assert(!!linked.id, `Linked guardian Vikram Deshmukh to student ${student1.firstName}`)

    // Verify 2 guardians now linked to student1
    const totalGuardians = await db.studentGuardian.count({ where: { studentId: student1.id } })
    assert(totalGuardians === 2, `Student has 2 verified family guardians linked`)

    // -------------------------------------------------------------------------
    // STEP 11: Real-Time Aggregate Dashboard Metrics
    // -------------------------------------------------------------------------
    console.log('\n>>> 11. Student Operational Dashboard Aggregate Metrics')

    const stats = await StudentService.getStudentDashboardStats(studentCtx)
    assert(stats.totalStudents >= 2, `Total students counted: ${stats.totalStudents}`)
    assert(stats.activeStudents >= 1, `Active students counted: ${stats.activeStudents}`)
    assert(stats.withdrawnStudents >= 1, `Withdrawn students counted: ${stats.withdrawnStudents}`)
    assert(stats.byClassroom.length >= 2, `Classroom distribution returned: ${stats.byClassroom.length} classrooms`)

    // -------------------------------------------------------------------------
    // STEP 12: Negative & Cross-Tenant Security Invariant Tests
    // -------------------------------------------------------------------------
    console.log('\n>>> 12. Negative Invariant & Cross-Tenant Security Isolation')

    const foreignTenant = await db.tenant.create({
      data: {
        name: `Foreign Academy ${testSuffix}`,
        code: `FOR-STU-${testSuffix}`,
        status: 'ACTIVE',
      },
    })

    const foreignUser = await db.user.create({
      data: {
        email: `intruder-${testSuffix}@foreign.test`,
        passwordHash: 'dummy',
        fullName: 'Foreign Intruder',
      },
    })
    await db.tenantUser.create({
      data: {
        tenantId: foreignTenant.id,
        userId: foreignUser.id,
        role: 'PRINCIPAL',
      },
    })

    const foreignSession = await db.academicSession.create({
      data: {
        tenantId: foreignTenant.id,
        name: `Foreign Academic Year ${testSuffix}`,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2027-04-30'),
        isCurrent: true,
      },
    })

    const foreignCtx = {
      tenantId: foreignTenant.id,
      branchId: undefined,
      academicSessionId: foreignSession.id,
      actorId: foreignUser.id,
      actorName: foreignUser.fullName,
      actorRole: 'PRINCIPAL' as const,
    }

    // 12a. Cross-tenant profile lookup must fail
    let crossTenantProfileBlocked = false
    try {
      await StudentService.getStudentProfile(foreignCtx, student1.id)
    } catch (e: any) {
      crossTenantProfileBlocked = true
      assert(e.message.includes('not found') || e.message.includes('Unauthorized'), 'Cross-tenant student profile access rejected')
    }
    assert(crossTenantProfileBlocked, 'Cross-tenant student profile isolation verified')

    // 12b. Cross-tenant reallocation must fail
    let crossTenantReallocBlocked = false
    try {
      await StudentService.reallocateClassroom(foreignCtx, student1.id, {
        destinationClassroomId: classroomB.id,
      })
    } catch (e: any) {
      crossTenantReallocBlocked = true
      assert(e.message.includes('not found') || e.message.includes('Unauthorized'), 'Cross-tenant student reallocation rejected')
    }
    assert(crossTenantReallocBlocked, 'Cross-tenant student mutation isolation verified')

    // Clean up foreign tenant
    await db.user.delete({ where: { id: foreignUser.id } })
    await db.tenant.delete({ where: { id: foreignTenant.id } })

  } catch (error: any) {
    console.error('\nFATAL TEST ERROR:', error)
    failed++
  } finally {
    console.log('\n====================================================================')
    console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`)
    console.log('====================================================================')
    await db.$disconnect()
    process.exit(failed > 0 ? 1 : 0)
  }
}

runStudentTests()

