import { db } from '../src/lib/db'
import { StaffUserService } from '../src/lib/users/staff-user-service'
import { validateStaffInput } from '../src/lib/users/user-validation'
import bcrypt from 'bcryptjs'

async function runStaffOnboardingVerification() {
  console.log('===============================================================')
  console.log('PREONE — STAFF ONBOARDING SPECIFICATION VERIFICATION TEST')
  console.log('===============================================================\n')

  let passed = 0
  let failed = 0

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ ${msg}`)
      passed++
    } else {
      console.error(`  ✗ FAILED: ${msg}`)
      failed++
    }
  }

  // 1. Create a clean test tenant and branch
  const testTenant = await db.tenant.create({
    data: {
      name: 'Staff Test Academy',
      code: `STAFFTEST_${Date.now()}`,
    },
  })

  const testBranch = await db.branch.create({
    data: {
      tenantId: testTenant.id,
      name: 'Main Campus',
      code: `MAIN_${Date.now()}`,
    },
  })

  const testSession = await db.academicSession.create({
    data: {
      tenantId: testTenant.id,
      name: '2026-2027',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
      isCurrent: true,
    },
  })

  const testClassroom = await db.classroom.create({
    data: {
      tenantId: testTenant.id,
      branchId: testBranch.id,
      academicSessionId: testSession.id,
      name: 'Toddler Sunshine A',
      code: 'TODD-A',
      programType: 'NURSERY',
      capacity: 20,
    },
  })

  try {
    console.log('[1] Field Validation & Role Escalation Rules')

    // Reject missing name
    const v1 = validateStaffInput({
      fullName: '',
      email: 'test@example.com',
      role: 'TEACHER',
    } as any)
    assert(!v1.valid && v1.errors.some((e) => e.includes('Full name')), 'Rejects missing full name')

    // Reject invalid email
    const v2 = validateStaffInput({
      fullName: 'Anita Roy',
      email: 'not-an-email',
      role: 'TEACHER',
    } as any)
    assert(!v2.valid && v2.errors.some((e) => e.includes('email address')), 'Rejects invalid email format')

    // Reject PARENT role in staff flow
    const v3 = validateStaffInput({
      fullName: 'Anita Roy',
      email: 'anita@example.com',
      role: 'PARENT' as any,
    })
    assert(!v3.valid && v3.errors.some((e) => e.includes('Parent and Guardian')), 'Rejects PARENT role in Staff flow')

    // Reject PLATFORM_ADMIN role
    const v4 = validateStaffInput({
      fullName: 'Anita Roy',
      email: 'anita@example.com',
      role: 'PLATFORM_ADMIN' as any,
    })
    assert(!v4.valid && v4.errors.some((e) => e.includes('PLATFORM_ADMIN')), 'Rejects PLATFORM_ADMIN role')

    console.log('\n[2] Canonical Staff Creation with Full Field Architecture')

    const teacherResult = await StaffUserService.createStaff(
      {
        tenantId: testTenant.id,
        actorId: 'owner-uuid',
        actorRole: 'OWNER',
        actorName: 'School Owner',
      },
      {
        avatarUrl: 'https://example.com/photos/anita.jpg',
        fullName: 'Anita Roy',
        email: 'ANITA.ROY@example.com',
        phone: '+91 98765 43210',
        username: 'anita.roy',
        password: 'SecurePassword@123',
        primaryRole: 'TEACHER',
        additionalRoles: ['HR'],
        branchId: testBranch.id,
        status: 'ACTIVE',
        employeeCode: 'EMP-TCH-001',
        designation: 'Lead Nursery Teacher',
        department: 'Academics',
        qualification: 'M.Ed, Early Childhood Specialist',
        employmentType: 'REGULAR',
        joiningDate: '2026-06-01',
        dateOfBirth: '1990-08-15',
        gender: 'FEMALE',
        classroomId: testClassroom.id,
      }
    )

    // Verify User record
    assert(teacherResult.user.id !== undefined, 'User record created')
    assert(teacherResult.user.email === 'anita.roy@example.com', 'User email normalized to lowercase')
    assert(teacherResult.user.username === 'anita.roy', 'Username saved correctly')
    assert(teacherResult.user.avatarUrl === 'https://example.com/photos/anita.jpg', 'avatarUrl saved on User')

    // Verify Password Hashing
    assert(
      teacherResult.user.passwordHash.startsWith('$2') &&
        teacherResult.user.passwordHash !== 'SecurePassword@123',
      'Password hashed with bcrypt (never plain text)'
    )
    const passwordValid = await bcrypt.compare('SecurePassword@123', teacherResult.user.passwordHash)
    assert(passwordValid, 'Bcrypt password hash verifies successfully')

    // Verify TenantUser membership
    assert(teacherResult.membership.tenantId === testTenant.id, 'TenantUser scoped to tenant')
    assert(teacherResult.membership.role === 'TEACHER', 'Primary role is TEACHER')
    assert(
      teacherResult.membership.roles.includes('TEACHER') &&
        (teacherResult.membership.roles.includes('HR') || teacherResult.membership.roles.includes('STAFF')),
      'Multi-role TenantUser.roles contains [TEACHER, HR/STAFF]'
    )
    assert(teacherResult.membership.branchId === testBranch.id, 'TenantUser scoped to branch')
    assert(teacherResult.membership.status === 'ACTIVE', 'Membership status is ACTIVE')

    // Verify StaffProfile
    const profile = await db.staffProfile.findUnique({
      where: { userId: teacherResult.user.id },
    })
    assert(profile !== null, 'StaffProfile created linked to User')
    assert(profile?.employeeCode === 'EMP-TCH-001', 'StaffProfile.employeeCode matches')
    assert(profile?.designation === 'Lead Nursery Teacher', 'StaffProfile.designation matches')
    assert(profile?.department === 'Academics', 'StaffProfile.department matches')
    assert(profile?.qualification === 'M.Ed, Early Childhood Specialist', 'StaffProfile.qualification matches')
    assert(profile?.employmentType === 'REGULAR', 'StaffProfile.employmentType matches')
    assert(profile?.gender === 'FEMALE', 'StaffProfile.gender matches FEMALE')
    assert(
      profile?.dateOfBirth?.toISOString().startsWith('1990-08-15'),
      'StaffProfile.dateOfBirth persisted correctly'
    )
    assert(
      profile?.joiningDate?.toISOString().startsWith('2026-06-01'),
      'StaffProfile.joiningDate persisted correctly'
    )

    // Verify Classroom Binding
    const updatedClassroom = await db.classroom.findUnique({
      where: { id: testClassroom.id },
    })
    assert(
      updatedClassroom?.primaryTeacherId === teacherResult.user.id,
      'Classroom.primaryTeacherId foreign key points to teacher User'
    )

    console.log('\n[3] Idempotent Identity Resolution (Existing Global User)')

    // Same email in same tenant should update/reuse without duplicate User row
    const userCountBefore = await db.user.count({ where: { email: 'anita.roy@example.com' } })
    assert(userCountBefore === 1, 'Only 1 User record before reuse')

    const reuseResult = await StaffUserService.createStaff(
      {
        tenantId: testTenant.id,
        actorId: 'owner-uuid',
        actorRole: 'OWNER',
        actorName: 'School Owner',
      },
      {
        fullName: 'Anita Roy Updated',
        email: 'ANITA.ROY@example.com',
        primaryRole: 'TEACHER',
        additionalRoles: ['HR', 'ACCOUNTANT'],
        branchId: testBranch.id,
        employeeCode: 'EMP-TCH-001',
        designation: 'Head Teacher & Accountant',
      }
    )

    const userCountAfter = await db.user.count({ where: { email: 'anita.roy@example.com' } })
    assert(userCountAfter === 1, 'Zero duplicate User entities created on existing email')
    assert(reuseResult.user.id === teacherResult.user.id, 'Reused same User ID')
    assert(
      reuseResult.membership.roles.includes('ACCOUNTS') || reuseResult.membership.roles.includes('ACCOUNTANT'),
      'Roles merged cleanly in existing TenantUser'
    )

    console.log('\n[4] Role Escalation Protection (Server-Side Enforcement)')

    try {
      await StaffUserService.createStaff(
        {
          tenantId: testTenant.id,
          actorId: 'teacher-uuid',
          actorRole: 'TEACHER',
        },
        {
          fullName: 'Fake Owner',
          email: 'fake.owner@example.com',
          primaryRole: 'OWNER',
          branchId: testBranch.id,
        }
      )
      assert(false, 'Should block non-owner from creating OWNER')
    } catch (e: any) {
      assert(e.message.includes('Unauthorized'), 'Non-owner blocked from creating OWNER account')
    }

    try {
      await StaffUserService.createStaff(
        {
          tenantId: testTenant.id,
          actorId: 'owner-uuid',
          actorRole: 'OWNER',
        },
        {
          fullName: 'Platform Admin Attempt',
          email: 'admin.attempt@example.com',
          primaryRole: 'PLATFORM_ADMIN' as any,
          branchId: testBranch.id,
        }
      )
      assert(false, 'Should block creating PLATFORM_ADMIN')
    } catch (e: any) {
      assert(e.message.includes('PLATFORM_ADMIN'), 'PLATFORM_ADMIN cannot be assigned through staff workflow')
    }

    console.log('\n[5] Immutable Audit Trail Verification')

    const auditLog = await db.auditLog.findFirst({
      where: {
        tenantId: testTenant.id,
        action: 'STAFF_CREATED',
        entityId: teacherResult.user.id,
      },
      orderBy: { createdAt: 'desc' },
    })
    assert(auditLog !== null, 'Immutable AuditLog record exists for staff creation')
    assert(auditLog?.summary.includes('Anita Roy'), 'Audit summary contains employee details')
    const rawAudit = JSON.stringify(auditLog)
    assert(!rawAudit.includes('SecurePassword@123'), 'Plain password never present in AuditLog')
  } finally {
    // Cleanup
    console.log('\n[Cleaning up test records...]')
    await db.classroom.deleteMany({ where: { tenantId: testTenant.id } })
    await db.academicSession.deleteMany({ where: { tenantId: testTenant.id } })
    await db.staffProfile.deleteMany({ where: { tenantId: testTenant.id } })
    await db.tenantUser.deleteMany({ where: { tenantId: testTenant.id } })
    await db.auditLog.deleteMany({ where: { tenantId: testTenant.id } })
    await db.branch.deleteMany({ where: { tenantId: testTenant.id } })
    await db.tenant.delete({ where: { id: testTenant.id } })
    await db.user.deleteMany({ where: { email: 'anita.roy@example.com' } })
  }

  console.log('\n===============================================================')
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
  console.log('===============================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runStaffOnboardingVerification().catch((err) => {
  console.error('Fatal test runner failure:', err)
  process.exit(1)
})
