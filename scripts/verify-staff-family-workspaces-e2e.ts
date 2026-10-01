import { db } from '../src/lib/db'
import { UserCsvEngine } from '../src/lib/users/csv-engine'
import { FamilyUserService } from '../src/lib/users/family-user-service'
import { StaffUserService } from '../src/lib/users/staff-user-service'
import { signJwt } from '../src/lib/auth-server'

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${msg}`)
    throw new Error(`Assertion failed: ${msg}`)
  }
  console.log(`  ✓ ${msg}`)
}

async function main() {
  console.log('\n===============================================================')
  console.log('VERIFY STAFF & FAMILY WORKSPACES + MULTI-CHILD CSV E2E')
  console.log('===============================================================\n')

  const testSuffix = `wk_${Date.now()}`
  let tenant: any = null
  let branch: any = null
  let student1: any = null
  let student2: any = null

  try {
    // 1. Setup Tenant, Branch, and 2 Students
    console.log('Step 1: Setting up isolated test tenant and students...')
    tenant = await db.tenant.create({
      data: {
        name: `Workspace Test School ${testSuffix}`,
        code: `WK${Date.now().toString().slice(-6)}`,
        status: 'ACTIVE',
      },
    })

    branch = await db.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'Main Campus',
        code: `MAIN`,
        isMain: true,
      },
    })

    const adm1 = `ADM-${Date.now().toString().slice(-4)}-A`
    const adm2 = `ADM-${Date.now().toString().slice(-4)}-B`

    student1 = await db.student.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        admissionNo: adm1,
        firstName: 'Aarav',
        lastName: 'Sharma',
        dob: new Date('2022-01-15'),
        gender: 'MALE',
        status: 'ACTIVE',
      },
    })

    student2 = await db.student.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        admissionNo: adm2,
        firstName: 'Ananya',
        lastName: 'Sharma',
        dob: new Date('2023-04-10'),
        gender: 'FEMALE',
        status: 'ACTIVE',
      },
    })

    assert(Boolean(student1 && student2), `Created 2 test students: ${adm1} and ${adm2}`)

    // 2. Create Staff Users
    console.log('\nStep 2: Creating staff users with canonical roles...')
    const teacher = await StaffUserService.createStaff(
      { tenantId: tenant.id, actorRole: 'OWNER' },
      {
        fullName: 'Teacher Sneha',
        email: `sneha_${testSuffix}@school.test`,
        username: `sneha_${testSuffix}`,
        role: 'TEACHER',
        primaryRole: 'TEACHER',
        branchId: branch.id,
        employeeCode: `EMP-TCH-${testSuffix}`,
        designation: 'Montessori Educator',
        department: 'Academics',
      }
    )
    assert(teacher.membership.role === 'TEACHER', 'Teacher created with canonical role TEACHER')

    const helper = await StaffUserService.createStaff(
      { tenantId: tenant.id, actorRole: 'OWNER' },
      {
        fullName: 'Helper Ramesh',
        email: `ramesh_${testSuffix}@school.test`,
        username: `ramesh_${testSuffix}`,
        role: 'HELPER',
        primaryRole: 'HELPER',
        branchId: branch.id,
        employeeCode: `EMP-HLP-${testSuffix}`,
        designation: 'Class Assistant',
        department: 'Operations',
      }
    )
    assert(helper.membership.role === 'HELPER', 'Helper created with canonical role HELPER')

    // 3. Multi-Child Family CSV Preview
    console.log('\nStep 3: Validating Multi-Child Family CSV Preview...')
    const multiChildCsv = [
      'username,fullName,email,phone,role,branchCode,studentAdmissionNo,relationship,canPickup,receivesComm,pickupPin',
      `rahul_${testSuffix},Rahul Sharma,rahul_${testSuffix}@family.test,+919876500001,PARENT,MAIN,${adm1},FATHER,true,true,1234`,
      `rahul_${testSuffix},Rahul Sharma,rahul_${testSuffix}@family.test,+919876500001,PARENT,MAIN,${adm2},FATHER,true,true,1234`,
    ].join('\n')

    const preview = await UserCsvEngine.previewFamilyCsv(tenant.id, multiChildCsv)

    assert(preview.totalRows === 2, `Preview parsed exactly 2 rows (got ${preview.totalRows})`)
    assert(preview.blockedRows === 0, `No blocked rows in multi-child CSV (got ${preview.blockedRows})`)
    assert(preview.rows[0].status === 'VALID', 'Row 1 status is VALID')
    assert(preview.rows[0].action === 'CREATE', 'Row 1 action is CREATE')
    assert(preview.rows[0].details.includes(`CREATE USER + LINK CHILD (${adm1})`), `Row 1 details: ${preview.rows[0].details}`)
    assert(preview.rows[1].status === 'VALID', 'Row 2 status is VALID')
    assert(preview.rows[1].action === 'LINK', 'Row 2 action is LINK (recognized existing user)')
    assert(preview.rows[1].details.includes(`LINK EXISTING USER + LINK CHILD (${adm2})`), `Row 2 details: ${preview.rows[1].details}`)

    // 4. Multi-Child Family CSV Execute
    console.log('\nStep 4: Executing Multi-Child CSV Import...')
    const importResult = await UserCsvEngine.executeFamilyImport(
      { tenantId: tenant.id, actorRole: 'OWNER' },
      preview.rows
    )

    assert(importResult.blockedCount === 0, 'Zero rows blocked during multi-child import')
    assert(importResult.createdCount + importResult.linkedCount === 2, `Processed 2 student links (got ${importResult.createdCount + importResult.linkedCount})`)

    // Verify User Uniqueness in DB
    const parentUsers = await db.user.findMany({
      where: { email: `rahul_${testSuffix}@family.test` },
    })
    assert(parentUsers.length === 1, `Exactly 1 User identity record created for multi-child parent (got ${parentUsers.length})`)

    const parentId = parentUsers[0].id
    const links = await db.studentGuardian.findMany({
      where: {
        guardian: { userId: parentId },
      },
    })
    assert(links.length === 2, `Exactly 2 StudentGuardian relationship links created for parent (got ${links.length})`)

    // 5. Max 2 Parents Rule in CSV Preview
    console.log('\nStep 5: Testing Max 2 Parents rule enforcement in CSV Preview...')
    // Student 1 now has 1 parent (Rahul).
    // Let's create a CSV that has Mother (Priya) -> valid (becomes parent #2).
    // And another row that has Step-Parent (Vikram) as PARENT for Student 1 -> MUST BE BLOCKED!
    const overflowCsv = [
      'username,fullName,email,phone,role,branchCode,studentAdmissionNo,relationship,canPickup,receivesComm,pickupPin',
      `priya_${testSuffix},Priya Sharma,priya_${testSuffix}@family.test,+919876500002,PARENT,MAIN,${adm1},MOTHER,true,true,5678`,
      `vikram_${testSuffix},Vikram Sharma,vikram_${testSuffix}@family.test,+919876500003,PARENT,MAIN,${adm1},FATHER,true,true,9999`,
      `sunita_${testSuffix},Sunita Dadi,sunita_${testSuffix}@family.test,+919876500004,GUARDIAN,MAIN,${adm1},GRANDPARENT,true,true,4321`,
    ].join('\n')

    const overflowPreview = await UserCsvEngine.previewFamilyCsv(tenant.id, overflowCsv)

    assert(overflowPreview.rows[0].status === 'VALID', 'Row 1 (Mother - parent #2) is VALID')
    assert(overflowPreview.rows[1].status === 'BLOCKED', 'Row 2 (3rd Parent) is BLOCKED')
    assert(
      overflowPreview.rows[1].errors.some((e) => e.includes('already has 2 registered Parent accounts')),
      `Row 2 blocked with max parents error: ${overflowPreview.rows[1].errors.join('; ')}`
    )
    assert(overflowPreview.rows[2].status === 'VALID', 'Row 3 (GUARDIAN) is VALID despite 2 existing parents (unlimited guardians)')

    // 6. Template Content Validation
    console.log('\nStep 6: Verifying official CSV templates...')
    const staffTemplate = UserCsvEngine.getStaffTemplate()
    assert(staffTemplate.includes('username') && staffTemplate.includes('employeeCode') && staffTemplate.includes('designation'), 'Staff template has username, employeeCode, and designation')

    const parentTemplate = UserCsvEngine.getParentTemplate()
    assert(parentTemplate.includes('studentAdmissionNo') && parentTemplate.includes('pickupPin') && parentTemplate.includes('canPickup'), 'Parent template has studentAdmissionNo, pickupPin, and canPickup')

    const familyTemplate = UserCsvEngine.getFamilyTemplate()
    assert(familyTemplate.includes('role') && familyTemplate.includes('relationship') && familyTemplate.includes('receivesComm'), 'Family template has role, relationship, and receivesComm')

    console.log('\n===============================================================')
    console.log('ALL WORKSPACE AND MULTI-CHILD CSV TESTS PASSED!')
    console.log('===============================================================\n')
  } finally {
    // Cleanup test tenant
    if (tenant) {
      console.log('Cleaning up test tenant artifacts...')
      await db.studentGuardian.deleteMany({ where: { student: { tenantId: tenant.id } } })
      await db.guardian.deleteMany({ where: { tenantId: tenant.id } })
      await db.student.deleteMany({ where: { tenantId: tenant.id } })
      await db.staffProfile.deleteMany({ where: { tenantId: tenant.id } })
      await db.tenantUser.deleteMany({ where: { tenantId: tenant.id } })
      await db.branch.deleteMany({ where: { tenantId: tenant.id } })
      await db.tenant.delete({ where: { id: tenant.id } })
    }
  }
}

main().catch((err) => {
  console.error('Test script crashed:', err)
  process.exit(1)
})
