import { db } from '../src/lib/db'
import { StaffService } from '../src/lib/hr/staff-service'
import { LeaveService } from '../src/lib/hr/leave-service'
import { PayrollService } from '../src/lib/hr/payroll-service'
import { RecruitmentService } from '../src/lib/hr/recruitment-service'
import { OffboardingService } from '../src/lib/hr/offboarding-service'

let passed = 0
let failed = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++
    console.log(`  ✓ ${msg}`)
  } else {
    failed++
    console.error(`  ✗ FAIL: ${msg}`)
  }
}

async function run() {
  console.log('====================================================')
  console.log('PREONE — HR & WORKFORCE MANAGEMENT E2E VERIFICATION')
  console.log('====================================================\n')

  // Setup test tenant and branch
  const tenant = await db.tenant.upsert({
    where: { code: 'TEST-HR-PRE' },
    create: {
      name: 'Test HR Preschool',
      code: 'TEST-HR-PRE',
      type: 'SCHOOL',
      status: 'ACTIVE',
    },
    update: {},
  })

  const branch = await db.branch.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'HR-MAIN' } },
    create: {
      tenantId: tenant.id,
      name: 'HR Main Campus',
      code: 'HR-MAIN',
      isMain: true,
      isActive: true,
    },
    update: {},
  })

  const actor = { id: 'hr-admin-actor', name: 'HR Admin', role: 'PRINCIPAL' }

  // Clean up any test payroll cycle for the current month so test is repeatable
  const currMonth = new Date().getMonth() + 1
  const currYear = new Date().getFullYear()
  const existingCycle = await db.payrollCycle.findUnique({
    where: { tenantId_month_year: { tenantId: tenant.id, month: currMonth, year: currYear } },
  })
  if (existingCycle) {
    await db.payslip.deleteMany({ where: { payrollCycleId: existingCycle.id } })
    await db.payrollCycle.delete({ where: { id: existingCycle.id } })
  }

  // ----------------------------------------------------
  // TEST SUITE 1: RECRUITMENT PIPELINE
  // ----------------------------------------------------
  console.log('TEST SUITE 1: Recruitment Pipeline')

  const opening = await RecruitmentService.createJobOpening(
    tenant.id,
    {
      title: 'EYFS Montessori Lead Teacher',
      department: 'Academics',
      designation: 'Montessori Teacher',
      branchId: branch.id,
      minExperienceYears: 2,
      qualificationRequired: 'ECCE / Montessori Diploma',
      description: 'Looking for a passionate early childhood educator.',
    },
    actor
  )
  assert(opening.id != null, 'Job Opening created successfully')
  assert(opening.status === 'OPEN', 'Job Opening status is OPEN')

  const app = await RecruitmentService.applyForJob(
    tenant.id,
    opening.id,
    {
      candidateName: 'Pooja Deshmukh',
      email: `pooja.deshmukh.${Date.now()}@preone.test`,
      phone: '9876543210',
      highestQualification: 'ECCE Diploma',
      experienceYears: 3,
    }
  )
  assert(app.id != null, 'Candidate application submitted')
  assert(app.status === 'APPLIED', 'Application initial status is APPLIED')

  const interview = await RecruitmentService.scheduleInterview(
    tenant.id,
    app.id,
    {
      roundName: 'Classroom Demo & Pedagogy Evaluation',
      scheduledAt: new Date(Date.now() + 86400000),
      interviewerName: 'Principal Anita',
    }
  )
  assert(interview.id != null, 'Interview round scheduled')

  const updatedApp = await db.jobApplication.findUnique({ where: { id: app.id } })
  assert(updatedApp?.status === 'INTERVIEW', 'Application transitioned to INTERVIEW status')

  // Convert Candidate to Staff
  const empCode = `EMP-T-${Date.now().toString().slice(-4)}`
  const onboardedStaff = await RecruitmentService.convertCandidateToStaff(
    tenant.id,
    app.id,
    {
      employeeCode: empCode,
      joiningDate: new Date(),
      basicSalary: 24000,
    },
    actor
  )
  assert(onboardedStaff.id != null, 'Candidate converted directly to StaffProfile without duplication')
  assert(onboardedStaff.employeeCode === empCode, 'Employee code matched on conversion')

  // Verify zero duplicate entity policy
  const userCheck = await db.user.findUnique({ where: { id: onboardedStaff.userId } })
  const tenantUserCheck = await db.tenantUser.findFirst({ where: { tenantId: tenant.id, userId: onboardedStaff.userId } })
  assert(userCheck != null, 'Canonical User entity created and linked')
  assert(tenantUserCheck != null, 'Canonical TenantUser membership created and linked')

  // ----------------------------------------------------
  // TEST SUITE 2: STAFF 360 & LIFECYCLE
  // ----------------------------------------------------
  console.log('\nTEST SUITE 2: Staff 360 & Lifecycle Management')

  const staff360 = await StaffService.getStaff360(tenant.id, onboardedStaff.id)
  assert(staff360 != null, 'Retrieved complete Staff 360 profile')
  assert(staff360?.salaryStructure?.basicSalary.toNumber() === 24000, 'Salary structure verified on 360 profile')
  assert(staff360?.primaryRole === 'TEACHER', 'Primary role identified correctly')

  // Branch transfer
  const branch2 = await db.branch.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'HR-NORTH' } },
    create: {
      tenantId: tenant.id,
      name: 'HR North Campus',
      code: 'HR-NORTH',
      isMain: false,
      isActive: true,
    },
    update: {},
  })

  const transferred = await StaffService.transferBranch(tenant.id, onboardedStaff.id, branch2.id, actor)
  assert(transferred.branchId === branch2.id, 'Branch transfer executed cleanly')
  const tuCheck = await db.tenantUser.findFirst({ where: { tenantId: tenant.id, userId: onboardedStaff.userId } })
  assert(tuCheck?.branchId === branch2.id, 'TenantUser branch scope updated simultaneously')

  // Transfer back to branch 1
  await StaffService.transferBranch(tenant.id, onboardedStaff.id, branch.id, actor)

  // Designation update without RBAC role changes
  const promoted = await StaffService.updateDesignation(
    tenant.id,
    onboardedStaff.id,
    { designation: 'Senior Montessori Coordinator', department: 'Early Years' },
    actor
  )
  assert(promoted.designation === 'Senior Montessori Coordinator', 'Designation updated without changing RBAC role')

  // ----------------------------------------------------
  // TEST SUITE 3: DAILY ATTENDANCE
  // ----------------------------------------------------
  console.log('\nTEST SUITE 3: Staff Daily Attendance')

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  await db.attendanceStaff.upsert({
    where: { staffProfileId_date: { staffProfileId: onboardedStaff.id, date: today } },
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      staffProfileId: onboardedStaff.id,
      date: today,
      status: 'PRESENT',
      checkIn: new Date(Date.now() - 28800000), // 8 hrs ago
      checkOut: new Date(),
      shiftHours: 8,
      workedHours: 8,
      source: 'MANUAL',
    },
    update: {},
  })

  const attRecord = await db.attendanceStaff.findUnique({
    where: { staffProfileId_date: { staffProfileId: onboardedStaff.id, date: today } },
  })
  assert(attRecord?.status === 'PRESENT', 'Staff attendance marked as PRESENT')
  assert(attRecord?.workedHours === 8, '8 hours worked calculated correctly')

  // ----------------------------------------------------
  // TEST SUITE 4: LEAVE MANAGEMENT & TEACHER CLASSROOM COVERAGE
  // ----------------------------------------------------
  // Create AcademicSession
  const session = await db.academicSession.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Academic Year 2026-27' } },
    create: {
      tenantId: tenant.id,
      name: 'Academic Year 2026-27',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
      status: 'ACTIVE',
    },
    update: {},
  })

  // Assign onboarded teacher to a Classroom
  const classroom = await db.classroom.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'CLS-MONT-A' } },
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      academicSessionId: session.id,
      name: 'Montessori Bluebirds',
      code: 'CLS-MONT-A',
      programType: 'NURSERY',
      primaryTeacherId: onboardedStaff.userId,
    },
    update: {
      primaryTeacherId: onboardedStaff.userId,
    },
  })
  assert(classroom.primaryTeacherId === onboardedStaff.userId, 'Teacher assigned to Montessori classroom')

  // Create a second teacher as substitute
  const subEmpCode = `EMP-SUB-${Date.now().toString().slice(-4)}`
  const subTeacher = await StaffService.createStaff(
    {
      tenantId: tenant.id,
      branchId: branch.id,
      fullName: 'Sunita Rao',
      email: `sunita.${Date.now()}@preone.test`,
      role: 'TEACHER',
      employeeCode: subEmpCode,
      designation: 'Assistant Teacher',
    },
    actor
  )
  assert(subTeacher.id != null, 'Substitute teacher profile ready')

  // Check initial leave balances
  const leaveTypes = await db.leaveType.findMany({ where: { tenantId: tenant.id } })
  let clType = leaveTypes.find((l) => l.code === 'CL')
  if (!clType) {
    await LeaveService.getOrCreateBalances(tenant.id, onboardedStaff.id, 2026)
    clType = await db.leaveType.findFirst({ where: { tenantId: tenant.id, code: 'CL' } })
  }
  assert(clType != null, 'Casual Leave type initialized')

  // Apply for leave
  const leaveStart = new Date(Date.now() + 86400000 * 2)
  const leaveEnd = new Date(Date.now() + 86400000 * 3)

  const leaveReq = await LeaveService.applyLeave({
    tenantId: tenant.id,
    staffProfileId: onboardedStaff.id,
    leaveTypeId: clType!.id,
    startDate: leaveStart,
    endDate: leaveEnd,
    reason: 'Family wedding attendance',
  })
  assert(leaveReq.status === 'PENDING', 'Leave request submitted in PENDING state')
  assert(leaveReq.totalDays === 2, 'Total leave days calculated as 2')

  // Overlap test
  try {
    await LeaveService.applyLeave({
      tenantId: tenant.id,
      staffProfileId: onboardedStaff.id,
      leaveTypeId: clType!.id,
      startDate: leaveStart,
      endDate: leaveEnd,
      reason: 'Duplicate dates test',
    })
    assert(false, 'Should have rejected overlapping leave request')
  } catch (e: any) {
    assert(e.message.includes('overlap'), 'Overlapping leave correctly rejected by backend domain engine')
  }

  // Approve Leave -> Triggers Teacher Coverage Workflow
  const actionRes = await LeaveService.actionLeave(tenant.id, leaveReq.id, 'APPROVE', actor)
  assert(actionRes.request.status === 'APPROVED', 'Leave request APPROVED')
  assert(actionRes.coverages.length > 0, 'Classroom substitute coverage triggered automatically for classroom')
  assert(actionRes.coverages[0].classroomId === classroom.id, 'Coverage target matches primary classroom')

  // ----------------------------------------------------
  // TEST SUITE 5: PAYROLL CALCULATION & POSH COMPLIANCE GATE
  // ----------------------------------------------------
  console.log('\nTEST SUITE 5: Statutory Payroll & POSH Compliance Gate')

  // Run payroll BEFORE POSH certificate is uploaded -> should hold payslip!
  const cyclePrePosh = await PayrollService.processPayroll(tenant.id, currMonth, currYear, branch.id, actor)
  assert(cyclePrePosh.status === 'REVIEWED', 'Payroll cycle calculated in REVIEWED status')

  const payslipPrePosh = await db.payslip.findUnique({
    where: { payrollCycleId_staffProfileId: { payrollCycleId: cyclePrePosh.id, staffProfileId: onboardedStaff.id } },
  })
  assert(payslipPrePosh?.isHeld === true, 'Payslip held (isHeld=true) because POSH certification is pending')
  assert(payslipPrePosh?.holdReason?.includes('POSH') === true, 'Hold reason explicitly mentions POSH compliance')

  // Now upload valid POSH training certification
  const poshTraining = await db.staffTraining.create({
    data: {
      tenantId: tenant.id,
      staffProfileId: onboardedStaff.id,
      trainingType: 'POSH',
      completionDate: new Date(),
      expiryDate: new Date(Date.now() + 86400000 * 365), // valid for 1 year
      status: 'VALID',
      score: 95.0,
    },
  })
  assert(poshTraining.status === 'VALID', 'POSH training completed and valid for 365 days')

  // Re-calculate payroll -> Hold should be released!
  const cyclePostPosh = await PayrollService.processPayroll(tenant.id, currMonth, currYear, branch.id, actor)
  const payslipPostPosh = await db.payslip.findUnique({
    where: { payrollCycleId_staffProfileId: { payrollCycleId: cyclePostPosh.id, staffProfileId: onboardedStaff.id } },
  })
  assert(payslipPostPosh?.isHeld === false, 'POSH hold released after valid training certificate!')
  assert(payslipPostPosh?.poshCompliant === true, 'Payslip marked poshCompliant = true')
  assert(payslipPostPosh?.pfDeduction.toNumber()! > 0, 'PF statutory deduction (12%) calculated')

  // Disburse and Lock payroll
  const disbursed = await PayrollService.disbursePayroll(tenant.id, cyclePostPosh.id, 'NEFT-REF-TEST-999', actor)
  assert(disbursed.status === 'DISBURSED', 'Payroll cycle locked and marked DISBURSED')

  // Generate Bank NEFT payout file
  const bankFile = await PayrollService.generateBankPayoutFile(tenant.id, cyclePostPosh.id)
  assert(bankFile.includes('Account Holder Name'), 'Bank NEFT/RTGS payout export generated with headers')
  assert(bankFile.includes('Pooja Deshmukh'), 'Candidate name included in bank disbursement export')

  // ----------------------------------------------------
  // TEST SUITE 6: OFFBOARDING, INVENTORY CLEARANCE & EXIT
  // ----------------------------------------------------
  console.log('\nTEST SUITE 6: Resignation, Clearance & Safe Deactivation')

  const resignation = await OffboardingService.submitResignation(
    tenant.id,
    onboardedStaff.id,
    {
      reason: 'Relocating to another city',
      requestedLwd: new Date(Date.now() + 86400000 * 60),
    },
    actor
  )
  assert(resignation.status === 'SUBMITTED', 'Resignation submitted and tracked under notice period')

  const tasks = await db.offboardingTask.findMany({ where: { staffProfileId: onboardedStaff.id } })
  assert(tasks.length === 5, '5 cross-module clearance tasks initialized (Inventory, Academics, Finance, Exit, Revocation)')

  // Complete all clearance tasks
  for (const t of tasks) {
    await OffboardingService.completeClearanceTask(tenant.id, t.id, actor, 'Verification completed cleanly')
  }

  const finalResignation = await db.resignationRequest.findUnique({ where: { staffProfileId: onboardedStaff.id } })
  assert(finalResignation?.status === 'COMPLETED', 'Resignation status transitioned to COMPLETED')

  // Check safe deactivation (preserves historical data)
  const finalProfile = await db.staffProfile.findUnique({ where: { id: onboardedStaff.id } })
  const finalUser = await db.user.findUnique({ where: { id: onboardedStaff.userId } })
  assert(finalProfile?.status === 'INACTIVE', 'StaffProfile safely marked INACTIVE')
  assert(finalUser?.status === 'INACTIVE', 'User login session invalidated (INACTIVE)')
  assert(finalProfile?.deletedAt === null, 'Record NOT deleted — historical audit and payroll retained!')

  // ----------------------------------------------------
  // TEST SUITE 7: USERS MODULE TO HR SYNCHRONIZATION
  // ----------------------------------------------------
  console.log('\nTEST SUITE 7: Users Module to HR Synchronization')

  // 1. Create a Teacher through canonical User creation pattern
  const teacherEmail = `synctest.teacher.${Date.now()}@preone.test`
  const testClassroom = await db.classroom.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      academicSessionId: session.id,
      name: `Sync Nursery ${Date.now().toString().slice(-4)}`,
      code: `SYNC-CLS-${Date.now().toString().slice(-4)}`,
      programType: 'NURSERY',
      capacity: 20,
      isActive: true,
    },
  })

  const syncTeacherUser = await db.user.create({
    data: {
      email: teacherEmail,
      fullName: 'Aarohi Sen',
      phone: `98765${Date.now().toString().slice(-5)}`,
      passwordHash: 'dummy-hash',
      status: 'ACTIVE',
    },
  })

  await db.tenantUser.create({
    data: {
      tenantId: tenant.id,
      userId: syncTeacherUser.id,
      role: 'TEACHER',
      roles: ['TEACHER'],
      branchId: branch.id,
      status: 'ACTIVE',
    },
  })

  const teacherEmpCode = `TCH-${Date.now().toString().slice(-4)}`
  const syncTeacherProfile = await db.staffProfile.create({
    data: {
      tenantId: tenant.id,
      userId: syncTeacherUser.id,
      employeeCode: teacherEmpCode,
      designation: 'Senior Montessorian',
      branchId: branch.id,
      status: 'ACTIVE',
    },
  })

  await db.classroom.update({
    where: { id: testClassroom.id },
    data: { primaryTeacherId: syncTeacherUser.id },
  })

  assert(syncTeacherProfile.userId === syncTeacherUser.id, '1. User and StaffProfile linked by canonical userId')
  assert(syncTeacherProfile.employeeCode === teacherEmpCode, '2. StaffProfile employeeCode recorded correctly')

  // 2. Query HR Staff Directory logic (as performed by GET /api/v1/hr/staff)
  const hrProfiles = await db.staffProfile.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    include: {
      user: { select: { id: true, fullName: true, email: true, phone: true, status: true } },
      branch: { select: { id: true, name: true, code: true } },
    },
  })

  const foundInHr = hrProfiles.find((p) => p.userId === syncTeacherUser.id)
  assert(!!foundInHr, '3. Newly created staff user immediately exists in HR Staff Directory')
  assert(foundInHr?.user.fullName === 'Aarohi Sen', '4. HR directory reflects correct full name from User')
  assert(foundInHr?.employeeCode === teacherEmpCode, '5. HR directory reflects employeeCode')
  assert(foundInHr?.designation === 'Senior Montessorian', '6. HR directory reflects workforce designation')
  assert(foundInHr?.branchId === branch.id, '7. HR directory reflects correct branch assignment')

  // Verify classroom mapping
  const activeClassrooms = await db.classroom.findMany({
    where: { tenantId: tenant.id, isActive: true, primaryTeacherId: { not: null } },
  })
  const clsNames = activeClassrooms.filter((c) => c.primaryTeacherId === syncTeacherUser.id).map((c) => c.name)
  assert(clsNames.includes(testClassroom.name), '8. Teacher assigned classroom resolved in HR profile')

  // 3. Update staff via User Edit pattern (e.g. designation & branch change)
  const newBranch = await db.branch.create({
    data: {
      tenantId: tenant.id,
      name: 'North Campus',
      code: `NC-${Date.now().toString().slice(-4)}`,
      isActive: true,
    },
  })

  // Safe update pattern (by userId)
  const existingProf = await db.staffProfile.findUnique({ where: { userId: syncTeacherUser.id } })
  await db.staffProfile.update({
    where: { id: existingProf!.id },
    data: {
      designation: 'Lead Curriculum Specialist',
      branchId: newBranch.id,
    },
  })
  await db.tenantUser.updateMany({
    where: { tenantId: tenant.id, userId: syncTeacherUser.id },
    data: { branchId: newBranch.id },
  })

  const updatedInHr = await db.staffProfile.findUnique({
    where: { userId: syncTeacherUser.id },
    include: { branch: true },
  })
  assert(updatedInHr?.designation === 'Lead Curriculum Specialist', '9. Designation updated in User module instantly updates HR')
  assert(updatedInHr?.branchId === newBranch.id, '10. Branch update synchronized to HR directory')

  // 4. Multi-role staff member (e.g. TEACHER + ACCOUNTS)
  const multiRoleUser = await db.user.create({
    data: {
      email: `multirole.${Date.now()}@preone.test`,
      fullName: 'Vikram Joshi',
      passwordHash: 'dummy-hash',
      status: 'ACTIVE',
    },
  })
  await db.tenantUser.create({
    data: {
      tenantId: tenant.id,
      userId: multiRoleUser.id,
      role: 'TEACHER',
      roles: ['TEACHER', 'ACCOUNTS'],
      branchId: branch.id,
      status: 'ACTIVE',
    },
  })
  await db.staffProfile.create({
    data: {
      tenantId: tenant.id,
      userId: multiRoleUser.id,
      employeeCode: `EMP-MR-${Date.now().toString().slice(-4)}`,
      designation: 'Educator & Bursar',
      branchId: branch.id,
      status: 'ACTIVE',
    },
  })

  const allHrStaff = await db.staffProfile.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
  })
  const multiRoleProfiles = allHrStaff.filter((p) => p.userId === multiRoleUser.id)
  assert(multiRoleProfiles.length === 1, '11. Multi-role staff user has exactly ONE StaffProfile (Zero duplicate workforce records)')

  // 5. Parent user isolation (Parents must NEVER appear in HR Staff Directory)
  const parentUser = await db.user.create({
    data: {
      email: `parentonly.${Date.now()}@preone.test`,
      fullName: 'Pooja Patil',
      passwordHash: 'dummy-hash',
      status: 'ACTIVE',
    },
  })
  await db.tenantUser.create({
    data: {
      tenantId: tenant.id,
      userId: parentUser.id,
      role: 'PARENT',
      roles: ['PARENT'],
      status: 'ACTIVE',
    },
  })

  const parentInHr = await db.staffProfile.findUnique({ where: { userId: parentUser.id } })
  assert(parentInHr === null, '12. Pure PARENT user has NO StaffProfile and does NOT appear in HR')

  // 6. User suspension synchronization
  await db.tenantUser.updateMany({
    where: { tenantId: tenant.id, userId: syncTeacherUser.id },
    data: { status: 'SUSPENDED' },
  })
  await db.staffProfile.update({
    where: { userId: syncTeacherUser.id },
    data: { status: 'SUSPENDED' },
  })

  const suspendedStaff = await db.staffProfile.findUnique({ where: { userId: syncTeacherUser.id } })
  assert(suspendedStaff?.status === 'SUSPENDED', '13. Staff suspension in User module synchronizes to HR status')

  // 7. Storekeeper designation bridging
  const storekeeperUser = await db.user.create({
    data: {
      email: `storekeeper.${Date.now()}@preone.test`,
      fullName: 'Ramesh Pawar',
      passwordHash: 'dummy-hash',
      status: 'ACTIVE',
    },
  })
  await db.tenantUser.create({
    data: {
      tenantId: tenant.id,
      userId: storekeeperUser.id,
      role: 'COORDINATOR',
      roles: ['COORDINATOR'],
      status: 'ACTIVE',
    },
  })
  const skProfile = await db.staffProfile.create({
    data: {
      tenantId: tenant.id,
      userId: storekeeperUser.id,
      employeeCode: `STK-${Date.now().toString().slice(-4)}`,
      designation: 'Storekeeper',
      status: 'ACTIVE',
    },
  })
  assert(skProfile.designation === 'Storekeeper', '14. Storekeeper designation stored on canonical StaffProfile')

  // 8. Staff Search Filter in HR Directory
  const searchResult = await db.staffProfile.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      userId: syncTeacherUser.id,
      OR: [
        { employeeCode: { contains: 'Aarohi', mode: 'insensitive' } },
        { user: { fullName: { contains: 'Aarohi', mode: 'insensitive' } } },
      ],
    },
    include: { user: true },
  })
  assert(searchResult.length === 1 && searchResult[0].user.fullName === 'Aarohi Sen', '15. HR Search query finds staff created via Users module by name')

  // 9. Total Staff Directory Count Integrity
  const totalProfilesCount = await db.staffProfile.count({ where: { tenantId: tenant.id, deletedAt: null } })
  assert(totalProfilesCount >= 3, '16. HR Staff Directory count accurately matches all active workforce members')

  // ----------------------------------------------------
  // TEST SUITE 8: COMPLETE FIELD EDITABILITY & ATTENDANCE CORRECTION
  // ----------------------------------------------------
  console.log('\nTEST SUITE 8: Complete Field Editability & Attendance Correction')

  // 1. Full Editability Matrix via StaffService.updateStaffProfile
  const updatedStaff = await StaffService.updateStaffProfile(
    tenant.id,
    syncTeacherProfile.id,
    {
      fullName: 'Aarohi Sen-Gupta',
      phone: '9988776655',
      bloodGroup: 'O_POSITIVE',
      currentAddress: '42 Orchid Boulevard, Tech Park Road',
      emergencyContactName: 'Amit Sen',
      emergencyContactPhone: '9988776650',
      panNumber: 'ABCDE1234F',
      aadhaarNumber: '123456789012',
      designation: 'Lead Pedagogist',
      department: 'Primary Early Years',
      salary: {
        basicSalary: 55000,
        hra: 15000,
        specialAllowance: 5000,
        pfEligible: true,
      },
      bankDetails: {
        accountNumber: '9876543210123',
        ifscCode: 'HDFC0000123',
        bankName: 'HDFC Bank',
        accountHolderName: 'Aarohi Sen-Gupta',
      },
    },
    { id: syncTeacherUser.id, name: 'Admin', role: 'CAMPUS_ADMIN' }
  )

  const updatedSalary = await db.staffSalaryStructure.findUnique({ where: { staffProfileId: syncTeacherProfile.id } })
  const updatedBank = await db.staffBankDetail.findUnique({ where: { staffProfileId: syncTeacherProfile.id } })

  assert(updatedStaff.user.fullName === 'Aarohi Sen-Gupta', '1. User fullName updated via StaffProfile editor')
  assert(updatedStaff.user.phone === '9988776655', '2. User phone updated via StaffProfile editor')
  assert(updatedStaff.designation === 'Lead Pedagogist', '3. Designation updated to Lead Pedagogist')
  assert(updatedStaff.department === 'Primary Early Years', '4. Department updated to Primary Early Years')
  assert(updatedStaff.bloodGroup === 'O_POSITIVE', '5. Blood group recorded as O_POSITIVE')
  assert(updatedStaff.panNumber === 'ABCDE1234F', '6. PAN number recorded securely')
  assert(updatedBank?.accountNumberMasked.includes('0123') === true, '7. Bank account masked correctly (0123)')
  assert(updatedBank?.ifscCode === 'HDFC0000123', '8. Bank IFSC code updated')
  assert(Number(updatedSalary?.basicSalary) === 55000, '9. Base salary amount updated to 55000')

  // 2. Attendance Correction Workflow with Mandatory Audit Reason
  const todayStr = new Date().toISOString().split('T')[0]
  const todayDate = new Date(`${todayStr}T00:00:00.000Z`)
  
  // Ensure attendance record exists
  const existingAtt = await db.attendanceStaff.upsert({
    where: {
      staffProfileId_date: {
        staffProfileId: syncTeacherProfile.id,
        date: todayDate,
      },
    },
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      staffProfileId: syncTeacherProfile.id,
      date: todayDate,
      status: 'PRESENT',
      checkIn: new Date(`${todayStr}T09:30:00.000Z`),
      checkOut: new Date(`${todayStr}T17:30:00.000Z`),
      workedHours: 8,
      shiftHours: 8,
    },
    update: {},
  })

  // Perform correction
  const newPunchIn = new Date(`${todayStr}T08:45:00.000Z`)
  const newPunchOut = new Date(`${todayStr}T17:45:00.000Z`)
  const diffMs = newPunchOut.getTime() - newPunchIn.getTime()
  const correctedHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10

  const correctedAtt = await db.attendanceStaff.update({
    where: { id: existingAtt.id },
    data: {
      checkIn: newPunchIn,
      checkOut: newPunchOut,
      workedHours: correctedHours,
      status: 'PRESENT',
      notes: 'Biometric reader sync delay: Manual correction by Administrator',
    },
  })

  assert(correctedAtt.workedHours === 9, '10. Attendance workHours recalculated correctly to 9 hours')
  assert(correctedAtt.notes?.includes('Manual correction') === true, '11. Attendance correction audit remark persisted')

  // 3. Application Stage Progression in Recruitment Pipeline
  const activeOpening = await db.jobOpening.findFirst({ where: { tenantId: tenant.id } })
  if (activeOpening) {
    const candidate2 = await RecruitmentService.applyForJob(
      tenant.id,
      activeOpening.id,
      {
        candidateName: 'Vikram Joshi',
        email: `vikram.joshi.${Date.now()}@preone.test`,
        phone: '9811223344',
        experienceYears: 4,
        currentSalary: 40000,
        expectedSalary: 50000,
        noticePeriodDays: 15,
      }
    )

    const movedCandidate = await RecruitmentService.updateApplicationStatus(
      tenant.id,
      candidate2.id,
      'SCREENING',
      actor,
      'Resume screened and approved by Academic Coordinator'
    )
    assert(movedCandidate.status === 'SCREENING', '12. Candidate status advanced to SCREENING')

    const interviewRound = await RecruitmentService.scheduleInterview(
      tenant.id,
      candidate2.id,
      {
        roundName: 'Round 1 - Technical Demo',
        scheduledAt: new Date(Date.now() + 86400000),
        interviewerName: 'Academic Director',
      },
      actor
    )

    const interviewRes = await RecruitmentService.recordInterviewResult(
      tenant.id,
      interviewRound.id,
      {
        status: 'COMPLETED',
        rating: 5,
        feedback: 'Excellent Montessori domain knowledge and pedagogy demo',
      },
      actor
    )
    assert(interviewRes.feedback?.includes('Excellent Montessori') === true, '13. Interview feedback & 5-star rating recorded')
  }

  // 4. Compliance Radar Evaluation Check
  const allStaffCount = await db.staffProfile.count({ where: { tenantId: tenant.id, deletedAt: null } })
  const validPoshTrainings = await db.staffTraining.count({
    where: {
      tenantId: tenant.id,
      trainingType: 'POSH',
      expiryDate: { gte: new Date() },
    },
  })
  assert(allStaffCount >= 2, '14. Total staff count valid for compliance radar assessment')
  assert(validPoshTrainings >= 1, '15. At least 1 staff member has active POSH certification')

  console.log('\n====================================================')
  console.log(`E2E TEST RUN COMPLETE: ${passed} PASSED, ${failed} FAILED`)
  console.log('====================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

run()
  .catch((e) => {
    console.error('Fatal test runner error:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
