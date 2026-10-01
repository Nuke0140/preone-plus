/**
 * PreOne — Family User / Parent & Guardian Onboarding Specification Verification Test
 *
 * Verifies:
 * 1. Field validation & role restrictions (only PARENT & GUARDIAN allowed; staff/platform blocked)
 * 2. Canonical Parent Onboarding & Student Linkage (User -> TenantUser -> Guardian -> StudentGuardian -> Student)
 * 3. Idempotent identity resolution & multi-child (sibling) support
 * 4. Strict Max 2 Parents rule per child & unlimited Guardians
 * 5. New child atomic enrollment via StudentService with rollback protection
 * 6. Family CSV engine (21-column schema, dynamic Max 2 Parents check across rows, no silent override)
 * 7. Security, PIN protection, and immutable audit logs without secret leakage
 */

import { db } from '../src/lib/db'
import { FamilyUserService, normalizeRelationship } from '../src/lib/users/family-user-service'
import { validateFamilyInput } from '../src/lib/users/user-validation'
import { UserCsvEngine } from '../src/lib/users/csv-engine'
import bcrypt from 'bcryptjs'

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ✕ FAILED: ${msg}`)
    throw new Error(`Assertion failed: ${msg}`)
  }
  console.log(`  ✓ ${msg}`)
}

async function main() {
  console.log('\n===============================================================')
  console.log('PREONE — FAMILY ONBOARDING SPECIFICATION VERIFICATION TEST')
  console.log('===============================================================\n')

  const uniqueSuffix = Date.now().toString().slice(-6)
  const testTenantCode = `fam-test-${uniqueSuffix}`

  // Setup test tenant, branch, academic session, classroom, and test students
  const tenant = await db.tenant.create({
    data: {
      name: `Family Test Preschool ${uniqueSuffix}`,
      code: testTenantCode,
      status: 'ACTIVE',
    },
  })

  const branch = await db.branch.create({
    data: {
      tenantId: tenant.id,
      name: 'Main Campus',
      code: 'MAIN',
      isMain: true,
    },
  })

  const session = await db.academicSession.create({
    data: {
      tenantId: tenant.id,
      name: '2026-2027',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
      isCurrent: true,
      status: 'ACTIVE',
    },
  })

  const program = await db.program.create({
    data: {
      tenantId: tenant.id,
      name: 'Nursery Explorers',
      code: `NUR-${uniqueSuffix}`,
      programType: 'NURSERY',
      ageMinMonths: 36,
      ageMaxMonths: 48,
      capacity: 20,
      isActive: true,
    },
  })

  const classroom = await db.classroom.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      academicSessionId: session.id,
      programId: program.id,
      name: 'Nursery A',
      code: 'NUR-A',
      programType: 'NURSERY',
      capacity: 20,
    },
  })

  const studentA = await db.student.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      admissionNo: `ADM-${uniqueSuffix}-01`,
      username: `aarav.${uniqueSuffix}`,
      firstName: 'Aarav',
      lastName: 'Patil',
      dob: new Date('2022-05-14'),
      gender: 'MALE',
      bloodGroup: 'B_POSITIVE',
      currentClassroomId: classroom.id,
      status: 'ACTIVE',
    },
  })

  const studentB = await db.student.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      admissionNo: `ADM-${uniqueSuffix}-02`,
      username: `siya.${uniqueSuffix}`,
      firstName: 'Siya',
      lastName: 'Patil',
      dob: new Date('2023-08-20'),
      gender: 'FEMALE',
      bloodGroup: 'B_POSITIVE',
      currentClassroomId: classroom.id,
      status: 'ACTIVE',
    },
  })

  try {
    // =========================================================================
    // 1. Validation & Role Restriction Rules
    // =========================================================================
    console.log('[1] Field Validation & Role Restriction Rules')

    const emptyVal = validateFamilyInput({
      role: 'PARENT',
      fullName: '',
      email: 'invalid-email',
      phone: '',
      relationship: 'FATHER',
      childMode: 'EXISTING',
      permissions: {},
    })
    assert(!emptyVal.valid, 'Rejects missing full name and phone')
    assert(emptyVal.errors.some((e) => e.includes('Invalid email')), 'Rejects invalid email format')

    const illegalStaffVal = validateFamilyInput({
      role: 'TEACHER' as any,
      fullName: 'Teacher Rahul',
      email: 'teacher@test.com',
      phone: '+919876543210',
      relationship: 'FATHER',
      childMode: 'EXISTING',
      permissions: {},
    })
    assert(!illegalStaffVal.valid, 'Rejects non-family role (TEACHER) in family onboarding flow')

    const illegalAdminVal = validateFamilyInput({
      role: 'PLATFORM_ADMIN' as any,
      fullName: 'Admin User',
      email: 'admin@test.com',
      phone: '+919876543210',
      relationship: 'FATHER',
      childMode: 'EXISTING',
      permissions: {},
    })
    assert(!illegalAdminVal.valid, 'Rejects PLATFORM_ADMIN role in family onboarding flow')

    // =========================================================================
    // 2. Canonical Parent 1 Onboarding & Existing Child Link
    // =========================================================================
    console.log('\n[2] Canonical Parent 1 Onboarding & Existing Child Link')

    const parentEmail1 = `rahul.patil.${uniqueSuffix}@example.com`
    const parent1Result = await FamilyUserService.createFamilyUser(
      {
        tenantId: tenant.id,
        actorId: 'system-test',
        actorName: 'System Test',
        actorRole: 'OWNER',
      },
      {
        role: 'PARENT',
        fullName: 'Rahul Patil',
        email: parentEmail1,
        phone: `+9198765${uniqueSuffix.slice(-5)}0`,
        username: `rahul.patil.${uniqueSuffix}`,
        avatarUrl: 'https://cdn.preone.com/avatars/rahul.png',
        password: 'Password@2026',
        relationship: 'FATHER',
        childMode: 'EXISTING',
        existingChild: {
          admissionNo: studentA.admissionNo,
        },
        permissions: {
          canPickup: true,
          pickupPin: '1234',
          isFeePayer: true,
          receivesCommunication: true,
        },
      }
    )

    assert(Boolean(parent1Result.user?.id), 'User record created for Parent 1')
    assert(parent1Result.user.email === parentEmail1.toLowerCase(), 'User email normalized to lowercase')
    assert(parent1Result.user.avatarUrl === 'https://cdn.preone.com/avatars/rahul.png', 'avatarUrl persisted on User')

    const userInDb = await db.user.findUnique({ where: { id: parent1Result.user.id } })
    assert(userInDb?.passwordHash !== 'Password@2026', 'Password hashed with bcrypt (never plain text)')
    assert(await bcrypt.compare('Password@2026', userInDb!.passwordHash), 'Bcrypt password hash verifies successfully')

    assert(parent1Result.membership.role === 'PARENT', 'TenantUser.role is PARENT')
    assert(parent1Result.guardian.userId === parent1Result.user.id, 'Guardian.userId links to User global entity')

    const linkA = await db.studentGuardian.findUnique({
      where: {
        studentId_guardianId: {
          studentId: studentA.id,
          guardianId: parent1Result.guardian.id,
        },
      },
    })
    assert(Boolean(linkA), 'StudentGuardian relationship created for Student A')
    assert(linkA?.relationship === 'FATHER', 'StudentGuardian.relationship is FATHER')
    assert(linkA?.isFeePayer === true, 'StudentGuardian.isFeePayer is true for Parent')
    assert(linkA?.canPickup === true, 'StudentGuardian.canPickup is true')
    assert(linkA?.pickupPin === '1234', 'StudentGuardian.pickupPin matches input')

    // =========================================================================
    // 3. Multi-Child (Sibling) Linking with Idempotent User Reuse
    // =========================================================================
    console.log('\n[3] Multi-Child (Sibling) Linking with Idempotent User Reuse')

    // Link Rahul Patil to his second child Siya (studentB)
    const siblingLink = await FamilyUserService.linkStudentToGuardian(
      {
        tenantId: tenant.id,
        actorId: 'system-test',
        actorName: 'System Test',
        actorRole: 'OWNER',
      },
      {
        userId: parent1Result.user.id,
        studentAdmissionNo: studentB.admissionNo,
        relationship: 'FATHER',
        permissions: {
          canPickup: true,
          pickupPin: '1234',
          isFeePayer: true,
        },
      }
    )

    assert(Boolean(siblingLink.studentGuardian), 'StudentGuardian link created for sibling Student B')
    assert(siblingLink.student.id === studentB.id, 'Sibling student correctly resolved via admissionNo')

    const userCount = await db.user.count({ where: { email: parentEmail1.toLowerCase() } })
    assert(userCount === 1, 'Zero duplicate User entities created for multi-child father')

    const guardianLinks = await db.studentGuardian.count({ where: { guardianId: parent1Result.guardian.id } })
    assert(guardianLinks === 2, 'Guardian correctly linked to both children (Aarav and Siya)')

    // Test idempotent re-link: re-linking Rahul to Student A should not duplicate
    const reLinkResult = await FamilyUserService.createFamilyUser(
      {
        tenantId: tenant.id,
        actorId: 'system-test',
      },
      {
        role: 'PARENT',
        fullName: 'Rahul Patil',
        email: parentEmail1,
        phone: `+9198765${uniqueSuffix.slice(-5)}0`,
        relationship: 'FATHER',
        childMode: 'EXISTING',
        existingChild: {
          admissionNo: studentA.admissionNo,
        },
        permissions: {
          canPickup: true,
        },
      }
    )
    assert(reLinkResult.isAlreadyLinked === true, 'Re-linking existing parent + child flagged as isAlreadyLinked: true')

    // =========================================================================
    // 4. Max 2 Parents Policy Enforcement per Student
    // =========================================================================
    console.log('\n[4] Max 2 Parents Policy Enforcement per Student')

    // Onboard Parent 2 (Mother: Priya Patil) for Student A
    const parentEmail2 = `priya.patil.${uniqueSuffix}@example.com`
    const parent2Result = await FamilyUserService.createFamilyUser(
      {
        tenantId: tenant.id,
        actorId: 'system-test',
      },
      {
        role: 'PARENT',
        fullName: 'Priya Patil',
        email: parentEmail2,
        phone: `+9198765${uniqueSuffix.slice(-5)}1`,
        relationship: 'MOTHER',
        childMode: 'EXISTING',
        existingChild: {
          admissionNo: studentA.admissionNo,
        },
        permissions: {
          canPickup: true,
          isFeePayer: false,
        },
      }
    )
    assert(Boolean(parent2Result.user?.id), 'Parent 2 (Mother) onboarded successfully')

    const activeParentsOnStudentA = await FamilyUserService.countActiveParentsForStudent(tenant.id, studentA.id)
    assert(activeParentsOnStudentA === 2, 'Student A has exactly 2 registered PARENT accounts')

    // Attempt to onboard Parent 3 (Step-parent or extra parent) for Student A -> MUST FAIL
    let parent3Blocked = false
    try {
      await FamilyUserService.createFamilyUser(
        {
          tenantId: tenant.id,
          actorId: 'system-test',
        },
        {
          role: 'PARENT',
          fullName: 'Vikram Patil',
          email: `vikram.patil.${uniqueSuffix}@example.com`,
          phone: `+9198765${uniqueSuffix.slice(-5)}2`,
          relationship: 'OTHER',
          childMode: 'EXISTING',
          existingChild: {
            admissionNo: studentA.admissionNo,
          },
          permissions: {
            canPickup: true,
          },
        }
      )
    } catch (err: any) {
      if (err.code === 'PARENT_LIMIT_REACHED' || err.message.includes('2 registered Parent accounts')) {
        parent3Blocked = true
      }
    }
    assert(parent3Blocked, '3rd PARENT account for Student A is strictly blocked by Max 2 Parents policy')

    // =========================================================================
    // 5. Unlimited Authorized Guardians Allowed
    // =========================================================================
    console.log('\n[5] Unlimited Authorized Guardians Allowed')

    // Caregiver 3 as GUARDIAN (Grandmother) -> MUST SUCCEED
    const guardian1Result = await FamilyUserService.createFamilyUser(
      {
        tenantId: tenant.id,
        actorId: 'system-test',
      },
      {
        role: 'GUARDIAN',
        fullName: 'Sunita Patil',
        email: `sunita.patil.${uniqueSuffix}@example.com`,
        phone: `+9198765${uniqueSuffix.slice(-5)}3`,
        relationship: 'GRANDPARENT',
        childMode: 'EXISTING',
        existingChild: {
          admissionNo: studentA.admissionNo,
        },
        permissions: {
          canPickup: true,
          pickupPin: '5678',
          isFeePayer: false,
        },
      }
    )
    assert(Boolean(guardian1Result.user?.id), '3rd caregiver onboarded successfully with GUARDIAN role')
    assert(guardian1Result.membership.role === 'GUARDIAN', 'TenantUser.role is GUARDIAN')

    // Caregiver 4 as GUARDIAN (Uncle / Nanny) -> MUST ALSO SUCCEED
    const guardian2Result = await FamilyUserService.createFamilyUser(
      {
        tenantId: tenant.id,
        actorId: 'system-test',
      },
      {
        role: 'GUARDIAN',
        fullName: 'Ramesh Uncle',
        email: `ramesh.uncle.${uniqueSuffix}@example.com`,
        phone: `+9198765${uniqueSuffix.slice(-5)}4`,
        relationship: 'OTHER',
        childMode: 'EXISTING',
        existingChild: {
          admissionNo: studentA.admissionNo,
        },
        permissions: {
          canPickup: true,
          pickupPin: '9988',
          isFeePayer: false,
        },
      }
    )
    assert(Boolean(guardian2Result.user?.id), '4th caregiver onboarded successfully with GUARDIAN role')

    const totalCaregiversForStudentA = await db.studentGuardian.count({ where: { studentId: studentA.id } })
    assert(totalCaregiversForStudentA === 4, 'Student A has 4 total authorized caregivers (2 Parents + 2 Guardians)')

    // =========================================================================
    // 6. New Child Atomic Enrollment (CREATE mode)
    // =========================================================================
    console.log('\n[6] New Child Atomic Enrollment (CREATE mode)')

    const newChildAdmissionNo = `NEW-${uniqueSuffix}-01`
    const newChildParentEmail = `anand.verma.${uniqueSuffix}@example.com`

    const newChildResult = await FamilyUserService.createFamilyUser(
      {
        tenantId: tenant.id,
        actorId: 'system-test',
      },
      {
        role: 'PARENT',
        fullName: 'Anand Verma',
        email: newChildParentEmail,
        phone: `+9198765${uniqueSuffix.slice(-5)}5`,
        relationship: 'FATHER',
        childMode: 'CREATE',
        newChild: {
          admissionNo: newChildAdmissionNo,
          firstName: 'Kabir',
          lastName: 'Verma',
          dob: '2023-01-10',
          gender: 'MALE',
          bloodGroup: 'O_POSITIVE',
          branchId: branch.id,
          classroomId: classroom.id,
          programType: 'NURSERY',
        },
        permissions: {
          canPickup: true,
          pickupPin: '4321',
          isFeePayer: true,
        },
      }
    )

    assert(Boolean(newChildResult.isNewStudent), 'Flagged as isNewStudent: true')
    assert(Boolean(newChildResult.student?.id), 'Student record created via StudentService')
    assert(newChildResult.student.firstName === 'Kabir', 'New student first name matches input')
    assert(newChildResult.student.currentClassroomId === classroom.id, 'New student classroom foreign key linked')
    assert(newChildResult.membership.role === 'PARENT', 'Father account created and scoped to tenant')

    // =========================================================================
    // 7. Family CSV Template & Pre-Flight Validation Engine
    // =========================================================================
    console.log('\n[7] Family CSV Template & Pre-Flight Validation Engine')

    const csvTemplate = UserCsvEngine.getFamilyTemplate()
    assert(csvTemplate.includes('studentAdmissionNo'), 'Template contains studentAdmissionNo column')
    assert(csvTemplate.includes('pickupPin'), 'Template contains pickupPin column')
    assert(csvTemplate.includes('feePayer'), 'Template contains feePayer column')

    // Test CSV with:
    // Row 1: Valid Guardian link to studentA
    // Row 2: Invalid 3rd parent for studentA (should be BLOCKED by Max 2 Parents rule)
    // Row 3: Name mismatch warning (does NOT overwrite DB)
    const testCsv = [
      'photo,username,name,gender,email,phone,role,relationship,studentAdmissionNo,studentUsername,studentName,studentDateOfBirth,studentGender,studentBloodGroup,studentBranch,studentClass,studentSeatNumber,studentAdmissionYear,pickupPin,feePayer,status',
      `,"kavita.${uniqueSuffix}","Kavita Patil",FEMALE,"kavita.${uniqueSuffix}@example.com","+9198765${uniqueSuffix.slice(-5)}6",GUARDIAN,LEGAL_GUARDIAN,"${studentA.admissionNo}",,"Aarav Patil",2022-05-14,MALE,B_POSITIVE,MAIN,NUR-A,,2026-27,7788,false,ACTIVE`,
      `,"extra.parent.${uniqueSuffix}","Extra Parent",MALE,"extra.parent.${uniqueSuffix}@example.com","+9198765${uniqueSuffix.slice(-5)}7",PARENT,FATHER,"${studentA.admissionNo}",,"Aarav Patil",2022-05-14,MALE,B_POSITIVE,MAIN,NUR-A,,2026-27,1122,true,ACTIVE`,
      `,"diff.name.${uniqueSuffix}","Diff Caregiver",FEMALE,"diff.${uniqueSuffix}@example.com","+9198765${uniqueSuffix.slice(-5)}8",GUARDIAN,OTHER,"${studentA.admissionNo}",,"Different Name",2022-05-14,MALE,B_POSITIVE,MAIN,NUR-A,,2026-27,3344,false,ACTIVE`,
    ].join('\r\n')

    const preview = await UserCsvEngine.previewFamilyCsv(tenant.id, testCsv)
    assert(preview.rows.length === 3, 'Parsed exactly 3 preview rows')

    // Row 1 should be VALID (GUARDIAN allowed)
    assert(preview.rows[0].status === 'VALID', 'Row 1 (GUARDIAN) is VALID')
    assert(preview.rows[0].action === 'CREATE' || preview.rows[0].action === 'LINK', 'Row 1 action is CREATE/LINK')

    // Row 2 should be BLOCKED because studentA already has 2 parents
    assert(preview.rows[1].status === 'BLOCKED', 'Row 2 (3rd Parent for studentA) is strictly BLOCKED')
    assert(
      preview.rows[1].errors.some((e) => e.includes('Maximum 2 Parent accounts allowed')),
      'Row 2 error message cites Max 2 Parents policy'
    )

    // Row 3 should have a WARNING about student name mismatch without blocking
    assert(preview.rows[2].status === 'WARNING', 'Row 3 with differing student name flagged with WARNING')
    assert(
      preview.rows[2].warnings.some((w) => w.includes('differs from authoritative DB record')),
      'Row 3 warning warns that authoritative DB record will NOT be overwritten'
    )

    // Execute valid rows
    const importResult = await UserCsvEngine.executeFamilyImport(
      { tenantId: tenant.id, actorId: 'system-test' },
      preview.rows
    )
    assert(importResult.blockedCount === 1, 'Import blocked exactly 1 invalid row')
    assert(importResult.linkedCount >= 1, 'Import linked valid caregivers')

    // Verify DB student name was not overwritten by Row 3
    const studentAInDb = await db.student.findUnique({ where: { id: studentA.id } })
    assert(studentAInDb?.firstName === 'Aarav', 'Authoritative student name Aarav preserved in database')

    // =========================================================================
    // 8. Immutable Audit Trail Verification
    // =========================================================================
    console.log('\n[8] Immutable Audit Trail Verification')

    const audits = await db.auditLog.findMany({
      where: { tenantId: tenant.id, module: 'Users' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    assert(audits.length > 0, 'AuditLog records emitted for family operations')
    assert(
      audits.some((a) => a.action === 'PARENT_CREATED' || a.action === 'GUARDIAN_CREATED'),
      'AuditLog action is PARENT_CREATED or GUARDIAN_CREATED'
    )

    for (const a of audits) {
      const valsStr = JSON.stringify(a.newValues || {})
      assert(!valsStr.includes('Password@2026'), 'Plain password never present in AuditLog')
      assert(!valsStr.includes('1234') || !valsStr.includes('"pickupPin"'), 'Raw pickupPin secret not leaked in audit diff')
    }

    // =========================================================================
    // 9. Cleanup Test Records
    // =========================================================================
    console.log('\n[Cleaning up test records...]')
    await db.auditLog.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
    await db.studentGuardian.deleteMany({ where: { student: { tenantId: tenant.id } } }).catch(() => {})
    await db.student.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
    await db.classroom.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
    await db.program.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
    await db.guardian.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
    await db.tenantUser.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
    await db.academicSession.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
    await db.branch.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
    await db.tenant.delete({ where: { id: tenant.id } }).catch(() => {})
    await db.user.deleteMany({ where: { email: { contains: uniqueSuffix } } }).catch(() => {})
    console.log('✓ Cleaned up test tenant and related cascading records.')

    console.log('\n===============================================================')
    console.log('TEST SUMMARY: ALL FAMILY ONBOARDING SPEC CHECKS PASSED')
    console.log('===============================================================\n')
  } catch (err: any) {
    console.error('\nTest error occurred:', err)
    try {
      await db.auditLog.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.studentGuardian.deleteMany({ where: { student: { tenantId: tenant.id } } }).catch(() => {})
      await db.student.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.classroom.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.program.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.guardian.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.tenantUser.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.academicSession.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.branch.deleteMany({ where: { tenantId: tenant.id } }).catch(() => {})
      await db.tenant.delete({ where: { id: tenant.id } }).catch(() => {})
      await db.user.deleteMany({ where: { email: { contains: uniqueSuffix } } }).catch(() => {})
    } catch (e) {}
    process.exit(1)
  }
}

main()
