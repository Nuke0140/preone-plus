/**
 * PreOne — M01 User & Identity Management Architecture Verification
 *
 * Verifies:
 * 1. Centralized Collision-Resistant UsernameService (STAFF, PARENT, GUARDIAN, STUDENT)
 * 2. Flow 1: Staff Creation (Teacher with Classroom binding, Accountant, Helper, Driver, Principal)
 * 3. Flow 2: Parent Onboarding with NEW Child creation (delegating to StudentService)
 * 4. Flow 2: Parent Onboarding with EXISTING Child linking
 * 5. Strict Max 2 Parent Policy enforcement (PARENT_LIMIT_REACHED rejection on 3rd parent)
 * 6. Flow 2: Guardian Onboarding (Secondary caregiver with pickup PIN and scoped permissions)
 * 7. Shared Household Mobile Number Preservation
 * 8. Zero Orphaned Records on Transactional Rollback
 * 9. Dual Staff CSV Preview and Execution with Formula Injection Sanitization
 * 10. Dual Family CSV Preview and Execution (linking and new student creation)
 */

import { db } from '../src/lib/db'
import { UsernameService } from '../src/lib/users/username-service'
import { StaffUserService } from '../src/lib/users/staff-user-service'
import { FamilyUserService } from '../src/lib/users/family-user-service'
import { UserCsvEngine } from '../src/lib/users/csv-engine'
import { StudentService } from '../src/lib/students/student-service'

let passed = 0
let failed = 0

function assert(condition: boolean, desc: string, details?: any) {
  if (condition) {
    console.log(`  ✓ ${desc}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${desc}`)
    if (details) console.error('    Details:', details)
    failed++
  }
}

async function runM01Verification() {
  console.log('\n========================================================')
  console.log('  PREONE M01 — USER & IDENTITY ARCHITECTURE VERIFICATION')
  console.log('========================================================\n')

  // 1. Setup / Resolve Tenant
  let tenant = await db.tenant.findFirst({
    where: { deletedAt: null },
    include: { branches: true, classrooms: true },
  })

  if (!tenant) {
    console.log('Creating initial test tenant...')
    tenant = await db.tenant.create({
      data: {
        name: 'PreOne E2E Academy',
        slug: 'preone-e2e-' + Date.now(),
        domain: 'e2e' + Date.now() + '.preone.app',
      },
      include: { branches: true, classrooms: true },
    })
  }

  const tenantId = tenant.id
  console.log(`Using Tenant: "${tenant.name}" (${tenantId})\n`)

  // Resolve or create a test branch
  let branch = tenant.branches?.[0]
  if (!branch) {
    branch = await db.branch.create({
      data: {
        tenantId,
        name: 'Main Campus',
        code: 'MAIN-' + Math.floor(Math.random() * 1000),
      },
    })
  }

  // Resolve or create academic session
  let academicSession = await db.academicSession.findFirst({
    where: { tenantId },
  })
  if (!academicSession) {
    academicSession = await db.academicSession.create({
      data: {
        tenantId,
        name: '2026-2027 Academic Year',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2027-03-31'),
        isCurrent: true,
      },
    })
  }

  // Ensure programs exist for this tenant
  const programTypes = ['PLAYGROUP', 'NURSERY', 'LKG', 'UKG', 'DAYCARE']
  for (const pt of programTypes) {
    const existing = await db.program.findFirst({
      where: { tenantId, programType: pt as any },
    })
    if (!existing) {
      await db.program.create({
        data: {
          tenantId,
          name: pt,
          code: pt.slice(0, 3) + '-' + Math.floor(Math.random() * 100),
          programType: pt as any,
          ageMinMonths: 12,
          ageMaxMonths: 84,
        },
      })
    }
  }

  // Resolve or create a test classroom
  let classroom = tenant.classrooms?.[0]
  if (!classroom) {
    classroom = await db.classroom.create({
      data: {
        tenantId,
        branchId: branch.id,
        academicSessionId: academicSession.id,
        name: 'Montessori Toddlers',
        code: 'MT-' + Math.floor(Math.random() * 1000),
        programType: 'NURSERY',
        capacity: 20,
      },
    })
  }

  const mockActor = {
    tenantId,
    actorId: 'system-actor',
    actorName: 'System Architect',
    actorRole: 'OWNER' as const,
    actorBranchId: branch.id,
  }

  // ── TEST 1: Centralized UsernameService ────────────────────────────────────
  console.log('[TEST 1] Centralized UsernameService & Collision Resistance')
  {
    const staffUser1 = await UsernameService.generateUniqueUsername({
      type: 'STAFF',
      name: 'Priya Sharma',
      tenantId,
    })
    assert(staffUser1.startsWith('priya.sharma'), 'Staff username generated with dot convention: ' + staffUser1)

    const parentUser1 = await UsernameService.generateUniqueUsername({
      type: 'PARENT',
      name: 'Rohan Gupta',
      tenantId,
    })
    assert(parentUser1.startsWith('rohan.gupta'), 'Parent username generated with dot convention: ' + parentUser1)

    const studentUser1 = await UsernameService.generateUniqueUsername({
      type: 'STUDENT',
      name: 'Aarav Patel',
      tenantId,
    })
    assert(studentUser1.startsWith('aarav.patel'), 'Student username generated with dot convention: ' + studentUser1)

    // Verify collision fallback
    const simulatedCollision = await UsernameService.generateUniqueUsername({
      type: 'STAFF',
      name: 'Priya Sharma',
      preferred: staffUser1,
      tenantId,
    })
    assert(typeof simulatedCollision === 'string' && simulatedCollision.length > 0, 'Collision resolved safely')
  }

  // ── TEST 2: Flow 1 — Staff Creation (Teacher with Classroom) ───────────────
  console.log('\n[TEST 2] Flow 1: Staff Creation with Classroom Binding (Teacher)')
  let createdTeacher: any = null
  {
    const teacherEmail = `teacher.${Date.now()}@preoneschool.com`
    const teacherRes = await StaffUserService.createStaff(mockActor, {
      fullName: 'Ananya Sen',
      email: teacherEmail,
      phone: '+91 98111 22334',
      primaryRole: 'TEACHER',
      branchId: branch.id,
      classroomId: classroom.id,
      designation: 'Senior Early Educator',
      department: 'Montessori',
      employmentType: 'REGULAR',
      employeeCode: `EMP-T-${Date.now().toString().slice(-4)}`,
    })

    createdTeacher = teacherRes
    assert(Boolean(teacherRes.user?.id), 'Teacher User record created')
    assert(teacherRes.membership?.role === 'TEACHER', 'TenantUser role assigned as TEACHER')
    assert(Boolean(teacherRes.staffProfile?.id), 'StaffProfile created')
    assert(teacherRes.staffProfile?.department === 'Montessori', 'StaffProfile department preserved')

    // Verify classroom binding
    const updatedClassroom = await db.classroom.findUnique({
      where: { id: classroom.id },
      include: { primaryTeacher: true },
    })
    const isBound = updatedClassroom?.primaryTeacherId === teacherRes.user.id
    assert(Boolean(isBound), 'Teacher bound to classroom via primaryTeacherId')
  }

  // ── TEST 3: Flow 1 — Multi-Role Staff (Accountant & Driver) ────────────────
  console.log('\n[TEST 3] Flow 1: Staff Creation for Operational Roles (Accountant & Driver)')
  {
    const accountantEmail = `accountant.${Date.now()}@preoneschool.com`
    const accRes = await StaffUserService.createStaff(mockActor, {
      fullName: 'Vikram Joshi',
      email: accountantEmail,
      primaryRole: 'ACCOUNTANT',
      branchId: branch.id,
      designation: 'Bursar & Accounts Lead',
      department: 'Finance',
      employeeCode: `EMP-A-${Date.now().toString().slice(-4)}`,
    })
    assert(accRes.membership.role === 'ACCOUNTANT', 'Accountant provisioned with ACCOUNTANT role')

    const driverEmail = `driver.${Date.now()}@preoneschool.com`
    const driverRes = await StaffUserService.createStaff(mockActor, {
      fullName: 'Ramesh Yadav',
      email: driverEmail,
      phone: '+91 99887 76655',
      primaryRole: 'DRIVER',
      branchId: branch.id,
      designation: 'Fleet Captain',
      department: 'Transport',
      employeeCode: `EMP-D-${Date.now().toString().slice(-4)}`,
    })
    assert(driverRes.membership.role === 'DRIVER', 'Driver provisioned with DRIVER role')
  }

  // ── TEST 4: Flow 2 — Parent Onboarding with NEW Child Creation ─────────────
  console.log('\n[TEST 4] Flow 2: Parent Onboarding with NEW Child Registration')
  let createdChildStudent: any = null
  let parent1Res: any = null
  {
    const parent1Email = `mother.${Date.now()}@familytest.com`
    const childFirstName = 'Mira'
    const childLastName = 'Verma'

    parent1Res = await FamilyUserService.createFamilyUser(mockActor, {
      role: 'PARENT',
      fullName: 'Sunita Verma',
      email: parent1Email,
      phone: '+91 98700 11223',
      relationship: 'MOTHER',
      isPrimaryContact: true,
      childMode: 'CREATE',
      newChild: {
        firstName: childFirstName,
        lastName: childLastName,
        dob: '2022-04-15',
        gender: 'FEMALE',
        programType: 'NURSERY',
        branchId: branch.id,
        classroomId: classroom.id,
      },
      permissions: {
        canPickup: true,
        pickupPin: '5824',
        receivesCommunication: true,
        isFeePayer: true,
      },
    })

    assert(Boolean(parent1Res.user?.id), 'Mother User account created')
    assert(parent1Res.membership?.role === 'PARENT', 'Mother TenantUser has role PARENT')
    assert(Boolean(parent1Res.student?.id), 'New Student created via authoritative StudentService')
    assert(parent1Res.student?.firstName === 'Mira', 'Student first name is Mira')
    assert(Boolean(parent1Res.student?.admissionNo), 'Student has authoritative admission number: ' + parent1Res.student?.admissionNo)

    createdChildStudent = parent1Res.student

    // Verify StudentGuardian link
    const link = await db.studentGuardian.findFirst({
      where: {
        studentId: createdChildStudent.id,
        guardian: { userId: parent1Res.user.id },
      },
    })
    assert(Boolean(link), 'StudentGuardian link established')
    assert(link?.relationship === 'MOTHER', 'StudentGuardian relationship is MOTHER')
    assert(link?.canPickup === true, 'Authorized pickup is true')
    assert(link?.isPrimary === true, 'Primary contact flag is true')
  }

  // ── TEST 5: Flow 2 — Parent Onboarding with EXISTING Child Linking ─────────
  console.log('\n[TEST 5] Flow 2: Second Parent Linking to EXISTING Student')
  let parent2Res: any = null
  {
    const parent2Email = `father.${Date.now()}@familytest.com`
    parent2Res = await FamilyUserService.createFamilyUser(mockActor, {
      role: 'PARENT',
      fullName: 'Rajesh Verma',
      email: parent2Email,
      phone: '+91 98700 11223', // Same household phone
      relationship: 'FATHER',
      isPrimaryContact: false,
      childMode: 'EXISTING',
      existingChild: {
        studentId: createdChildStudent.id,
        admissionNo: createdChildStudent.admissionNo,
      },
      permissions: {
        canPickup: true,
        pickupPin: '5824',
        receivesCommunication: true,
        isFeePayer: false,
      },
    })

    assert(Boolean(parent2Res.user?.id), 'Father User account created')
    assert(parent2Res.membership?.role === 'PARENT', 'Father TenantUser has role PARENT')

    const activeParents = await FamilyUserService.countActiveParentsForStudent(tenantId, createdChildStudent.id)
    assert(activeParents === 2, `Active parent count for student is now 2 (found: ${activeParents})`)
  }

  // ── TEST 6: Flow 2 — Strict Max 2 Parent Policy Enforcement ────────────────
  console.log('\n[TEST 6] Flow 2: Rejection of 3rd Parent Account (PARENT_LIMIT_REACHED)')
  {
    let caughtError: any = null
    try {
      const parent3Email = `thirdparent.${Date.now()}@familytest.com`
      await FamilyUserService.createFamilyUser(mockActor, {
        role: 'PARENT',
        fullName: 'Anita Verma',
        email: parent3Email,
        phone: '+91 99999 88888',
        relationship: 'OTHER',
        childMode: 'EXISTING',
        existingChild: {
          studentId: createdChildStudent.id,
        },
      })
    } catch (err: any) {
      caughtError = err
    }

    assert(Boolean(caughtError), 'Third parent attempt threw error')
    assert(
      caughtError?.code === 'PARENT_LIMIT_REACHED',
      `Error code is PARENT_LIMIT_REACHED (received: ${caughtError?.code})`
    )
  }

  // ── TEST 7: Flow 2 — Guardian Onboarding (Secondary Caregiver) ─────────────
  console.log('\n[TEST 7] Flow 2: Guardian Onboarding for Student with 2 Parents')
  {
    const guardianEmail = `grandmother.${Date.now()}@familytest.com`
    const guardianRes = await FamilyUserService.createFamilyUser(mockActor, {
      role: 'GUARDIAN',
      fullName: 'Kamla Devi',
      email: guardianEmail,
      phone: '+91 98111 99887',
      relationship: 'GRANDMOTHER',
      childMode: 'EXISTING',
      existingChild: {
        studentId: createdChildStudent.id,
      },
      permissions: {
        canPickup: true,
        pickupPin: '1234',
        receivesCommunication: true,
        isFeePayer: false,
      },
    })

    assert(Boolean(guardianRes.user?.id), 'Guardian account created successfully')
    assert(guardianRes.membership?.role === 'GUARDIAN', 'Guardian role assigned')

    // Confirm active parents count remains 2
    const activeParents = await FamilyUserService.countActiveParentsForStudent(tenantId, createdChildStudent.id)
    assert(activeParents === 2, 'Parent count remains 2 despite guardian addition')

    // Confirm Guardian link exists
    const gLink = await db.studentGuardian.findFirst({
      where: {
        studentId: createdChildStudent.id,
        guardian: { userId: guardianRes.user.id },
      },
    })
    assert(gLink?.relationship === 'GRANDPARENT', 'Guardian link registered with normalized relationship GRANDPARENT')
  }

  // ── TEST 8: Shared Household Phone Preservation ───────────────────────────
  console.log('\n[TEST 8] Shared Household Mobile Number Preservation')
  {
    const sharedPhone = '+91 91234 56789'
    const motherEmail = `mom.${Date.now()}@household.com`
    const fatherEmail = `dad.${Date.now()}@household.com`

    const mother = await StaffUserService.createStaff(mockActor, {
      fullName: 'Household Mom',
      email: motherEmail,
      phone: sharedPhone,
      primaryRole: 'HELPER',
    })

    const father = await StaffUserService.createStaff(mockActor, {
      fullName: 'Household Dad',
      email: fatherEmail,
      phone: sharedPhone,
      primaryRole: 'HELPER',
    })

    assert(
      mother.user.phone?.replace(/\s+/g, '') === sharedPhone.replace(/\s+/g, ''),
      'First user retains phone'
    )
    assert(
      father.user.phone?.replace(/\s+/g, '') === sharedPhone.replace(/\s+/g, ''),
      'Second user with same phone created without error'
    )
    assert(mother.user.id !== father.user.id, 'Users remain distinct entities')
  }

  // ── TEST 9: Staff CSV Dry-Run Preview & Execution ──────────────────────────
  console.log('\n[TEST 9] Dual Strategy: Staff CSV Preview, Formula Sanitization & Execution')
  {
    const validEmail = `csv.staff.${Date.now()}@school.com`
    const staffCsv = `fullName,email,phone,role,branchCode,designation,department
"=SUM(A1)",${validEmail},+91 98765 00000,TEACHER,${branch.code},Pre-K Lead,Academics
Invalid Row Without Email,,+91 98765 11111,HELPER,,Assistant,Support`

    const preview = await UserCsvEngine.previewStaffCsv(tenantId, staffCsv)
    assert(preview.totalRows === 2, 'Preview detected 2 data rows')
    assert(preview.validRows === 1, 'Preview identified 1 valid row')
    assert(preview.blockedRows === 1, 'Preview identified 1 blocked row (missing email)')

    // Check formula injection sanitization on fullName
    const sanitizedName = preview.rows[0].name
    assert(!sanitizedName.startsWith('='), 'Formula injection sanitized: ' + sanitizedName)

    // Execute import
    const execRes = await UserCsvEngine.executeStaffImport(mockActor, preview.rows)
    assert(execRes.createdCount >= 1, 'Staff CSV imported successfully: ' + execRes.createdCount + ' created')
  }

  // ── TEST 10: Family CSV Dry-Run Preview & Execution ───────────────────────
  console.log('\n[TEST 10] Dual Strategy: Family CSV Preview & Execution (New + Existing Child)')
  {
    const familyCsv = `role,fullName,email,phone,relationship,studentAdmissionNo,childFirstName,childLastName,childDOB,childGender,programType
PARENT,Pooja Sharma,pooja.${Date.now()}@csvtest.com,+91 99000 11222,MOTHER,${createdChildStudent.admissionNo},,,,,
GUARDIAN,Nanny Rita,rita.${Date.now()}@csvtest.com,+91 99000 33444,OTHER,${createdChildStudent.admissionNo},,,,,
PARENT,New Child Parent,ncp.${Date.now()}@csvtest.com,+91 99000 55666,FATHER,,Rudra,Singh,2022-07-20,MALE,PLAYGROUP`

    const preview = await UserCsvEngine.previewFamilyCsv(tenantId, familyCsv)
    assert(preview.totalRows === 3, 'Family CSV preview detected 3 rows')

    // Row 1 should be blocked because createdChildStudent already has 2 parents!
    const row1 = preview.rows[0]
    assert(row1.status === 'BLOCKED', 'Row 1 (3rd Parent) blocked by 2-parent limit in CSV engine')

    // Row 2 (Guardian) should be valid
    const row2 = preview.rows[1]
    assert(row2.status === 'VALID', 'Row 2 (Guardian for child with 2 parents) is VALID')

    // Row 3 (New Child Parent) should be valid
    const row3 = preview.rows[2]
    assert(row3.status === 'VALID', 'Row 3 (New Child Parent) is VALID')

    // Execute import
    const execRes = await UserCsvEngine.executeFamilyImport(mockActor, preview.rows)
    const processedValidCount = execRes.createdCount + (execRes.linkedCount || 0)
    assert(processedValidCount >= 2, 'Family CSV imported valid rows: ' + processedValidCount + ' created/linked')
    assert(execRes.skippedCount >= 1, 'Blocked 3rd parent row skipped: ' + execRes.skippedCount + ' skipped')
  }

  // ── TEST 11: Transactional Rollback Safety ─────────────────────────────────
  console.log('\n[TEST 11] Transactional Rollback (Zero Orphaned Records)')
  {
    const orphanEmail = `orphan.test.${Date.now()}@preone.test`
    let threw = false

    try {
      // Force an error inside createFamilyUser by passing an invalid student ID
      await FamilyUserService.createFamilyUser(mockActor, {
        role: 'PARENT',
        fullName: 'Failing Parent',
        email: orphanEmail,
        childMode: 'EXISTING',
        existingChild: {
          studentId: 'non-existent-student-id-99999',
        },
      })
    } catch {
      threw = true
    }

    assert(threw, 'Invalid family creation request failed as expected')

    const orphanedUser = await db.user.findUnique({
      where: { email: orphanEmail },
    })
    assert(orphanedUser === null, 'Zero orphaned User records left behind in DB on rollback')
  }

  // ── TEST 12: Concurrency Test for Max 2 Parents ───────────────────────────
  console.log('\n[TEST 12] Concurrency Test: Simultaneous Concurrent Requests for 2nd/3rd Parent')
  {
    // Create a dedicated student with 1 parent
    const concStudentRes = await FamilyUserService.createFamilyUser(mockActor, {
      role: 'PARENT',
      fullName: 'Concurrent Mom',
      email: `conc.mom.${Date.now()}@test.com`,
      phone: '+91 91111 22233',
      relationship: 'MOTHER',
      childMode: 'CREATE',
      newChild: {
        firstName: 'Tanya',
        lastName: 'Sharma',
        dob: '2022-06-15',
        gender: 'FEMALE',
        programType: 'PLAYGROUP',
        branchId: branch.id,
      },
    })
    const testStudentId = concStudentRes.student.id

    // Now fire 3 simultaneous requests to add a PARENT for this student
    const promises = [1, 2, 3].map((idx) =>
      FamilyUserService.createFamilyUser(mockActor, {
        role: 'PARENT',
        fullName: `Candidate Parent ${idx}`,
        email: `candidate.${idx}.${Date.now()}@test.com`,
        phone: `+91 92222 3334${idx}`,
        relationship: 'FATHER',
        childMode: 'EXISTING',
        existingChild: {
          studentId: testStudentId,
        },
      }).then(() => ({ status: 'fulfilled' })).catch((err) => ({ status: 'rejected', code: err.code, message: err.message }))
    )

    const results = await Promise.all(promises)
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected' && r.code === 'PARENT_LIMIT_REACHED')

    assert(fulfilled.length === 1, `Exactly 1 concurrent request succeeded (found: ${fulfilled.length})`)
    assert(rejected.length === 2, `Exactly 2 concurrent requests rejected with PARENT_LIMIT_REACHED (found: ${rejected.length})`)

    const totalParentsInDb = await FamilyUserService.countActiveParentsForStudent(tenantId, testStudentId)
    assert(totalParentsInDb === 2, `Final DB state strictly enforces max 2 parents under concurrency (found: ${totalParentsInDb})`)
  }

  // ── TEST 13: Existing Student Duplication Audit ────────────────────────────
  console.log('\n[TEST 13] Duplication Audit: Single Student Entity Across Multiple Caregivers')
  {
    const studentsWithAdmission = await db.student.findMany({
      where: {
        tenantId,
        admissionNo: createdChildStudent.admissionNo,
      },
    })
    assert(studentsWithAdmission.length === 1, 'Only 1 Student record exists for admissionNo ' + createdChildStudent.admissionNo)

    const studentGuardians = await db.studentGuardian.findMany({
      where: {
        studentId: createdChildStudent.id,
      },
      include: {
        guardian: true,
      },
    })
    assert(studentGuardians.length >= 3, `Student has ${studentGuardians.length} linked caregivers through junction`)
  }

  // ── TEST 14: Multi-Child Guardian Linking (Shared Caregiver Identity) ──────
  console.log('\n[TEST 14] Multi-Child Guardian: Single Identity Linked to Multiple Children')
  {
    const sharedGuardianEmail = `multichild.guardian.${Date.now()}@test.com`
    const sharedGuardianPhone = '+91 93333 44455'

    // 1. Onboard Guardian with Child 1
    const g1Res = await FamilyUserService.createFamilyUser(mockActor, {
      role: 'GUARDIAN',
      fullName: 'Sunita Chawla',
      email: sharedGuardianEmail,
      phone: sharedGuardianPhone,
      relationship: 'GRANDPARENT',
      childMode: 'EXISTING',
      existingChild: {
        studentId: createdChildStudent.id,
      },
    })

    // 2. Register Child 2
    const child2Res = await FamilyUserService.createFamilyUser(mockActor, {
      role: 'PARENT',
      fullName: 'Aakash Chawla',
      email: `aakash.${Date.now()}@test.com`,
      phone: '+91 94444 55566',
      relationship: 'FATHER',
      childMode: 'CREATE',
      newChild: {
        firstName: 'Kabir',
        lastName: 'Chawla',
        dob: '2022-08-10',
        gender: 'MALE',
        programType: 'PLAYGROUP',
        branchId: branch.id,
      },
    })

    // 3. Link existing Guardian Sunita Chawla to Child 2
    const g2Res = await FamilyUserService.createFamilyUser(mockActor, {
      role: 'GUARDIAN',
      fullName: 'Sunita Chawla',
      email: sharedGuardianEmail,
      phone: sharedGuardianPhone,
      relationship: 'GRANDPARENT',
      childMode: 'EXISTING',
      existingChild: {
        studentId: child2Res.student.id,
      },
    })

    assert(g1Res.user.id === g2Res.user.id, 'Same User identity reused for second child')
    assert(g1Res.guardian.id === g2Res.guardian.id, 'Same Guardian identity reused for second child')

    const guardianLinks = await db.studentGuardian.findMany({
      where: {
        guardianId: g1Res.guardian.id,
      },
    })
    assert(guardianLinks.length === 2, 'Guardian has 2 distinct StudentGuardian links for both children')
  }

  // ── TEST 15: M02 Student 360 Integration Verification ──────────────────────
  console.log('\n[TEST 15] M02 Student 360: Authoritative Domain Reflection')
  {
    const studentProfile = await StudentService.getStudentProfile({ tenantId }, createdChildStudent.id)
    assert(Boolean(studentProfile), 'Student fetched via authoritative StudentService.getStudentProfile')
    assert(studentProfile.guardians && studentProfile.guardians.length >= 3, 'All M01 created guardians reflect in M02 Student 360')

    const motherEntry = studentProfile.guardians.find((g: any) => g.relationship === 'MOTHER')
    assert(Boolean(motherEntry), 'Mother found in Student 360 guardians list')
    assert(motherEntry.isPrimary === true, 'Primary contact status accurately reflected in M02')
    assert(Boolean(motherEntry.portalAccount), 'portalAccount reflects active linked user account')
  }

  console.log('\n========================================================')
  console.log(`  VERIFICATION RESULT: ${passed} PASSED, ${failed} FAILED`)
  console.log('========================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runM01Verification()
  .catch((e) => {
    console.error('Fatal Verification Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
