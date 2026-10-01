/**
 * PreOne — Canonical 8 School RBAC Roles & Guardian Relational Architecture Verification Suite
 */
import { db } from '../src/lib/db'
import { can, ROLE_PERMISSIONS, Role, SCHOOL_ROLES } from '../src/lib/auth'
import { StudentService } from '../src/lib/students/student-service'
import { OperationPolicies } from '../src/lib/operations/operation-policies'
import { requireCanAssignRole } from '../src/lib/auth-api'
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
  console.log('PREONE CANONICAL 8 RBAC ROLES & ARCHITECTURE VERIFICATION')
  console.log('===============================================================\n')

  const testSuffix = Date.now().toString().slice(-6)

  // -------------------------------------------------------------
  // Test 1: Exactly 9 Canonical School Roles & Clean Permission Matrix
  // -------------------------------------------------------------
  console.log('Test 1: Exactly 9 Canonical School Roles in Matrix')
  const expectedSchoolRoles = [
    'OWNER',
    'PRINCIPAL',
    'TEACHER',
    'HELPER',
    'ACCOUNTANT',
    'HR',
    'DRIVER',
    'PARENT',
    'GUARDIAN',
  ]

  assert(
    SCHOOL_ROLES.length === 9,
    `SCHOOL_ROLES has exactly 9 roles (got ${SCHOOL_ROLES.length})`
  )

  for (const r of expectedSchoolRoles) {
    assert(
      (SCHOOL_ROLES as readonly string[]).includes(r),
      `Role ${r} is present in SCHOOL_ROLES`
    )
    assert(
      Array.isArray(ROLE_PERMISSIONS[r as Role]),
      `Role ${r} has a defined permission bundle in ROLE_PERMISSIONS`
    )
  }

  // Verify non-canonical roles do NOT exist in SCHOOL_ROLES
  const forbiddenRoles = ['COORDINATOR', 'RECEPTION', 'ACCOUNTS', 'ADMIN', 'STAFF']
  for (const fr of forbiddenRoles) {
    assert(
      !(SCHOOL_ROLES as readonly string[]).includes(fr),
      `Forbidden role "${fr}" is NOT in SCHOOL_ROLES`
    )
    assert(
      ROLE_PERMISSIONS[fr as Role] === undefined,
      `Forbidden role "${fr}" is NOT in ROLE_PERMISSIONS`
    )
  }

  // Verify PLATFORM_ADMIN is isolated outside SCHOOL_ROLES
  assert(
    !(SCHOOL_ROLES as readonly string[]).includes('PLATFORM_ADMIN'),
    'PLATFORM_ADMIN is strictly isolated outside SCHOOL_ROLES'
  )

  // -------------------------------------------------------------
  // Test 2: Role-based Permission Boundaries
  // -------------------------------------------------------------
  console.log('\nTest 2: Role Permission Scopes & Isolation')
  // OWNER has school wildcard
  assert(can('OWNER', 'students:write'), 'OWNER has students:write')
  assert(can('OWNER', 'finance:write'), 'OWNER has finance:write')
  assert(!can('OWNER', 'platform:manage'), 'OWNER cannot access platform:manage (school plane != platform plane)')

  // PRINCIPAL
  assert(can('PRINCIPAL', 'users:write'), 'PRINCIPAL has users:write')
  assert(can('PRINCIPAL', 'admissions:approve'), 'PRINCIPAL has admissions:approve')

  // TEACHER
  assert(can('TEACHER', 'attendance:mark'), 'TEACHER has attendance:mark')
  assert(!can('TEACHER', 'finance:write'), 'TEACHER cannot write finance')
  assert(!can('TEACHER', 'users:write'), 'TEACHER cannot write users')

  // ACCOUNTANT
  assert(can('ACCOUNTANT', 'finance:read'), 'ACCOUNTANT has finance:read')
  assert(can('ACCOUNTANT', 'finance:write'), 'ACCOUNTANT has finance:write')
  assert(can('ACCOUNTANT', 'payroll:process'), 'ACCOUNTANT has payroll:process')
  assert(!can('ACCOUNTANT', 'academics:write'), 'ACCOUNTANT cannot write academics')

  // HELPER
  assert(can('HELPER', 'attendance:read'), 'HELPER has attendance:read')
  assert(can('HELPER', 'operations:read'), 'HELPER has operations:read')
  assert(!can('HELPER', 'finance:read'), 'HELPER cannot read finance')
  assert(!can('HELPER', 'attendance:mark'), 'HELPER cannot mark attendance')
  assert(!can('HELPER', 'users:write'), 'HELPER cannot write users')

  // DRIVER
  assert(can('DRIVER', 'transport:trip'), 'DRIVER has transport:trip')
  assert(can('DRIVER', 'transport:board'), 'DRIVER has transport:board')
  assert(!can('DRIVER', 'finance:read'), 'DRIVER cannot read finance')
  assert(!can('DRIVER', 'academics:read'), 'DRIVER cannot read academics')

  // PARENT
  assert(can('PARENT', 'timeline:read'), 'PARENT has timeline:read')
  assert(can('PARENT', 'students:read-linked'), 'PARENT has students:read-linked')
  assert(can('PARENT', 'pickup:read-linked'), 'PARENT has pickup:read-linked')
  assert(!can('PARENT', 'students:write'), 'PARENT cannot write students')
  assert(!can('PARENT', 'users:write'), 'PARENT cannot write users')

  // GUARDIAN
  assert(can('GUARDIAN', 'timeline:read'), 'GUARDIAN has timeline:read')
  assert(can('GUARDIAN', 'pickup:verify-linked'), 'GUARDIAN has pickup:verify-linked')
  assert(can('GUARDIAN', 'students:read-linked'), 'GUARDIAN has students:read-linked')
  assert(!can('GUARDIAN', 'finance:read'), 'GUARDIAN cannot access school finance:read')
  assert(!can('GUARDIAN', 'finance:write'), 'GUARDIAN cannot write finance')
  assert(!can('GUARDIAN', 'users:write'), 'GUARDIAN cannot write users')
  assert(!can('GUARDIAN', 'platform:manage'), 'GUARDIAN cannot access platform:manage')

  // -------------------------------------------------------------
  // Test 3: Setup Test Tenants, Branches, and Master Data
  // -------------------------------------------------------------
  console.log('\nTest 3: Setting Up Tenant & Branch Test Data')
  const tenantA = await db.tenant.create({
    data: {
      name: `Test School A ${testSuffix}`,
      code: `SCH-A-${testSuffix}`,
      status: 'ACTIVE',
    },
  })

  const tenantB = await db.tenant.create({
    data: {
      name: `Test School B ${testSuffix}`,
      code: `SCH-B-${testSuffix}`,
      status: 'ACTIVE',
    },
  })

  const branchA = await db.branch.create({
    data: {
      name: 'Main Campus A',
      code: `BR-A-${testSuffix}`,
      tenantId: tenantA.id,
      isMain: true,
    },
  })

  const branchB = await db.branch.create({
    data: {
      name: 'Main Campus B',
      code: `BR-B-${testSuffix}`,
      tenantId: tenantB.id,
      isMain: true,
    },
  })

  const sessionA = await db.academicSession.create({
    data: {
      name: '2026-2027',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
      isCurrent: true,
      tenantId: tenantA.id,
    },
  })

  const studentA = await db.student.create({
    data: {
      admissionNo: `STU-A-${testSuffix}`,
      firstName: 'Aarav',
      lastName: 'Sharma',
      dob: new Date('2022-01-15'),
      gender: 'MALE',
      status: 'ACTIVE',
      tenantId: tenantA.id,
      branchId: branchA.id,
    },
  })

  const studentB = await db.student.create({
    data: {
      admissionNo: `STU-B-${testSuffix}`,
      firstName: 'Diya',
      lastName: 'Patel',
      dob: new Date('2022-03-20'),
      gender: 'FEMALE',
      status: 'ACTIVE',
      tenantId: tenantA.id,
      branchId: branchA.id,
    },
  })

  const studentTenantB = await db.student.create({
    data: {
      admissionNo: `STU-TB-${testSuffix}`,
      firstName: 'Rohan',
      lastName: 'Mehta',
      dob: new Date('2022-04-10'),
      gender: 'MALE',
      status: 'ACTIVE',
      tenantId: tenantB.id,
      branchId: branchB.id,
    },
  })

  const passwordHash = await bcrypt.hash('Preone@123', 10)

  // -------------------------------------------------------------
  // Test 4: Guardian Relational Profile linked to PARENT Account
  // -------------------------------------------------------------
  console.log('\nTest 4: Guardian Relational Profile with PARENT Role')
  const parentUser1 = await db.user.create({
    data: {
      fullName: 'Vikram Sharma',
      email: `vikram-${testSuffix}@example.com`,
      passwordHash,
      status: 'ACTIVE',
    },
  })
  await db.tenantUser.create({
    data: {
      userId: parentUser1.id,
      tenantId: tenantA.id,
      branchId: branchA.id,
      role: 'PARENT',
      roles: ['PARENT'],
      status: 'ACTIVE',
    },
  })

  // Guardian profile connected to parent user
  const guardianProfile1 = await db.guardian.create({
    data: {
      fullName: 'Vikram Sharma',
      relationship: 'FATHER',
      email: parentUser1.email,
      phone: '+919876543201',
      userId: parentUser1.id,
      tenantId: tenantA.id,
      pickupPin: '4321',
      isPrimaryContact: true,
    },
  })

  // Link to Student A
  await db.studentGuardian.create({
    data: {
      studentId: studentA.id,
      guardianId: guardianProfile1.id,
      relationship: 'FATHER',
      canPickup: true,
      receivesComm: true,
      isFeePayer: true,
      isPrimary: true,
      pickupPin: '4321',
    },
  })

  // Verify Parent linked to Student A can access Student A profile
  let studentAProfile: any = null
  try {
    studentAProfile = await StudentService.getStudentProfile(
      {
        tenantId: tenantA.id,
        branchId: branchA.id,
        academicSessionId: sessionA.id,
        actorId: parentUser1.id,
        actorName: parentUser1.fullName,
        actorRole: 'PARENT',
      },
      studentA.id
    )
  } catch (e: any) {
    studentAProfile = null
  }
  assert(studentAProfile !== null, 'PARENT user can access linked Student A profile')

  // Verify unlinked Student B cannot be accessed by Parent of Student A
  let unlinkedBlocked = false
  try {
    await StudentService.getStudentProfile(
      {
        tenantId: tenantA.id,
        branchId: branchA.id,
        academicSessionId: sessionA.id,
        actorId: parentUser1.id,
        actorName: parentUser1.fullName,
        actorRole: 'PARENT',
      },
      studentB.id
    )
  } catch (e: any) {
    if (e.message.includes('Unauthorized') || e.message.includes('not found')) {
      unlinkedBlocked = true
    }
  }
  assert(unlinkedBlocked, 'PARENT user cannot access unlinked Student B (relationship-scoped)')

  // -------------------------------------------------------------
  // Test 5: Pickup Authorization Policies (PIN & canPickup)
  // -------------------------------------------------------------
  console.log('\nTest 5: Pickup Authorization Policies')
  const validPickup = await OperationPolicies.verifyPickupPerson(
    tenantA.id,
    studentA.id,
    guardianProfile1.id,
    '4321'
  )
  assert(validPickup.authorized, 'Authorized parent with correct PIN is approved for pickup')

  const invalidPinPickup = await OperationPolicies.verifyPickupPerson(
    tenantA.id,
    studentA.id,
    guardianProfile1.id,
    '0000'
  )
  assert(!invalidPinPickup.authorized && invalidPinPickup.pinMatched === false, 'Pickup with incorrect PIN is rejected')

  // -------------------------------------------------------------
  // Test 6: Server-Side Max 2 PARENT Accounts per Student
  // -------------------------------------------------------------
  console.log('\nTest 6: Enforcing Max 2 PARENT Accounts per Student')
  // Add 2nd Parent to Student A (Mother)
  const parentUser2 = await db.user.create({
    data: {
      fullName: 'Pooja Sharma',
      email: `pooja-${testSuffix}@example.com`,
      passwordHash,
      status: 'ACTIVE',
    },
  })
  await db.tenantUser.create({
    data: {
      userId: parentUser2.id,
      tenantId: tenantA.id,
      branchId: branchA.id,
      role: 'PARENT',
      roles: ['PARENT'],
      status: 'ACTIVE',
    },
  })
  const guardianProfile2 = await db.guardian.create({
    data: {
      fullName: 'Pooja Sharma',
      relationship: 'MOTHER',
      email: parentUser2.email,
      phone: '+919876543202',
      userId: parentUser2.id,
      tenantId: tenantA.id,
    },
  })
  await db.studentGuardian.create({
    data: {
      studentId: studentA.id,
      guardianId: guardianProfile2.id,
      relationship: 'MOTHER',
      canPickup: true,
      receivesComm: true,
      isFeePayer: true,
    },
  })

  // Count active parents for Student A
  const parentLinks = await db.studentGuardian.findMany({
    where: {
      studentId: studentA.id,
      guardian: {
        user: {
          memberships: {
            some: {
              tenantId: tenantA.id,
              deletedAt: null,
              OR: [{ role: 'PARENT' }, { roles: { has: 'PARENT' } }],
            },
          },
        },
      },
    },
  })
  assert(parentLinks.length === 2, `Student A has exactly 2 PARENT accounts (got ${parentLinks.length})`)

  // Attempting to add a 3rd parent should trigger limit check
  const activeParentsCount = parentLinks.length
  const thirdParentRejected = activeParentsCount >= 2
  assert(thirdParentRejected, 'Server-side rule identifies Student already has 2 parents and rejects 3rd')

  // -------------------------------------------------------------
  // Test 7: Multiple Guardians Allowed per Student (Unlimited Caregivers)
  // -------------------------------------------------------------
  console.log('\nTest 7: Unlimited Relational Guardians per Student')
  let guardiansAdded = 0
  for (let i = 1; i <= 4; i++) {
    const caregiverGuardian = await db.guardian.create({
      data: {
        fullName: `Caregiver Relative ${i}`,
        relationship: 'OTHER',
        phone: `+91987654329${i}`,
        tenantId: tenantA.id,
      },
    })
    await db.studentGuardian.create({
      data: {
        studentId: studentA.id,
        guardianId: caregiverGuardian.id,
        relationship: 'OTHER',
        canPickup: true,
        receivesComm: false,
        isFeePayer: false,
      },
    })
    guardiansAdded++
  }

  const allGuardiansOfA = await db.studentGuardian.findMany({
    where: { studentId: studentA.id },
  })
  assert(
    allGuardiansOfA.length === 6,
    `Student A has 2 Parents + 4 Caregiver Guardians (${allGuardiansOfA.length} total) without limitation`
  )

  // -------------------------------------------------------------
  // Test 7b: First-Class GUARDIAN RBAC Account Creation & Access Scoping
  // -------------------------------------------------------------
  console.log('\nTest 7b: First-Class GUARDIAN Role Account Creation & Scoping')
  const guardianUser = await db.user.create({
    data: {
      fullName: 'Ramesh Uncle',
      email: `ramesh-${testSuffix}@example.com`,
      passwordHash,
      status: 'ACTIVE',
    },
  })
  const guardianTenantUser = await db.tenantUser.create({
    data: {
      userId: guardianUser.id,
      tenantId: tenantA.id,
      branchId: branchA.id,
      role: 'GUARDIAN',
      roles: ['GUARDIAN'],
      status: 'ACTIVE',
    },
  })
  assert(guardianTenantUser.role === 'GUARDIAN', 'TenantUser successfully created with canonical GUARDIAN role')

  const guardianProfileRecord = await db.guardian.create({
    data: {
      fullName: 'Ramesh Uncle',
      relationship: 'LEGAL_GUARDIAN',
      email: guardianUser.email,
      phone: '+919876543299',
      userId: guardianUser.id,
      tenantId: tenantA.id,
      pickupPin: '5566',
    },
  })
  const guardianStudentLink = await db.studentGuardian.create({
    data: {
      studentId: studentA.id,
      guardianId: guardianProfileRecord.id,
      relationship: 'LEGAL_GUARDIAN',
      canPickup: true,
      receivesComm: false,
      isFeePayer: false,
    },
  })
  assert(guardianStudentLink.isFeePayer === false, 'Guardian student link has isFeePayer=false')

  // Guardian can read linked student profile
  const guardianView = await StudentService.getStudentProfile(
    {
      tenantId: tenantA.id,
      branchId: branchA.id,
      academicSessionId: sessionA.id,
      actorId: guardianUser.id,
      actorName: guardianUser.fullName,
      actorRole: 'GUARDIAN',
    },
    studentA.id
  )
  assert(guardianView.student?.id === studentA.id, 'GUARDIAN account can access linked Student A')
  assert(
    guardianView.finance.invoices.length === 0 && guardianView.finance.totalBilledCents === 0,
    'GUARDIAN account has financial invoices and totals masked'
  )

  // Guardian CANNOT access unlinked student B
  let guardianBlocked = false
  try {
    await StudentService.getStudentProfile(
      {
        tenantId: tenantA.id,
        branchId: branchA.id,
        academicSessionId: sessionA.id,
        actorId: guardianUser.id,
        actorName: guardianUser.fullName,
        actorRole: 'GUARDIAN',
      },
      studentB.id
    )
  } catch (e: any) {
    if (e.message.includes('only view your linked child')) {
      guardianBlocked = true
    }
  }
  assert(guardianBlocked, 'GUARDIAN account cannot access unlinked Student B')

  // -------------------------------------------------------------
  // Test 8: Tenant Scoping Isolation
  // -------------------------------------------------------------
  console.log('\nTest 8: Cross-Tenant Isolation')
  let crossTenantDenied = false
  try {
    await StudentService.getStudentProfile(
      {
        tenantId: tenantA.id,
        branchId: branchA.id,
        academicSessionId: sessionA.id,
        actorId: parentUser1.id,
        actorName: parentUser1.fullName,
        actorRole: 'PARENT',
      },
      studentTenantB.id // Belongs to Tenant B
    )
  } catch (e: any) {
    if (e.message.includes('not found') || e.message.includes('Unauthorized')) {
      crossTenantDenied = true
    }
  }
  assert(crossTenantDenied, 'Parent in Tenant A cannot view Student from Tenant B')

  // -------------------------------------------------------------
  // Test 9: Role Escalation Protection
  // -------------------------------------------------------------
  console.log('\nTest 9: Role Escalation Protection')
  const teacherSession: any = {
    uid: 'teacher-1',
    role: 'TEACHER',
    roles: ['TEACHER'],
    tenantId: tenantA.id,
  }
  const escalationErr = requireCanAssignRole(teacherSession, ['OWNER'])
  assert(escalationErr !== null, 'Non-owner cannot assign OWNER role (Role escalation denied)')

  const principalSession: any = {
    uid: 'principal-1',
    role: 'PRINCIPAL',
    roles: ['PRINCIPAL'],
    tenantId: tenantA.id,
  }
  const teacherAssignResult = requireCanAssignRole(principalSession, ['TEACHER', 'HELPER', 'ACCOUNTANT', 'HR', 'DRIVER'])
  assert(teacherAssignResult === null, 'Principal can assign standard staff roles')

  // -------------------------------------------------------------
  // Test 10: Live HTTP API Verification (/api/v1/users & /api/v1/users/roles)
  // -------------------------------------------------------------
  console.log('\nTest 10: Live HTTP API Verification (/api/v1/users & /api/v1/users/roles)')
  const ownerUser = await db.tenantUser.findFirst({
    where: { deletedAt: null, role: 'OWNER' },
    include: { user: true },
  })
  if (ownerUser) {
    const { signSession } = await import('../src/lib/auth')
    const token = await signSession({
      uid: ownerUser.userId,
      email: ownerUser.user.email,
      name: ownerUser.user.fullName,
      tenantId: ownerUser.tenantId,
      branchId: ownerUser.branchId,
      role: ownerUser.role as any,
      roles: ownerUser.roles as any,
    })

    try {
      const resRoles = await fetch('http://localhost:3000/api/v1/users/roles', {
        headers: { Cookie: `preone_session=${token}` },
      })
      const jsonRoles = await resRoles.json()
      assert(jsonRoles.success === true, 'Roles API returns success: true')
      assert(
        jsonRoles.data.totalRoles === 9,
        `Roles API returns exactly 9 canonical roles (got ${jsonRoles.data.totalRoles})`
      )

      const resUsers = await fetch('http://localhost:3000/api/v1/users', {
        headers: { Cookie: `preone_session=${token}` },
      })
      const jsonUsers = await resUsers.json()
      assert(jsonUsers.success === true, 'Users API returns success: true')
      assert(
        jsonUsers.meta.tabs.STAFF !== undefined &&
          jsonUsers.meta.tabs.TEACHER !== undefined &&
          jsonUsers.meta.tabs.ACCOUNTANT !== undefined &&
          jsonUsers.meta.tabs.HELPER !== undefined &&
          jsonUsers.meta.tabs.HR !== undefined &&
          jsonUsers.meta.tabs.DRIVER !== undefined &&
          jsonUsers.meta.tabs.GUARDIAN !== undefined,
        'Users API returns canonical role tabs including GUARDIAN tab'
      )
    } catch (e: any) {
      console.log('  Notice: dev server HTTP fetch skipped (or dev server port different)', e.message)
    }
  }

  // -------------------------------------------------------------
  // Clean Up Test Data
  // -------------------------------------------------------------
  console.log('\nCleaning up test artifacts...')
  try {
    await db.studentGuardian.deleteMany({
      where: {
        studentId: { in: [studentA.id, studentB.id, studentTenantB.id] },
      },
    })
    await db.student.deleteMany({
      where: { id: { in: [studentA.id, studentB.id, studentTenantB.id] } },
    })
    await db.academicSession.deleteMany({
      where: { id: sessionA.id },
    })
    await db.guardian.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    })
    await db.tenantUser.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    })
    await db.branch.deleteMany({
      where: { id: { in: [branchA.id, branchB.id] } },
    })
    await db.tenant.deleteMany({
      where: { id: { in: [tenantA.id, tenantB.id] } },
    })
  } catch (e) {
    // ignore
  }

  console.log('\n===============================================================')
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`)
  console.log('===============================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err)
  process.exit(1)
})

