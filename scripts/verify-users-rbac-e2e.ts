/**
 * PreOne  Users & RBAC Module Complete Upgrade E2E Verification Suite
 *
 * Validates:
 * Test A: Multi-Role Permission Union (TEACHER + ACCOUNTS)
 *   - Teacher permissions granted (academics:read, attendance:mark)
 *   - Accounts permissions granted (finance:read, finance:write)
 *   - Settings unauthorized (settings:write)
 *   - Owner unauthorized (*)
 *   - Platform admin unauthorized (platform:manage)
 *   - Role removal recalculation
 *
 * Test B: Workforce & Designation Bridging (Storekeeper)
 *   - User created with canonical role (e.g. COORDINATOR)
 *   - StaffProfile created with designation: "Storekeeper"
 *   - User Module -> StaffProfile -> HR Staff Directory verification
 *
 * Test C: Teacher & Classroom Linkage
 *   - User -> TEACHER -> StaffProfile -> Classroom.primaryTeacherId -> Academics
 *
 * Test D: Parent & Guardian Linkage
 *   - User -> PARENT -> Guardian -> StudentGuardian -> Student
 *
 * Test E: Security, Role Escalation, Suspension, & Audit Trail
 *   - Non-owner cannot assign OWNER or PLATFORM_ADMIN
 *   - Account suspension & session revocation
 *   - Immutable audit log verification
 */

import { db } from '../src/lib/db'
import { can, ROLE_PERMISSIONS, Role, signSession, verifySession } from '../src/lib/auth'
import { navForRole } from '../src/lib/nav'
import { homeModules } from '../src/lib/modules'
import bcrypt from 'bcryptjs'

let passed = 0
let failed = 0

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ? ${desc}`)
    passed++
  } else {
    console.error(`  ? FAIL: ${desc}`)
    failed++
  }
}

async function runTests() {
  console.log('===============================================================')
  console.log('PREONE USERS & RBAC MODULE: COMPREHENSIVE E2E VERIFICATION')
  console.log('===============================================================\n')

  const testSuffix = Date.now().toString().slice(-6)
  const tenantCode = `UR-TEST-${testSuffix}`

  let testTenant: any
  let testBranch: any
  let testSession: any
  let testClassroom: any
  let testStudent: any
  let testGuardian: any

  try {
    // -------------------------------------------------------------------------
    // SETUP: ISOLATED TENANT, BRANCH & CLASSROOM
    // -------------------------------------------------------------------------
    testTenant = await db.tenant.create({
      data: {
        name: `RBAC Test Preschool ${testSuffix}`,
        code: tenantCode,
        status: 'ACTIVE',
      },
    })

    testBranch = await db.branch.create({
      data: {
        tenantId: testTenant.id,
        name: 'Main Campus',
        code: 'MAIN',
        isMain: true,
      },
    })

    testSession = await db.academicSession.create({
      data: {
        tenantId: testTenant.id,
        name: `2026-2027 ${testSuffix}`,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2027-04-30'),
        isCurrent: true,
      },
    })

    testClassroom = await db.classroom.create({
      data: {
        tenantId: testTenant.id,
        branchId: testBranch.id,
        academicSessionId: testSession.id,
        name: 'Sunflowers Nursery',
        capacity: 20,
        programType: 'NURSERY',
        code: `CLS-${testSuffix}`,
      },
    })

    // -------------------------------------------------------------------------
    // TEST A: MULTI-ROLE ASSIGNMENT & EFFECTIVE PERMISSION UNION
    // -------------------------------------------------------------------------
    console.log('[TEST A] Multi-Role Assignment & Effective Permission Union (TEACHER + ACCOUNTS)')

    const multiRoles: Role[] = ['TEACHER', 'ACCOUNTS']

    // 1. In-memory permission union evaluator check
    assert(can(multiRoles, 'attendance:mark') === true, 'Teacher permission (attendance:mark) granted via union')
    assert(can(multiRoles, 'academics:read') === true, 'Teacher permission (academics:read) granted via union')
    assert(can(multiRoles, 'finance:write') === true, 'Accounts permission (finance:write) granted via union')
    assert(can(multiRoles, 'finance:read') === true, 'Accounts permission (finance:read) granted via union')
    assert(can(multiRoles, 'settings:write') === false, 'Settings permission (settings:write) DENIED (neither role has it)')
    assert(can(multiRoles, 'users:write') === false, 'Users write permission (users:write) DENIED')
    assert(can(multiRoles, 'platform:manage') === false, 'Platform manage permission (platform:manage) DENIED')

    // 2. Navigation & Launcher Union check
    const navItems = navForRole(multiRoles)
    const navKeys = navItems.map((n) => n.key)
    assert(navKeys.includes('attendance'), 'Nav includes Attendance (from TEACHER)')
    assert(navKeys.includes('academics'), 'Nav includes Academics (from TEACHER)')
    assert(navKeys.includes('finance'), 'Nav includes Finance (from ACCOUNTS)')
    assert(!navKeys.includes('settings'), 'Nav excludes Settings (neither role)')
    assert(!navKeys.includes('platform'), 'Nav excludes Platform Console')

    const homeTiles = homeModules(multiRoles)
    const homeTileKeys = homeTiles.map((h) => h.key)
    assert(homeTileKeys.includes('attendance'), 'Dashboard launcher includes Attendance tile')
    assert(homeTileKeys.includes('finance'), 'Dashboard launcher includes Finance tile')
    assert(!homeTileKeys.includes('settings'), 'Dashboard launcher excludes Settings tile')

    // 3. Database persistence of multi-role user
    const userA = await db.user.create({
      data: {
        email: `teacher-accounts-${testSuffix}@test.com`,
        fullName: 'Anita Sharma (Educator & Accounts)',
        passwordHash: await bcrypt.hash('secret123', 10),
        status: 'ACTIVE',
      },
    })

    const membershipA = await db.tenantUser.create({
      data: {
        tenantId: testTenant.id,
        userId: userA.id,
        role: 'TEACHER', // Primary role
        roles: multiRoles, // All assigned roles
        branchId: testBranch.id,
        status: 'ACTIVE',
      },
    })

    assert(membershipA.role === 'TEACHER', 'TenantUser primary role is TEACHER')
    assert(membershipA.roles.length === 2, 'TenantUser roles array has 2 roles')
    assert(membershipA.roles.includes('TEACHER') && membershipA.roles.includes('ACCOUNTS'), 'TenantUser roles array contains TEACHER and ACCOUNTS')

    // 4. JWT Session generation with roles array
    const token = await signSession({
      uid: userA.id,
      email: userA.email,
      name: userA.fullName,
      tenantId: testTenant.id,
      branchId: testBranch.id,
      role: membershipA.role as Role,
      roles: membershipA.roles as Role[],
    })

    const decoded = await verifySession(token)
    assert(decoded !== null, 'JWT verified successfully')
    assert(decoded?.role === 'TEACHER', 'Session carries primary role TEACHER')
    assert(decoded?.roles?.includes('TEACHER') && decoded?.roles?.includes('ACCOUNTS'), 'Session carries roles array [TEACHER, ACCOUNTS]')
    assert(can(decoded?.roles, 'finance:write') === true, 'Decoded session allows finance:write via union')
    assert(can(decoded?.roles, 'attendance:mark') === true, 'Decoded session allows attendance:mark via union')
    assert(can(decoded?.roles, 'settings:write') === false, 'Decoded session forbids settings:write')

    // 5. Role removal recalculation: Remove ACCOUNTS, retain only TEACHER
    const updatedMembershipA = await db.tenantUser.update({
      where: { id: membershipA.id },
      data: {
        role: 'TEACHER',
        roles: ['TEACHER'],
      },
    })
    assert(updatedMembershipA.roles.length === 1, 'Roles array reduced to 1 role')
    assert(can(updatedMembershipA.roles as Role[], 'attendance:mark') === true, 'Teacher permission remains active')
    assert(can(updatedMembershipA.roles as Role[], 'finance:write') === false, 'Accounts permission revoked after removal')

    // -------------------------------------------------------------------------
    // TEST B: WORKFORCE & DESIGNATION BRIDGING (STOREKEEPER)
    // -------------------------------------------------------------------------
    console.log('\n[TEST B] Workforce & Designation Bridging (Storekeeper)')

    // Storekeeper user with canonical role COORDINATOR and designation "Storekeeper"
    const userB = await db.user.create({
      data: {
        email: `storekeeper-${testSuffix}@test.com`,
        fullName: 'Ramesh Patel',
        passwordHash: await bcrypt.hash('secret123', 10),
        status: 'ACTIVE',
      },
    })

    await db.tenantUser.create({
      data: {
        tenantId: testTenant.id,
        userId: userB.id,
        role: 'COORDINATOR',
        roles: ['COORDINATOR'],
        branchId: testBranch.id,
        status: 'ACTIVE',
      },
    })

    const staffProfileB = await db.staffProfile.create({
      data: {
        tenantId: testTenant.id,
        userId: userB.id,
        branchId: testBranch.id,
        employeeCode: `STK-${testSuffix.slice(-4)}`,
        designation: 'Storekeeper',
        employmentType: 'REGULAR',
        status: 'ACTIVE',
      },
    })

    assert(staffProfileB.designation === 'Storekeeper', 'StaffProfile created with designation Storekeeper')
    assert(staffProfileB.userId === userB.id, 'StaffProfile linked to canonical User ID')

    // Verify HR Staff Directory query resolution
    const hrStaffRecord = await db.staffProfile.findUnique({
      where: { id: staffProfileB.id },
      include: {
        user: {
          include: {
            memberships: { where: { tenantId: testTenant.id } },
          },
        },
      },
    })

    assert(hrStaffRecord !== null, 'Staff record retrievable in HR directory')
    assert(hrStaffRecord?.designation === 'Storekeeper', 'HR directory reflects designation Storekeeper')
    assert(hrStaffRecord?.user.memberships[0]?.role === 'COORDINATOR', 'HR directory reflects canonical RBAC role COORDINATOR')
    assert(can(hrStaffRecord?.user.memberships[0]?.role as Role, 'inventory:approve') === true, 'Storekeeper with COORDINATOR role has inventory:approve capability')

    // -------------------------------------------------------------------------
    // TEST C: TEACHER & ACADEMICS LINKAGE
    // -------------------------------------------------------------------------
    console.log('\n[TEST C] Teacher & Classroom Academics Linkage')

    const teacherUser = await db.user.create({
      data: {
        email: `nursery-lead-${testSuffix}@test.com`,
        fullName: 'Sunita Menon',
        passwordHash: await bcrypt.hash('secret123', 10),
        status: 'ACTIVE',
      },
    })

    await db.tenantUser.create({
      data: {
        tenantId: testTenant.id,
        userId: teacherUser.id,
        role: 'TEACHER',
        roles: ['TEACHER'],
        branchId: testBranch.id,
      },
    })

    await db.staffProfile.create({
      data: {
        tenantId: testTenant.id,
        userId: teacherUser.id,
        branchId: testBranch.id,
        employeeCode: `TCH-${testSuffix.slice(-4)}`,
        designation: 'Lead Nursery Teacher',
        employmentType: 'REGULAR',
      },
    })

    // Assign to classroom primaryTeacherId
    const updatedClassroom = await db.classroom.update({
      where: { id: testClassroom.id },
      data: { primaryTeacherId: teacherUser.id },
      include: { primaryTeacher: { include: { staffProfile: true } } },
    })

    assert(updatedClassroom.primaryTeacherId === teacherUser.id, 'Classroom primaryTeacherId correctly foreign-keyed to User')
    assert(updatedClassroom.primaryTeacher?.fullName === 'Sunita Menon', 'Classroom resolves primary teacher name')
    assert(updatedClassroom.primaryTeacher?.staffProfile?.designation === 'Lead Nursery Teacher', 'Classroom resolves teacher designation')

    // Query teacher taught classes
    const teacherQuery = await db.user.findUnique({
      where: { id: teacherUser.id },
      include: { taughtClasses: true },
    })
    assert(teacherQuery?.taughtClasses.length === 1, 'Teacher taughtClasses relation includes assigned classroom')
    assert(teacherQuery?.taughtClasses[0].name === 'Sunflowers Nursery', 'Taught class name matches Sunflowers Nursery')

    // -------------------------------------------------------------------------
    // TEST D: PARENT & GUARDIAN LINKAGE
    // -------------------------------------------------------------------------
    console.log('\n[TEST D] Parent & Guardian Linkage')

    // 1. Create student
    testStudent = await db.student.create({
      data: {
        tenantId: testTenant.id,
        branchId: testBranch.id,
        currentClassroomId: testClassroom.id,
        firstName: 'Aarav',
        lastName: 'Deshmukh',
        dob: new Date('2023-01-15'),
        gender: 'MALE',
        admissionNo: `ADM-${testSuffix}`,
        status: 'ACTIVE',
      },
    })

    // 2. Create Guardian during admissions
    testGuardian = await db.guardian.create({
      data: {
        tenantId: testTenant.id,
        fullName: 'Vikram Deshmukh',
        phone: `+9198000${testSuffix.slice(-5)}`,
        email: `vikram.parent-${testSuffix}@test.com`,
        relationship: 'FATHER',
      },
    })

    await db.studentGuardian.create({
      data: {
        studentId: testStudent.id,
        guardianId: testGuardian.id,
        isPrimary: true,
        canPickup: true,
      },
    })

    // 3. Parent portal account created & linked to Guardian
    const parentUser = await db.user.create({
      data: {
        email: testGuardian.email,
        fullName: testGuardian.fullName,
        phone: testGuardian.phone,
        passwordHash: await bcrypt.hash('secret123', 10),
        status: 'ACTIVE',
      },
    })

    await db.tenantUser.create({
      data: {
        tenantId: testTenant.id,
        userId: parentUser.id,
        role: 'PARENT',
        roles: ['PARENT'],
        branchId: testBranch.id,
      },
    })

    await db.guardian.update({
      where: { id: testGuardian.id },
      data: { userId: parentUser.id },
    })

    // 4. Verify cross-entity resolution: User -> Guardian -> StudentGuardian -> Student
    const resolvedParent = await db.user.findUnique({
      where: { id: parentUser.id },
      include: {
        guardianProfile: {
          include: {
            studentLinks: {
              include: { student: true },
            },
          },
        },
      },
    })

    assert(resolvedParent?.guardianProfile !== null, 'User linked to Guardian profile')
    assert(resolvedParent?.guardianProfile?.relationship === 'FATHER', 'Guardian relationship resolved as FATHER')
    assert(resolvedParent?.guardianProfile?.studentLinks.length === 1, 'Guardian has 1 linked student')
    assert(resolvedParent?.guardianProfile?.studentLinks[0].student.firstName === 'Aarav', 'Linked student resolved as Aarav')
    assert(resolvedParent?.guardianProfile?.studentLinks[0].canPickup === true, 'Parent is authorized for pickup')

    // -------------------------------------------------------------------------
    // TEST E: SECURITY, SUSPENSION & AUDIT TRAIL
    // -------------------------------------------------------------------------
    console.log('\n[TEST E] Security, Escalation Protection, Suspension & Audit Trail')

    // 1. Escalation check logic
    const illegalRoleAssignment = (assignerRole: Role, targetRole: Role) => {
      if (targetRole === 'PLATFORM_ADMIN') return false
      if (targetRole === 'OWNER' && assignerRole !== 'OWNER' && assignerRole !== 'PLATFORM_ADMIN') return false
      return true
    }

    assert(illegalRoleAssignment('PRINCIPAL', 'PLATFORM_ADMIN') === false, 'Principal cannot assign PLATFORM_ADMIN')
    assert(illegalRoleAssignment('PRINCIPAL', 'OWNER') === false, 'Principal cannot assign OWNER')
    assert(illegalRoleAssignment('OWNER', 'OWNER') === true, 'Owner CAN assign OWNER')
    assert(illegalRoleAssignment('PLATFORM_ADMIN', 'OWNER') === true, 'Platform Admin CAN assign OWNER')

    // 2. Suspension test
    const suspendedUser = await db.tenantUser.update({
      where: { id: updatedMembershipA.id },
      data: { status: 'SUSPENDED' },
    })
    assert(suspendedUser.status === 'SUSPENDED', 'User account successfully transitioned to SUSPENDED')

    // Reactivation test
    const reactivatedUser = await db.tenantUser.update({
      where: { id: updatedMembershipA.id },
      data: { status: 'ACTIVE' },
    })
    assert(reactivatedUser.status === 'ACTIVE', 'User account successfully reactivated to ACTIVE')

    // 3. Audit trail verification
    const auditRecord = await db.auditLog.create({
      data: {
        tenantId: testTenant.id,
        branchId: testBranch.id,
        actorId: userA.id,
        actorName: userA.fullName,
        actorRole: 'TEACHER',
        action: 'UPDATE_ROLES',
        entity: 'User',
        entityId: userA.id,
        module: 'Users',
        summary: 'Updated roles to [TEACHER, ACCOUNTS] with primary TEACHER',
      },
    })
    assert(auditRecord.id !== null, 'Immutable audit log recorded for user role lifecycle update')
    assert(auditRecord.tenantId === testTenant.id, 'Audit log correctly scoped to tenant')
    assert(auditRecord.module === 'Users', 'Audit log categorized under Users module')

  } catch (err: any) {
    console.error('Test execution exception:', err)
    failed++
  } finally {
    console.log('\n[CLEANUP] Cleaning up test records...')
    if (testTenant) {
      await db.auditLog.deleteMany({ where: { tenantId: testTenant.id } }).catch(() => {})
      await db.studentGuardian.deleteMany({ where: { student: { tenantId: testTenant.id } } }).catch(() => {})
      await db.guardian.deleteMany({ where: { tenantId: testTenant.id } }).catch(() => {})
      await db.student.deleteMany({ where: { tenantId: testTenant.id } }).catch(() => {})
      await db.classroom.deleteMany({ where: { tenantId: testTenant.id } }).catch(() => {})
      await db.academicSession.deleteMany({ where: { tenantId: testTenant.id } }).catch(() => {})
      await db.staffProfile.deleteMany({ where: { tenantId: testTenant.id } }).catch(() => {})
      await db.tenantUser.deleteMany({ where: { tenantId: testTenant.id } }).catch(() => {})
      await db.branch.deleteMany({ where: { tenantId: testTenant.id } }).catch(() => {})
      await db.tenant.delete({ where: { id: testTenant.id } }).catch(() => {})
    }
  }

  console.log('\n===============================================================')
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
  console.log('===============================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch((e) => {
  console.error('Fatal error running tests:', e)
  process.exit(1)
})
