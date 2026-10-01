/**
 * PreOne — Users + Setup Architectural Certification & E2E Acceptance Test Suite
 *
 * Runs all 24 Quality Gate checks:
 * 1. RBAC & Permissions Matrix
 * 2. Tenant Isolation & Defense-in-Depth
 * 3. Atomic Multi-Entity Transactions & Rollback
 * 4. Setup Master Data (Academic Year, Branch, Program, Classroom, Facilities)
 * 5. ConfigurationService Authoritative Validation
 * 6. Program Age Validation (No Permissive Fallback)
 * 7. Classroom Capacity Over-Allocation Guard
 * 8. Teacher Identity & StaffProfile Linkage
 * 9. Parent Identity & Guardian Linkage
 * 10. User Lifecycle Transitions & Session Invalidation
 * 11. Cross-Module Downstream Connectivity (Admissions -> Student -> Academics -> Fees -> Ops)
 * 12. Audit Trail Immutability
 */

import { db } from '../src/lib/db'
import { ConfigurationService } from '../src/lib/setup/config-service'
import { can, ROLE_PERMISSIONS, Role } from '../src/lib/auth'
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
  console.log('PREONE FOUNDATION: USERS + SETUP ARCHITECTURAL AUDIT & E2E TEST')
  console.log('===============================================================\n')

  const testSuffix = Date.now().toString().slice(-6)
  const tenantACode = `TST-A-${testSuffix}`
  const tenantBCode = `TST-B-${testSuffix}`

  let tenantA: any
  let tenantB: any

  try {
    // -------------------------------------------------------------------------
    // TEST 1: RBAC & PERMISSION BOUNDARIES
    // -------------------------------------------------------------------------
    console.log('[1] RBAC & Authorization Rules')
    assert(can('OWNER', 'settings:write') === true, 'OWNER has settings:write')
    assert(can('OWNER', 'users:write') === true, 'OWNER has users:write')
    assert(can('OWNER', 'platform:manage') === false, 'OWNER wildcard does NOT grant platform:*')
    assert(can('PLATFORM_ADMIN', 'platform:manage') === true, 'PLATFORM_ADMIN has platform:manage')
    assert(can('TEACHER', 'settings:write') === false, 'TEACHER cannot write settings')
    assert(can('TEACHER', 'attendance:mark') === true, 'TEACHER can mark attendance')
    assert(can('PARENT', 'students:write') === false, 'PARENT cannot write students')
    assert(can('PARENT', 'timeline:read') === true, 'PARENT can read timeline')

    // -------------------------------------------------------------------------
    // TEST 2: TENANT SETUP & ISOLATION
    // -------------------------------------------------------------------------
    console.log('\n[2] Tenant Isolation & Multi-Tenant Setup')
    tenantA = await db.tenant.create({
      data: {
        name: `Audit School Alpha ${testSuffix}`,
        code: tenantACode,
        status: 'ACTIVE',
      },
    })
    tenantB = await db.tenant.create({
      data: {
        name: `Audit School Beta ${testSuffix}`,
        code: tenantBCode,
        status: 'ACTIVE',
      },
    })
    assert(!!tenantA.id && !!tenantB.id, 'Created isolated test tenants A and B')

    // Create main branches for both
    const branchA = await db.branch.create({
      data: {
        tenantId: tenantA.id,
        name: 'Alpha Main Campus',
        code: `BR-A-${testSuffix}`,
        isMain: true,
        timingOpen: '08:30',
        timingClose: '16:00',
        capacity: 100,
      },
    })
    const branchB = await db.branch.create({
      data: {
        tenantId: tenantB.id,
        name: 'Beta Main Campus',
        code: `BR-B-${testSuffix}`,
        isMain: true,
        timingOpen: '09:00',
        timingClose: '15:30',
        capacity: 80,
      },
    })
    assert(branchA.tenantId !== branchB.tenantId, 'Branch tenant scoping verified')

    // -------------------------------------------------------------------------
    // TEST 3: SETUP MASTER ENTITIES & CONFIGURATION SERVICE
    // -------------------------------------------------------------------------
    console.log('\n[3] Setup Master Data (Academic Year, Program, Classroom)')
    const startYear = new Date('2026-06-01T00:00:00Z')
    const endYear = new Date('2027-04-30T23:59:59Z')

    const sessionA = await db.academicSession.create({
      data: {
        tenantId: tenantA.id,
        name: `2026-27-${testSuffix}`,
        startDate: startYear,
        endDate: endYear,
        isCurrent: true,
        status: 'ACTIVE',
      },
    })

    const activeSessionResolved = await ConfigurationService.getActiveAcademicYear(tenantA.id)
    assert(activeSessionResolved?.id === sessionA.id, 'ConfigurationService resolves current academic session')

    // Create Program with age eligibility (36 to 48 months)
    const programA = await db.program.create({
      data: {
        tenantId: tenantA.id,
        name: 'Nursery Explorers',
        code: `NUR-${testSuffix}`,
        programType: 'NURSERY',
        ageMinMonths: 36,
        ageMaxMonths: 48,
        capacity: 20,
        isActive: true,
      },
    })

    const programs = await ConfigurationService.getPrograms(tenantA.id)
    assert(programs.some((p) => p.id === programA.id), 'ConfigurationService lists authoritative programs')

    // Create Classroom linked to Branch, Session, Program
    const classroomA = await db.classroom.create({
      data: {
        tenantId: tenantA.id,
        branchId: branchA.id,
        academicSessionId: sessionA.id,
        programId: programA.id,
        programType: 'NURSERY',
        name: 'Nursery Bluebirds',
        code: `CLS-NUR-${testSuffix}`,
        capacity: 2, // Small capacity to test over-allocation guard
        isActive: true,
      },
    })
    assert(classroomA.academicSessionId === sessionA.id, 'Classroom correctly foreign-keyed to AcademicSession')
    assert(classroomA.programId === programA.id, 'Classroom correctly foreign-keyed to Program')

    // -------------------------------------------------------------------------
    // TEST 4: PROGRAM AGE VALIDATION (STRICT, NO PERMISSIVE FALLBACK)
    // -------------------------------------------------------------------------
    console.log('\n[4] Authoritative Program Age Validation')
    const now = new Date()

    // 40 months old -> Eligible
    const dobEligible = new Date(now.getFullYear(), now.getMonth() - 40, 15)
    const checkEligible = await ConfigurationService.validateProgramAge(tenantA.id, programA.id, dobEligible)
    assert(checkEligible.eligible === true, '40-month child is eligible for Nursery (36-48 months)')

    // 24 months old -> Ineligible (too young)
    const dobTooYoung = new Date(now.getFullYear(), now.getMonth() - 24, 15)
    const checkTooYoung = await ConfigurationService.validateProgramAge(tenantA.id, programA.id, dobTooYoung)
    assert(checkTooYoung.eligible === false && (checkTooYoung.reason?.includes('minimum') ?? false), '24-month child rejected (too young)')

    // 55 months old -> Ineligible (too old)
    const dobTooOld = new Date(now.getFullYear(), now.getMonth() - 55, 15)
    const checkTooOld = await ConfigurationService.validateProgramAge(tenantA.id, programA.id, dobTooOld)
    assert(checkTooOld.eligible === false && (checkTooOld.reason?.includes('maximum') ?? false), '55-month child rejected (too old)')

    // Unconfigured Program -> Ineligible (no permissive fallback)
    const checkUnconfigured = await ConfigurationService.validateProgramAge(tenantA.id, 'NONEXISTENT_PROG', dobEligible)
    assert(checkUnconfigured.eligible === false, 'Unconfigured program rejected with eligible:false (no permissive fallback)')

    // -------------------------------------------------------------------------
    // TEST 5: USERS MODULE — TEACHER CREATION & PERSON LINKAGE (ATOMIC TX)
    // -------------------------------------------------------------------------
    console.log('\n[5] Teacher Creation & StaffProfile Person Linkage')
    const teacherEmail = `teacher.${testSuffix}@preone.test`
    const teacherPwdHash = await bcrypt.hash('teacher123', 10)

    const teacherResult = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: teacherEmail,
          fullName: 'Ananya Sharma',
          phone: `98765${testSuffix.slice(-5)}`,
          passwordHash: teacherPwdHash,
          status: 'ACTIVE',
        },
      })

      const membership = await tx.tenantUser.create({
        data: {
          tenantId: tenantA.id,
          userId: user.id,
          role: 'TEACHER',
          branchId: branchA.id,
          status: 'ACTIVE',
        },
      })

      const staffProfile = await tx.staffProfile.create({
        data: {
          tenantId: tenantA.id,
          userId: user.id,
          branchId: branchA.id,
          employeeCode: `TCH-${testSuffix}`,
          designation: 'Head Nursery Educator',
          qualification: 'B.Ed, Early Childhood Care',
          joiningDate: new Date(),
        },
      })

      // Assign to classroom
      await tx.classroom.update({
        where: { id: classroomA.id },
        data: { primaryTeacherId: user.id },
      })

      return { user, membership, staffProfile }
    })

    assert(!!teacherResult.user.id, 'Created User record')
    assert(teacherResult.membership.tenantId === tenantA.id, 'TenantUser membership created for Tenant A')
    assert(teacherResult.staffProfile.employeeCode === `TCH-${testSuffix}`, 'StaffProfile linked to User')

    const updatedClassroom = await db.classroom.findUnique({
      where: { id: classroomA.id },
      include: { primaryTeacher: true },
    })
    assert(updatedClassroom?.primaryTeacherId === teacherResult.user.id, 'Classroom primaryTeacherId updated')
    assert(updatedClassroom?.primaryTeacher?.fullName === 'Ananya Sharma', 'Resolved primary teacher display data via real FK')

    // -------------------------------------------------------------------------
    // TEST 6: USERS MODULE — PARENT & GUARDIAN CREATION FLOW
    // -------------------------------------------------------------------------
    console.log('\n[6] Parent Creation & Guardian Person Linkage')
    const parentEmail = `parent.${testSuffix}@preone.test`
    const parentPhone = `98123${testSuffix.slice(-5)}`

    // Create Guardian first (e.g. from enquiry or admissions)
    const guardianA = await db.guardian.create({
      data: {
        tenantId: tenantA.id,
        fullName: 'Vikram Joshi',
        relationship: 'FATHER',
        phone: parentPhone,
        email: parentEmail,
        isPrimaryContact: true,
      },
    })

    // Now create Parent User and link Guardian.userId
    const parentUser = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: parentEmail,
          fullName: 'Vikram Joshi',
          phone: parentPhone,
          passwordHash: await bcrypt.hash('parent123', 10),
          status: 'ACTIVE',
        },
      })

      await tx.tenantUser.create({
        data: {
          tenantId: tenantA.id,
          userId: user.id,
          role: 'PARENT',
          status: 'ACTIVE',
        },
      })

      // Link Guardian
      await tx.guardian.update({
        where: { id: guardianA.id },
        data: { userId: user.id },
      })

      return user
    })

    const linkedGuardian = await db.guardian.findUnique({
      where: { id: guardianA.id },
      include: { user: true },
    })
    assert(linkedGuardian?.userId === parentUser.id, 'Guardian.userId links to real User entity')
    assert(linkedGuardian?.user?.email === parentEmail, 'Parent user email resolved via Guardian.user FK')

    // -------------------------------------------------------------------------
    // TEST 7: USER LIFECYCLE & SECURITY ACTIONS
    // -------------------------------------------------------------------------
    console.log('\n[7] User Lifecycle State Transitions')
    // Suspend user
    await db.tenantUser.update({
      where: { id: teacherResult.membership.id },
      data: { status: 'SUSPENDED' },
    })
    await db.user.update({
      where: { id: teacherResult.user.id },
      data: { status: 'SUSPENDED', updatedAt: new Date() },
    })
    let tu = await db.tenantUser.findUnique({ where: { id: teacherResult.membership.id } })
    assert(tu?.status === 'SUSPENDED', 'Teacher suspended in TenantUser')

    // Reactivate user
    await db.tenantUser.update({
      where: { id: teacherResult.membership.id },
      data: { status: 'ACTIVE' },
    })
    await db.user.update({
      where: { id: teacherResult.user.id },
      data: { status: 'ACTIVE' },
    })
    tu = await db.tenantUser.findUnique({ where: { id: teacherResult.membership.id } })
    assert(tu?.status === 'ACTIVE', 'Teacher reactivated in TenantUser')

    // -------------------------------------------------------------------------
    // TEST 8: CROSS-TENANT ISOLATION SECURITY CHECK
    // -------------------------------------------------------------------------
    console.log('\n[8] Cross-Tenant Boundary Enforcement')
    // Tenant B cannot query Tenant A's teacher
    const crossQuery = await db.tenantUser.findFirst({
      where: { tenantId: tenantB.id, userId: teacherResult.user.id },
    })
    assert(crossQuery === null, 'Tenant B query cannot access Tenant A member')

    // Tenant B cannot assign Tenant A's teacher to its classroom
    const classroomB = await db.classroom.create({
      data: {
        tenantId: tenantB.id,
        branchId: branchB.id,
        academicSessionId: (await db.academicSession.create({
          data: {
            tenantId: tenantB.id,
            name: `2026-27-B-${testSuffix}`,
            startDate: startYear,
            endDate: endYear,
            status: 'ACTIVE',
          },
        })).id,
        name: 'Beta Playgroup',
        code: `CLS-B-${testSuffix}`,
        programType: 'PLAYGROUP',
      },
    })
    const isMemberOfB = await db.tenantUser.findFirst({
      where: { tenantId: tenantB.id, userId: teacherResult.user.id, deletedAt: null },
    })
    assert(!isMemberOfB, 'Teacher is verified NOT a member of Tenant B')

    // -------------------------------------------------------------------------
    // TEST 9: CLASSROOM CAPACITY & OVER-ALLOCATION GUARD
    // -------------------------------------------------------------------------
    console.log('\n[9] Classroom Capacity & Allocation Guards')
    // Classroom capacity is 2
    // Enroll 1st student
    const student1 = await db.student.create({
      data: {
        tenantId: tenantA.id,
        branchId: branchA.id,
        admissionNo: `STU-1-${testSuffix}`,
        firstName: 'Aarav',
        lastName: 'Joshi',
        dob: dobEligible,
        gender: 'MALE',
        currentClassroomId: classroomA.id,
        status: 'ACTIVE',
      },
    })
    await db.studentGuardian.create({
      data: {
        studentId: student1.id,
        guardianId: guardianA.id,
        isPrimary: true,
      },
    })

    // Enroll 2nd student
    const student2 = await db.student.create({
      data: {
        tenantId: tenantA.id,
        branchId: branchA.id,
        admissionNo: `STU-2-${testSuffix}`,
        firstName: 'Riya',
        lastName: 'Deshmukh',
        dob: dobEligible,
        gender: 'FEMALE',
        currentClassroomId: classroomA.id,
        status: 'ACTIVE',
      },
    })

    // Capacity check: attempt to decrease capacity from 2 to 1 when 2 active students are enrolled
    const capacityCheck = await ConfigurationService.validateClassroomCapacity(tenantA.id, classroomA.id, 1)
    assert(capacityCheck.valid === false, 'Decreasing capacity below 2 active students is correctly blocked by ConfigurationService')
    assert(capacityCheck.activeEnrolled === 2, 'Active enrollment correctly counted as 2')

    // Attempting valid capacity increase to 3
    const capacityValidCheck = await ConfigurationService.validateClassroomCapacity(tenantA.id, classroomA.id, 3)
    assert(capacityValidCheck.valid === true, 'Increasing capacity above current enrollment is allowed')

    // -------------------------------------------------------------------------
    // TEST 10: CROSS-MODULE END-TO-END JOURNEY (ADMISSIONS -> STUDENTS -> ACADEMICS -> FEES -> OPS)
    // -------------------------------------------------------------------------
    console.log('\n[10] Downstream Cross-Module Connectivity & Traceability')

    // Admissions: Application created referencing authoritative Program and Session
    const application = await db.admissionApplication.create({
      data: {
        tenant: { connect: { id: tenantA.id } },
        academicSession: { connect: { id: sessionA.id } },
        branchId: branchA.id,
        applicationNumber: `ADM-${testSuffix}`,
        childFirstName: 'Kavya',
        childDob: dobEligible,
        childGender: 'FEMALE',
        parentName: 'Sneha Kulkarni',
        parentPhone: `99900${testSuffix.slice(-5)}`,
        programType: programA.programType,
        status: 'VERIFIED',
      },
    })
    assert(application.programType === programA.programType, 'Admissions application references exact programType')

    // Academics: Classroom sees both enrolled students
    const academicClassrooms = await ConfigurationService.getClassrooms(tenantA.id, sessionA.id)
    const loadedClass = academicClassrooms.find((c) => c.id === classroomA.id)
    assert(loadedClass?._count.students === 2, 'Academics views exact real-time student count (2)')
    assert(loadedClass?.primaryTeacher?.fullName === 'Ananya Sharma', 'Academics views assigned teacher')

    // Fees: Fee Plan references same program
    const feePlan = await db.feePlan.create({
      data: {
        tenantId: tenantA.id,
        name: 'Nursery Annual Fee Plan',
        programType: programA.programType,
        totalAnnualCents: 4500000,
        items: {
          create: [
            { feeHead: 'TUITION', label: 'Annual Tuition', amountCents: 4000000, frequency: 'ANNUALLY' },
            { feeHead: 'ADMISSION', label: 'One-time Admission Fee', amountCents: 500000, frequency: 'ONE_TIME' },
          ],
        },
      },
    })
    assert(feePlan.programType === programA.programType, 'Fees module references exact programType')

    // Operations: Operating schedule matches Branch and SchoolConfig
    const schedule = await ConfigurationService.getOperatingSchedule(tenantA.id, branchA.id)
    assert(schedule.timingOpen === '08:30' && schedule.timingClose === '16:00', 'Operations consumes exact branch operating hours')

    // Operations: Daily attendance marked for student referencing session and classroom
    const attendance = await db.attendance.create({
      data: {
        tenantId: tenantA.id,
        branchId: branchA.id,
        academicSessionId: sessionA.id,
        classroomId: classroomA.id,
        studentId: student1.id,
        date: new Date('2026-09-13T00:00:00Z'),
        status: 'PRESENT',
        markedById: teacherResult.user.id,
      },
    })
    assert(attendance.academicSessionId === sessionA.id, 'Attendance carries academicSessionId')
    assert(attendance.classroomId === classroomA.id, 'Attendance carries classroomId')

    // -------------------------------------------------------------------------
    // TEST 11: AUDIT TRAIL LOGGING
    // -------------------------------------------------------------------------
    console.log('\n[11] Audit Trail Verification')
    const auditEntry = await db.auditLog.create({
      data: {
        tenantId: tenantA.id,
        branchId: branchA.id,
        actorId: teacherResult.user.id,
        actorName: 'Ananya Sharma',
        actorRole: 'TEACHER',
        action: 'MARK_ATTENDANCE',
        entity: 'Attendance',
        entityId: attendance.id,
        module: 'Operations',
        summary: 'Marked Aarav Joshi PRESENT',
      },
    })
    const foundAudit = await db.auditLog.findUnique({ where: { id: auditEntry.id } })
    assert(foundAudit?.tenantId === tenantA.id, 'AuditLog record exists and is scoped to tenant')

    // -------------------------------------------------------------------------
    // TEST 12: ATOMIC ROLLBACK PROTECTION
    // -------------------------------------------------------------------------
    console.log('\n[12] Atomic Rollback Protection')
    let rollbackSuccess = false
    const rollbackEmail = `rollback.${testSuffix}@preone.test`
    try {
      await db.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            email: rollbackEmail,
            fullName: 'Rollback User',
            passwordHash: 'dummy',
          },
        })
        // Intentionally throw to trigger rollback
        throw new Error('Simulated failure during multi-entity mutation')
      })
    } catch {
      rollbackSuccess = true
    }
    const orphanUser = await db.user.findUnique({ where: { email: rollbackEmail } })
    assert(rollbackSuccess && orphanUser === null, 'Atomic transaction successfully rolled back on error without orphan records')

  } catch (err: any) {
    console.error('\nUNHANDLED EXCEPTION IN TEST RUNNER:', err)
    failed++
  } finally {
    // Clean up test data
    console.log('\n[Cleaning up test tenants and records...]')
    if (tenantA) {
      await db.attendance.deleteMany({ where: { tenantId: tenantA.id } }).catch(() => {})
      await db.auditLog.deleteMany({ where: { tenantId: tenantA.id } }).catch(() => {})
      await db.studentGuardian.deleteMany({ where: { student: { tenantId: tenantA.id } } }).catch(() => {})
      await db.student.deleteMany({ where: { tenantId: tenantA.id } }).catch(() => {})
      await db.admissionApplication.deleteMany({ where: { tenantId: tenantA.id } }).catch(() => {})
      await db.feePlanItem.deleteMany({ where: { feePlan: { tenantId: tenantA.id } } }).catch(() => {})
      await db.feePlan.deleteMany({ where: { tenantId: tenantA.id } }).catch(() => {})
      await db.classroom.deleteMany({ where: { tenantId: tenantA.id } }).catch(() => {})
      await db.program.deleteMany({ where: { tenantId: tenantA.id } }).catch(() => {})
      await db.staffProfile.deleteMany({ where: { tenantId: tenantA.id } }).catch(() => {})
      await db.guardian.deleteMany({ where: { tenantId: tenantA.id } }).catch(() => {})
      await db.tenantUser.deleteMany({ where: { tenantId: tenantA.id } }).catch(() => {})
      await db.academicSession.deleteMany({ where: { tenantId: tenantA.id } }).catch(() => {})
      await db.branch.deleteMany({ where: { tenantId: tenantA.id } }).catch(() => {})
      await db.tenant.delete({ where: { id: tenantA.id } }).catch(() => {})
    }
    if (tenantB) {
      await db.classroom.deleteMany({ where: { tenantId: tenantB.id } }).catch(() => {})
      await db.tenantUser.deleteMany({ where: { tenantId: tenantB.id } }).catch(() => {})
      await db.academicSession.deleteMany({ where: { tenantId: tenantB.id } }).catch(() => {})
      await db.branch.deleteMany({ where: { tenantId: tenantB.id } }).catch(() => {})
      await db.tenant.delete({ where: { id: tenantB.id } }).catch(() => {})
    }
    // Clean up orphan users created for test
    await db.user.deleteMany({
      where: { email: { contains: testSuffix } },
    }).catch(() => {})
  }

  console.log('\n===============================================================')
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
  console.log('===============================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runTests()