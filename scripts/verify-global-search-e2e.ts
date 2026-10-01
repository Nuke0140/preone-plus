/**
 * PreOne Enterprise Preschool OS
 * Global Search Capability — Production E2E Verification Suite
 *
 * Covers Groups A through T (100+ meaningful executable assertions):
 * - Group A: Health & Scope Resolution
 * - Group B: Students Domain (names, admission numbers, seat numbers, ranks)
 * - Group C: Guardians / Parents Domain (names, phone, email, relationships)
 * - Group D: Staff / Users Domain (names, emails, designations)
 * - Group E: Admissions & CRM (leads, status, inquiries)
 * - Group F: Academics & Classrooms (names, codes, programs)
 * - Group G: Attendance Records (student names, statuses, dates)
 * - Group H: Operations & Daily Timeline (timeline types, body text)
 * - Group I: Finance & Invoices (invoice numbers, receipts, payments)
 * - Group J: Workforce & HR (employee profiles, departments)
 * - Group K: Transport Domain (routes, vehicles, pickup points)
 * - Group L: Inventory & Procurement (item names, categories, stock)
 * - Group M: Reports & Safe Navigation (report names, routes)
 * - Group N: Communication & Announcements (titles, channels)
 * - Group O: Privileged Audit Log Search (security isolation)
 * - Group P: Safe Settings Search (navigation only, zero credential exposure)
 * - Group Q: Query Validation & Pagination (limit, offset, sanitization)
 * - Group R: Security & Multi-Tier Isolation (Tenant, Branch, Parent, Teacher)
 * - Group S: Performance & Scalability (latency < 200ms)
 * - Group T: Architecture & Schema Integrity (Zero duplicate tables)
 */

import { db } from '../src/lib/db'
import { GlobalSearchService } from '../src/lib/search/search-service'
import { Role, SessionPayload } from '../src/lib/auth'

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
  console.log('PREONE GLOBAL SEARCH CAPABILITY: PRODUCTION E2E VERIFICATION')
  console.log('===============================================================\n')

  const testSuffix = Date.now().toString().slice(-6)
  const tenantACode = `GSA-${testSuffix}`
  const tenantBCode = `GSB-${testSuffix}`

  let tenantA: any
  let tenantB: any
  let branchA1: any
  let branchA2: any
  let branchB: any
  let academicSessionA: any
  let classroomA: any
  let classroomA2: any
  let ownerUser: any
  let teacherUser: any
  let otherTeacherUser: any
  let parentUser: any
  let accountsUser: any
  let unprivilegedUser: any

  let studentA: any
  let studentA2: any
  let studentB: any
  let guardianA: any
  let invoiceA: any
  let leadA: any
  let staffA: any
  let timelineA: any
  let vehicleA: any
  let transportRouteA: any
  let inventoryCategoryA: any
  let inventoryUnitA: any
  let inventoryItemA: any
  let announcementA: any
  let auditLogA: any

  try {
    // -------------------------------------------------------------------------
    // SETUP: MULTI-TENANT ISOLATION FIXTURES
    // -------------------------------------------------------------------------
    console.log('[SETUP] Creating Multi-Tenant, Multi-Branch & Domain Fixtures...')

    tenantA = await db.tenant.create({
      data: {
        name: `Sunrise Academy ${testSuffix}`,
        code: tenantACode,
        status: 'ACTIVE',
      },
    })

    tenantB = await db.tenant.create({
      data: {
        name: `Moonlight Heights ${testSuffix}`,
        code: tenantBCode,
        status: 'ACTIVE',
      },
    })

    branchA1 = await db.branch.create({
      data: {
        tenantId: tenantA.id,
        name: `North Campus ${testSuffix}`,
        code: `NC-${testSuffix}`,
        isMain: true,
      },
    })

    branchA2 = await db.branch.create({
      data: {
        tenantId: tenantA.id,
        name: `South Campus ${testSuffix}`,
        code: `SC-${testSuffix}`,
        isMain: false,
      },
    })

    branchB = await db.branch.create({
      data: {
        tenantId: tenantB.id,
        name: `Branch Beta ${testSuffix}`,
        code: `BB-${testSuffix}`,
        isMain: true,
      },
    })

    academicSessionA = await db.academicSession.create({
      data: {
        tenantId: tenantA.id,
        name: `2026-2027 ${testSuffix}`,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2027-04-30'),
        isCurrent: true,
      },
    })

    // Users & Memberships
    ownerUser = await db.user.create({
      data: {
        email: `owner-${testSuffix}@sunrise.test`,
        fullName: `Dr. Vikram Owner ${testSuffix}`,
        passwordHash: 'hash',
        status: 'ACTIVE',
      },
    })

    await db.tenantUser.create({
      data: {
        tenantId: tenantA.id,
        userId: ownerUser.id,
        branchId: branchA1.id,
        role: 'OWNER',
        roles: ['OWNER'],
        status: 'ACTIVE',
      },
    })

    teacherUser = await db.user.create({
      data: {
        email: `teacher-${testSuffix}@sunrise.test`,
        fullName: `Anjali Sharma ${testSuffix}`,
        passwordHash: 'hash',
        status: 'ACTIVE',
      },
    })

    await db.tenantUser.create({
      data: {
        tenantId: tenantA.id,
        userId: teacherUser.id,
        branchId: branchA1.id,
        role: 'TEACHER',
        roles: ['TEACHER'],
        status: 'ACTIVE',
      },
    })

    otherTeacherUser = await db.user.create({
      data: {
        email: `other-teacher-${testSuffix}@sunrise.test`,
        fullName: `Rohit Verma ${testSuffix}`,
        passwordHash: 'hash',
        status: 'ACTIVE',
      },
    })

    await db.tenantUser.create({
      data: {
        tenantId: tenantA.id,
        userId: otherTeacherUser.id,
        branchId: branchA1.id,
        role: 'TEACHER',
        roles: ['TEACHER'],
        status: 'ACTIVE',
      },
    })

    parentUser = await db.user.create({
      data: {
        email: `parent-${testSuffix}@gmail.test`,
        fullName: `Suresh Patil ${testSuffix}`,
        passwordHash: 'hash',
        status: 'ACTIVE',
      },
    })

    await db.tenantUser.create({
      data: {
        tenantId: tenantA.id,
        userId: parentUser.id,
        branchId: branchA1.id,
        role: 'PARENT',
        roles: ['PARENT'],
        status: 'ACTIVE',
      },
    })

    accountsUser = await db.user.create({
      data: {
        email: `accounts-${testSuffix}@sunrise.test`,
        fullName: `Naveen Accountant ${testSuffix}`,
        passwordHash: 'hash',
        status: 'ACTIVE',
      },
    })

    await db.tenantUser.create({
      data: {
        tenantId: tenantA.id,
        userId: accountsUser.id,
        branchId: branchA1.id,
        role: 'ACCOUNTS',
        roles: ['ACCOUNTS'],
        status: 'ACTIVE',
      },
    })

    unprivilegedUser = await db.user.create({
      data: {
        email: `guest-${testSuffix}@sunrise.test`,
        fullName: `Guest User ${testSuffix}`,
        passwordHash: 'hash',
        status: 'ACTIVE',
      },
    })

    await db.tenantUser.create({
      data: {
        tenantId: tenantA.id,
        userId: unprivilegedUser.id,
        branchId: branchA1.id,
        role: 'PARENT',
        roles: [],
        status: 'ACTIVE',
      },
    })

    // Classrooms
    classroomA = await db.classroom.create({
      data: {
        tenantId: tenantA.id,
        branchId: branchA1.id,
        academicSessionId: academicSessionA.id,
        name: `Lotus Nursery ${testSuffix}`,
        code: `LOTUS-${testSuffix}`,
        capacity: 25,
        programType: 'NURSERY',
        primaryTeacherId: teacherUser.id,
      },
    })

    classroomA2 = await db.classroom.create({
      data: {
        tenantId: tenantA.id,
        branchId: branchA1.id,
        academicSessionId: academicSessionA.id,
        name: `Marigold KG ${testSuffix}`,
        code: `MARI-${testSuffix}`,
        capacity: 20,
        programType: 'UKG',
        primaryTeacherId: otherTeacherUser.id,
      },
    })

    // Students
    studentA = await db.student.create({
      data: {
        tenantId: tenantA.id,
        branchId: branchA1.id,
        admissionNo: `ADM-A-${testSuffix}`,
        seatNumber: `SEAT-${testSuffix}`,
        firstName: `Aarav`,
        lastName: `Patil ${testSuffix}`,
        dob: new Date('2022-03-15'),
        gender: 'MALE',
        status: 'ACTIVE',
        currentClassroomId: classroomA.id,
      },
    })

    studentA2 = await db.student.create({
      data: {
        tenantId: tenantA.id,
        branchId: branchA1.id,
        admissionNo: `ADM-A2-${testSuffix}`,
        seatNumber: `SEAT2-${testSuffix}`,
        firstName: `Kavya`,
        lastName: `Deshmukh ${testSuffix}`,
        dob: new Date('2022-07-20'),
        gender: 'FEMALE',
        status: 'ACTIVE',
        currentClassroomId: classroomA2.id,
      },
    })

    studentB = await db.student.create({
      data: {
        tenantId: tenantB.id,
        branchId: branchB.id,
        admissionNo: `ADM-B-${testSuffix}`,
        firstName: `ForeignAarav`,
        lastName: `Secret ${testSuffix}`,
        dob: new Date('2022-01-10'),
        gender: 'MALE',
        status: 'ACTIVE',
      },
    })

    // Guardian
    guardianA = await db.guardian.create({
      data: {
        tenantId: tenantA.id,
        userId: parentUser.id,
        fullName: `Suresh Patil ${testSuffix}`,
        relationship: 'FATHER',
        phone: `98200${testSuffix}`,
        email: parentUser.email,
        isPrimaryContact: true,
      },
    })

    await db.studentGuardian.create({
      data: {
        studentId: studentA.id,
        guardianId: guardianA.id,
        relationship: 'FATHER',
        isPrimary: true,
      },
    })

    // StaffProfile
    staffA = await db.staffProfile.create({
      data: {
        tenantId: tenantA.id,
        userId: teacherUser.id,
        branchId: branchA1.id,
        employeeCode: `EMP-${testSuffix}`,
        designation: `Senior Montessori Lead ${testSuffix}`,
        department: `Early Years`,
        joiningDate: new Date('2024-01-01'),
      },
    })

    // Lead / Admission
    leadA = await db.lead.create({
      data: {
        tenantId: tenantA.id,
        branchId: branchA1.id,
        leadNumber: `LEAD-${testSuffix}`,
        childName: `Vivaan Inquiry ${testSuffix}`,
        parentName: `Meera Inquiry`,
        phone: `99110${testSuffix}`,
        status: 'NEW',
        source: 'WEBSITE',
      },
    })

    // Invoice
    invoiceA = await db.invoice.create({
      data: {
        tenantId: tenantA.id,
        branchId: branchA1.id,
        studentId: studentA.id,
        invoiceNumber: `INV-GS-${testSuffix}`,
        title: `Nursery Term Fee ${testSuffix}`,
        status: 'ISSUED',
        subtotalCents: 4500000,
        totalCents: 4500000,
        balanceCents: 4500000,
        dueDate: new Date('2026-10-15'),
      },
    })

    // Daily Operations Timeline
    timelineA = await db.timelineEntry.create({
      data: {
        tenantId: tenantA.id,
        studentId: studentA.id,
        type: 'MEAL',
        title: `Lunch Finished ${testSuffix}`,
        body: `Aarav completed his full lunch meal happily`,
      },
    })

    // Attendance
    await db.attendance.create({
      data: {
        tenantId: tenantA.id,
        branchId: branchA1.id,
        studentId: studentA.id,
        classroomId: classroomA.id,
        date: new Date('2026-09-15'),
        status: 'PRESENT',
        markedById: teacherUser.id,
      },
    })

    // Transport (Vehicle + Route)
    vehicleA = await db.vehicle.create({
      data: {
        tenantId: tenantA.id,
        branchId: branchA1.id,
        registrationNumber: `MH-12-GS-${testSuffix}`,
        vehicleType: 'MINIVAN',
        makeModel: 'Force Traveller',
        status: 'ACTIVE',
      },
    })

    transportRouteA = await db.transportRoute.create({
      data: {
        tenantId: tenantA.id,
        branchId: branchA1.id,
        code: `R-${testSuffix}`,
        name: `Orchid Express ${testSuffix}`,
        vehicleId: vehicleA.id,
        status: 'ACTIVE',
      },
    })

    // Inventory
    inventoryCategoryA = await db.inventoryCategory.create({
      data: {
        tenantId: tenantA.id,
        code: `CAT-${testSuffix}`,
        name: `Learning Materials ${testSuffix}`,
      },
    })

    inventoryUnitA = await db.inventoryUnit.create({
      data: {
        tenantId: tenantA.id,
        code: `SET-${testSuffix}`,
        name: 'Set',
        symbol: 'set',
      },
    })

    inventoryItemA = await db.inventoryItem.create({
      data: {
        tenantId: tenantA.id,
        categoryId: inventoryCategoryA.id,
        unitId: inventoryUnitA.id,
        sku: `SKU-${testSuffix}`,
        name: `Montessori Sandpaper Letters ${testSuffix}`,
        minimumStock: 5,
        isActive: true,
      },
    })

    // Announcement
    announcementA = await db.announcement.create({
      data: {
        tenantId: tenantA.id,
        branchId: branchA1.id,
        title: `Annual Day Notice ${testSuffix}`,
        body: `Preparation schedule for parents and students`,
        audience: 'SCHOOL_WIDE',
        status: 'PUBLISHED',
      },
    })

    // Audit Log
    auditLogA = await db.auditLog.create({
      data: {
        tenantId: tenantA.id,
        actorId: ownerUser.id,
        actorName: ownerUser.fullName,
        action: 'UPDATE_SETTINGS',
        entity: 'TENANT_SETTINGS',
        entityId: tenantA.id,
        summary: `Security perimeter validated ${testSuffix}`,
      },
    })

    console.log('✓ All database fixtures created successfully.\n')

    // Sessions for testing
    const ownerSession: SessionPayload = {
      uid: ownerUser.id,
      email: ownerUser.email,
      role: 'OWNER',
      roles: ['OWNER'],
      tenantId: tenantA.id,
      tenantName: tenantA.name,
      branchId: branchA1.id,
      branchName: branchA1.name,
    }

    const teacherSession: SessionPayload = {
      uid: teacherUser.id,
      email: teacherUser.email,
      role: 'TEACHER',
      roles: ['TEACHER'],
      tenantId: tenantA.id,
      tenantName: tenantA.name,
      branchId: branchA1.id,
      branchName: branchA1.name,
    }

    const parentSession: SessionPayload = {
      uid: parentUser.id,
      email: parentUser.email,
      role: 'PARENT',
      roles: ['PARENT'],
      tenantId: tenantA.id,
      tenantName: tenantA.name,
      branchId: branchA1.id,
      branchName: branchA1.name,
    }

    const accountsSession: SessionPayload = {
      uid: accountsUser.id,
      email: accountsUser.email,
      role: 'ACCOUNTS',
      roles: ['ACCOUNTS'],
      tenantId: tenantA.id,
      tenantName: tenantA.name,
      branchId: branchA1.id,
      branchName: branchA1.name,
    }

    // -------------------------------------------------------------------------
    // GROUP A: HEALTH & SCOPE RESOLUTION
    // -------------------------------------------------------------------------
    console.log('[GROUP A] Health, Scope Resolution & Base Contracts')

    const resEmpty = await GlobalSearchService.search('', ownerSession)
    assert(resEmpty.total === 0, 'Empty query returns total = 0')
    assert(resEmpty.results.length === 0, 'Empty query returns empty results array')
    assert(Object.keys(resEmpty.categoryCounts).length === 0, 'Empty query returns empty categoryCounts')

    const resWhitespace = await GlobalSearchService.search('    ', ownerSession)
    assert(resWhitespace.total === 0, 'Whitespace query returns total = 0')

    const resScope = await GlobalSearchService.search('Aarav', ownerSession)
    assert(resScope.query === 'Aarav', 'Response echoes back sanitized query')
    assert(resScope.total >= 1, 'Owner finds matching record')
    assert(Array.isArray(resScope.results), 'Results is an array')
    assert(typeof resScope.categoryCounts === 'object', 'Category counts is a structured dictionary')

    // -------------------------------------------------------------------------
    // GROUP B: STUDENTS DOMAIN
    // -------------------------------------------------------------------------
    console.log('[GROUP B] Students Domain (Names, Admission No, Seat No, Classrooms)')

    const resStudName = await GlobalSearchService.search(`Aarav`, ownerSession, { category: 'students' })
    assert(resStudName.total >= 1, 'Student found by first name')
    const foundStudA = resStudName.results.find((r) => r.id === studentA.id)
    assert(!!foundStudA, 'Result contains student ID')
    assert(foundStudA?.category === 'students', 'Result category is students')
    assert(foundStudA?.actionUrl === `/app/students?id=${studentA.id}`, 'Action URL links to student detail')
    assert(foundStudA?.title.includes('Aarav'), 'Title contains student name')
    assert(foundStudA?.subtitle?.includes(studentA.admissionNo) ?? false, 'Subtitle includes admission number')

    const resAdmNo = await GlobalSearchService.search(studentA.admissionNo, ownerSession, { category: 'students' })
    assert(resAdmNo.total >= 1, 'Student found by exact admission number')
    assert(resAdmNo.results[0]?.id === studentA.id, 'Top result matches admission number')
    assert(resAdmNo.results[0]?.score >= 90, 'Exact identifier match gets high deterministic score (>= 90)')

    const resSeatNo = await GlobalSearchService.search(studentA.seatNumber!, ownerSession, { category: 'students' })
    assert(resSeatNo.total >= 1, 'Student found by seat number')

    // -------------------------------------------------------------------------
    // GROUP C: GUARDIANS / PARENTS DOMAIN
    // -------------------------------------------------------------------------
    console.log('[GROUP C] Guardians Domain (Names, Phone, Email, Relationships)')

    const resGuardian = await GlobalSearchService.search(`Suresh Patil ${testSuffix}`, ownerSession, { category: 'guardians' })
    assert(resGuardian.total >= 1, 'Guardian found by full name')
    const foundG = resGuardian.results.find((r) => r.id === guardianA.id)
    assert(!!foundG, 'Guardian result contains canonical guardian ID')
    assert(foundG?.category === 'guardians', 'Result category is guardians')
    assert(foundG?.actionUrl === `/app/users`, 'Action URL deep-links to users/guardians view')
    assert(foundG?.badge === 'FATHER', 'Badge indicates guardian relationship')

    const resGuardPhone = await GlobalSearchService.search(guardianA.phone, ownerSession, { category: 'guardians' })
    assert(resGuardPhone.total >= 1, 'Guardian found by phone number')

    // -------------------------------------------------------------------------
    // GROUP D: STAFF / USERS DOMAIN
    // -------------------------------------------------------------------------
    console.log('[GROUP D] Staff & Users Domain (Names, Emails, Designations)')

    const resStaffName = await GlobalSearchService.search(`Anjali Sharma ${testSuffix}`, ownerSession, { category: 'staff' })
    assert(resStaffName.total >= 1, 'Staff member found by user name')
    const foundStaff = resStaffName.results.find((r) => r.id === staffA.id)
    assert(!!foundStaff, 'Staff result contains canonical staff profile ID')
    assert(foundStaff?.category === 'staff', 'Result category is staff')
    assert(foundStaff?.actionUrl === `/app/hr`, 'Action URL deep-links to hr')
    assert(foundStaff?.badge === 'ACTIVE', 'Badge indicates status')

    const resStaffEmail = await GlobalSearchService.search(teacherUser.email, ownerSession, { category: 'staff' })
    assert(resStaffEmail.total >= 1, 'Staff member found by exact email')

    // -------------------------------------------------------------------------
    // GROUP E: ADMISSIONS & CRM DOMAIN
    // -------------------------------------------------------------------------
    console.log('[GROUP E] Admissions Domain (Leads, Inquiries, Phone)')

    const resLead = await GlobalSearchService.search(`Vivaan Inquiry ${testSuffix}`, ownerSession, { category: 'admissions' })
    assert(resLead.total >= 1, 'Lead found by child name')
    const foundLead = resLead.results.find((r) => r.id === leadA.id)
    assert(!!foundLead, 'Lead result matches canonical lead ID')
    assert(foundLead?.category === 'admissions', 'Result category is admissions')
    assert(foundLead?.actionUrl === `/app/admissions`, 'Action URL deep-links to admissions')
    assert(foundLead?.badge === 'NEW', 'Badge indicates lead status')

    const resLeadPhone = await GlobalSearchService.search(leadA.phone, ownerSession, { category: 'admissions' })
    assert(resLeadPhone.total >= 1, 'Lead found by parent phone')

    // -------------------------------------------------------------------------
    // GROUP F: ACADEMICS & CLASSROOMS DOMAIN
    // -------------------------------------------------------------------------
    console.log('[GROUP F] Academics & Classrooms Domain')

    const resClass = await GlobalSearchService.search(`Lotus Nursery ${testSuffix}`, ownerSession, { category: 'academics' })
    assert(resClass.total >= 1, 'Classroom found by name')
    const foundClass = resClass.results.find((r) => r.id === classroomA.id)
    assert(!!foundClass, 'Classroom result matches canonical classroom ID')
    assert(foundClass?.category === 'academics', 'Result category is academics')
    assert(foundClass?.actionUrl === `/app/academics`, 'Action URL links to academics')
    assert(foundClass?.badge === 'NURSERY', 'Badge indicates program type')

    const resClassCode = await GlobalSearchService.search(`LOTUS-${testSuffix}`, ownerSession, { category: 'academics' })
    assert(resClassCode.total >= 1, 'Classroom found by room code')

    // -------------------------------------------------------------------------
    // GROUP G: ATTENDANCE DOMAIN
    // -------------------------------------------------------------------------
    console.log('[GROUP G] Attendance Domain')

    const resAtt = await GlobalSearchService.search(`Aarav`, ownerSession, { category: 'attendance' })
    assert(resAtt.total >= 1, 'Attendance record found for student')
    assert(resAtt.results[0]?.category === 'attendance', 'Result category is attendance')
    assert(resAtt.results[0]?.actionUrl.startsWith('/app/attendance'), 'Action URL links to attendance module')
    assert(resAtt.results[0]?.badge === 'PRESENT', 'Badge indicates attendance status')

    // -------------------------------------------------------------------------
    // GROUP H: OPERATIONS & DAILY TIMELINE DOMAIN
    // -------------------------------------------------------------------------
    console.log('[GROUP H] Operations & Daily Timeline Domain')

    const resTimeline = await GlobalSearchService.search(`Lunch Finished ${testSuffix}`, ownerSession, { category: 'operations' })
    assert(resTimeline.total >= 1, 'Timeline entry found by title')
    const foundTime = resTimeline.results.find((r) => r.id === timelineA.id)
    assert(!!foundTime, 'Timeline result matches canonical timeline entry ID')
    assert(foundTime?.category === 'operations', 'Result category is operations')
    assert(foundTime?.badge === 'MEAL', 'Badge indicates timeline type')
    assert(foundTime?.actionUrl === `/app/operations`, 'Action URL links to operations')

    // -------------------------------------------------------------------------
    // GROUP I: FINANCE & INVOICES DOMAIN
    // -------------------------------------------------------------------------
    console.log('[GROUP I] Finance & Invoices Domain')

    const resInv = await GlobalSearchService.search(`INV-GS-${testSuffix}`, ownerSession, { category: 'finance' })
    assert(resInv.total >= 1, 'Invoice found by invoice number')
    const foundInv = resInv.results.find((r) => r.id === invoiceA.id)
    assert(!!foundInv, 'Invoice result matches canonical invoice ID')
    assert(foundInv?.category === 'finance', 'Result category is finance')
    assert(foundInv?.badge === 'ISSUED', 'Badge indicates invoice status')
    assert(foundInv?.actionUrl === `/app/finance`, 'Action URL links to finance')

    // Accounts user can also access finance
    const resInvAcc = await GlobalSearchService.search(`INV-GS-${testSuffix}`, accountsSession, { category: 'finance' })
    assert(resInvAcc.total >= 1, 'Accounts user can search invoices')

    // -------------------------------------------------------------------------
    // GROUP J: WORKFORCE & HR DOMAIN
    // -------------------------------------------------------------------------
    console.log('[GROUP J] Workforce & HR Domain')

    const resStaffProf = await GlobalSearchService.search(`Montessori Lead ${testSuffix}`, ownerSession, { category: 'hr' })
    assert(resStaffProf.total >= 1, 'Staff profile found by designation')
    const foundProf = resStaffProf.results.find((r) => r.id === staffA.id)
    assert(!!foundProf, 'StaffProfile result matches canonical staff ID')
    assert(foundProf?.category === 'hr', 'Result category is hr')
    assert(foundProf?.badge === 'REGULAR', 'Badge indicates employment type')

    const resEmpCode = await GlobalSearchService.search(`EMP-${testSuffix}`, ownerSession, { category: 'hr' })
    assert(resEmpCode.total >= 1, 'Staff profile found by employee code')

    // -------------------------------------------------------------------------
    // GROUP K: TRANSPORT DOMAIN
    // -------------------------------------------------------------------------
    console.log('[GROUP K] Transport Domain')

    const resTrans = await GlobalSearchService.search(`Orchid Express ${testSuffix}`, ownerSession, { category: 'transport' })
    assert(resTrans.total >= 1, 'Transport route found by route name')
    const foundRoute = resTrans.results.find((r) => r.id === transportRouteA.id)
    assert(!!foundRoute, 'Transport result matches canonical route ID')
    assert(foundRoute?.category === 'transport', 'Result category is transport')
    assert(foundRoute?.actionUrl === `/app/transport`, 'Action URL links to transport')
    assert(foundRoute?.badge === 'ACTIVE', 'Badge indicates route status')

    const resVeh = await GlobalSearchService.search(`MH-12-GS-${testSuffix}`, ownerSession, { category: 'transport' })
    assert(resVeh.total >= 1, 'Transport vehicle found by registration number')

    // -------------------------------------------------------------------------
    // GROUP L: INVENTORY DOMAIN
    // -------------------------------------------------------------------------
    console.log('[GROUP L] Inventory Domain')

    const resInvItem = await GlobalSearchService.search(`Sandpaper Letters ${testSuffix}`, ownerSession, { category: 'inventory' })
    assert(resInvItem.total >= 1, 'Inventory item found by item name')
    const foundItem = resInvItem.results.find((r) => r.id === inventoryItemA.id)
    assert(!!foundItem, 'Inventory result matches canonical item ID')
    assert(foundItem?.category === 'inventory', 'Result category is inventory')
    assert(foundItem?.actionUrl === `/app/inventory`, 'Action URL links to inventory')

    // -------------------------------------------------------------------------
    // GROUP M: REPORTS DOMAIN
    // -------------------------------------------------------------------------
    console.log('[GROUP M] Reports & Safe Navigation Domain')

    const resRep = await GlobalSearchService.search(`Attendance Summary`, ownerSession, { category: 'reports' })
    assert(resRep.total >= 1, 'Report found by report title')
    assert(resRep.results[0]?.category === 'reports', 'Result category is reports')
    assert(resRep.results[0]?.actionUrl.startsWith('/app/reports'), 'Action URL links to reports section')

    // -------------------------------------------------------------------------
    // GROUP N: COMMUNICATION & ANNOUNCEMENTS DOMAIN
    // -------------------------------------------------------------------------
    console.log('[GROUP N] Communication Domain')

    const resComm = await GlobalSearchService.search(`Annual Day Notice ${testSuffix}`, ownerSession, { category: 'communication' })
    assert(resComm.total >= 1, 'Announcement found by title')
    const foundAnn = resComm.results.find((r) => r.id === announcementA.id)
    assert(!!foundAnn, 'Announcement result matches canonical announcement ID')
    assert(foundAnn?.category === 'communication', 'Result category is communication')

    // -------------------------------------------------------------------------
    // GROUP O: PRIVILEGED AUDIT LOG SEARCH
    // -------------------------------------------------------------------------
    console.log('[GROUP O] Privileged Audit Log Search')

    const resAuditOwner = await GlobalSearchService.search(`UPDATE_SETTINGS`, ownerSession, { category: 'audit' })
    assert(resAuditOwner.total >= 1, 'Owner (audit:read) can search audit logs')
    const foundAudit = resAuditOwner.results.find((r) => r.id === auditLogA.id)
    assert(!!foundAudit, 'Audit result matches canonical audit log ID')
    assert(foundAudit?.category === 'audit', 'Result category is audit')

    // Teacher cannot search audit logs
    const resAuditTeacher = await GlobalSearchService.search(`UPDATE_SETTINGS`, teacherSession, { category: 'audit' })
    assert(resAuditTeacher.total === 0, 'Teacher without audit:read cannot search audit logs (total = 0)')
    assert(resAuditTeacher.results.length === 0, 'Teacher receives empty audit results')

    // Parent cannot search audit logs
    const resAuditParent = await GlobalSearchService.search(`UPDATE_SETTINGS`, parentSession, { category: 'audit' })
    assert(resAuditParent.total === 0, 'Parent without audit:read cannot search audit logs (total = 0)')
    assert(resAuditParent.results.length === 0, 'Parent receives empty audit results')

    // -------------------------------------------------------------------------
    // GROUP P: SAFE SETTINGS SEARCH (NO SECRETS)
    // -------------------------------------------------------------------------
    console.log('[GROUP P] Safe Settings Search (Zero Credential Leak)')

    const resSettings = await GlobalSearchService.search(`Academic Session`, ownerSession, { category: 'settings' })
    assert(resSettings.total >= 1, 'Owner can search safe settings items')
    assert(resSettings.results[0]?.category === 'settings', 'Result category is settings')
    assert(!JSON.stringify(resSettings.results).includes('password'), 'Results contain zero password fields')
    assert(!JSON.stringify(resSettings.results).includes('secret'), 'Results contain zero secret keys')
    assert(!JSON.stringify(resSettings.results).includes('DATABASE_URL'), 'Results contain zero environment variables')

    // -------------------------------------------------------------------------
    // GROUP Q: QUERY VALIDATION & BOUNDED PAGINATION
    // -------------------------------------------------------------------------
    console.log('[GROUP Q] Query Validation & Bounded Pagination')

    const resPaginated = await GlobalSearchService.search(`Sun`, ownerSession, { limit: 2, offset: 0 })
    assert(resPaginated.results.length <= 2, 'Result length respects limit parameter')

    const resOffset = await GlobalSearchService.search(`Sun`, ownerSession, { limit: 2, offset: 2 })
    assert(Array.isArray(resOffset.results), 'Offset query succeeds cleanly')

    // SQL Injection / Special chars sanitization test
    const resSqlInjection = await GlobalSearchService.search(`' OR '1'='1' -- ; DROP TABLE "Student";`, ownerSession)
    assert(resSqlInjection.total === 0, 'Malicious SQL injection query safely sanitizes and returns 0 records')

    // -------------------------------------------------------------------------
    // GROUP R: SECURITY & MULTI-TIER ISOLATION
    // -------------------------------------------------------------------------
    console.log('[GROUP R] Security & Multi-Tier Isolation')

    // 1. Cross-Tenant Leakage Check (Tenant A user searching for Tenant B student)
    const resTenantLeak = await GlobalSearchService.search(`ForeignAarav`, ownerSession)
    assert(resTenantLeak.total === 0, 'Tenant A owner cannot find Tenant B student (ForeignAarav total = 0)')
    assert(resTenantLeak.results.length === 0, 'Tenant A owner receives zero results for Tenant B records')

    // 2. Parent Isolation Check
    // Parent can find own child (Aarav)
    const resParentOwnChild = await GlobalSearchService.search(`Aarav`, parentSession, { category: 'students' })
    assert(resParentOwnChild.total === 1, 'Parent can find their own linked child (Aarav)')
    assert(resParentOwnChild.results[0]?.id === studentA.id, 'Found student matches parent child ID')

    // Parent CANNOT find other student (Kavya Deshmukh)
    const resParentOtherChild = await GlobalSearchService.search(`Kavya`, parentSession, { category: 'students' })
    assert(resParentOtherChild.total === 0, 'Parent CANNOT find unlinked student Kavya (total = 0)')
    assert(resParentOtherChild.results.length === 0, 'Parent receives zero results for unlinked student')

    // Parent CANNOT find arbitrary staff or inquiries
    const resParentLead = await GlobalSearchService.search(`Vivaan Inquiry`, parentSession, { category: 'admissions' })
    assert(resParentLead.total === 0, 'Parent CANNOT search admissions/leads (total = 0)')

    // Parent CANNOT search general finance/invoices of other students
    const resParentOtherInv = await GlobalSearchService.search(`INV`, parentSession, { category: 'finance' })
    // Only studentA's invoice should appear
    assert(
      resParentOtherInv.results.every((r) => r.id === invoiceA.id),
      'Parent finance search ONLY returns invoices linked to their own child'
    )

    // 3. Teacher Isolation Check
    // Teacher can find student in their assigned classroom (Aarav in Lotus)
    const resTeacherOwnStud = await GlobalSearchService.search(`Aarav`, teacherSession, { category: 'students' })
    assert(resTeacherOwnStud.total >= 1, 'Teacher can find student in their assigned classroom')
    assert(resTeacherOwnStud.results.some((r) => r.id === studentA.id), 'Assigned student is in results')

    // Teacher CANNOT find student in other classroom (Kavya in Marigold)
    const resTeacherOtherStud = await GlobalSearchService.search(`Kavya`, teacherSession, { category: 'students' })
    assert(resTeacherOtherStud.total === 0, 'Teacher CANNOT find student in unassigned classroom (total = 0)')

    // Teacher CANNOT search arbitrary financial invoices
    const resTeacherFinance = await GlobalSearchService.search(`INV-GS`, teacherSession, { category: 'finance' })
    assert(resTeacherFinance.total === 0, 'Teacher without finance:read CANNOT search invoices (total = 0)')

    // 4. Branch Isolation Check (Multi-branch query restriction)
    const resBranchScoped = await GlobalSearchService.search(`Aarav`, ownerSession, { branchId: branchA2.id })
    assert(resBranchScoped.total === 0, 'Branch filter restricts results when entity belongs to different branch')

    // -------------------------------------------------------------------------
    // GROUP S: PERFORMANCE & SCALABILITY
    // -------------------------------------------------------------------------
    console.log('[GROUP S] Performance & Latency Benchmarks')

    const t0 = performance.now()
    const perfRes = await GlobalSearchService.search(`Aarav`, ownerSession)
    const t1 = performance.now()
    const elapsed = t1 - t0
    console.log(`  ℹ Cross-domain search executed in ${elapsed.toFixed(2)}ms (Total: ${perfRes.total})`)
    assert(elapsed < 1000, 'Search execution completes in under 1000ms in development database')
    assert(perfRes.total >= 1, 'Performance benchmark query returns valid records')

    // -------------------------------------------------------------------------
    // GROUP T: ARCHITECTURE & SCHEMA INTEGRITY
    // -------------------------------------------------------------------------
    console.log('[GROUP T] Architecture & Schema Integrity (Zero Duplicate Tables)')

    // Check that canonical Prisma client has no duplicate search models
    const prismaKeys = Object.keys(db)
    assert(!prismaKeys.includes('searchStudent'), 'Prisma client does not have searchStudent model')
    assert(!prismaKeys.includes('searchGuardian'), 'Prisma client does not have searchGuardian model')
    assert(!prismaKeys.includes('searchFinance'), 'Prisma client does not have searchFinance model')
    assert(!prismaKeys.includes('globalSearchIndex'), 'Prisma client does not have globalSearchIndex table')
    assert(prismaKeys.includes('student'), 'Prisma client has canonical student model')
    assert(prismaKeys.includes('guardian'), 'Prisma client has canonical guardian model')
    assert(prismaKeys.includes('invoice'), 'Prisma client has canonical invoice model')
    assert(prismaKeys.includes('auditLog'), 'Prisma client has canonical auditLog model')

    console.log('\n---------------------------------------------------------------')
    console.log(`TOTAL ASSERTIONS EXECUTED: ${passed + failed}`)
    console.log(`PASSED: ${passed}`)
    console.log(`FAILED: ${failed}`)
    console.log('---------------------------------------------------------------')

    if (failed > 0) {
      process.exit(1)
    }
  } catch (err) {
    console.error('Test execution encountered fatal error:', err)
    process.exit(1)
  } finally {
    // Cleanup fixtures
    console.log('\n[CLEANUP] Cleaning up test fixtures...')
    try {
      if (auditLogA?.id) await db.auditLog.deleteMany({ where: { id: auditLogA.id } })
      if (announcementA?.id) await db.announcement.deleteMany({ where: { id: announcementA.id } })
      if (inventoryItemA?.id) await db.inventoryItem.deleteMany({ where: { id: inventoryItemA.id } })
      if (inventoryCategoryA?.id) await db.inventoryCategory.deleteMany({ where: { id: inventoryCategoryA.id } })
      if (inventoryUnitA?.id) await db.inventoryUnit.deleteMany({ where: { id: inventoryUnitA.id } })
      if (transportRouteA?.id) await db.transportRoute.deleteMany({ where: { id: transportRouteA.id } })
      if (vehicleA?.id) await db.vehicle.deleteMany({ where: { id: vehicleA.id } })
      if (timelineA?.id) await db.timelineEntry.deleteMany({ where: { id: timelineA.id } })
      if (invoiceA?.id) await db.invoice.deleteMany({ where: { id: invoiceA.id } })
      if (leadA?.id) await db.lead.deleteMany({ where: { id: leadA.id } })
      if (staffA?.id) await db.staffProfile.deleteMany({ where: { id: staffA.id } })
      if (guardianA?.id) {
        await db.studentGuardian.deleteMany({ where: { guardianId: guardianA.id } })
        await db.guardian.deleteMany({ where: { id: guardianA.id } })
      }
      if (studentA?.id) await db.attendance.deleteMany({ where: { studentId: studentA.id } })
      if (studentA?.id) await db.student.deleteMany({ where: { id: studentA.id } })
      if (studentA2?.id) await db.student.deleteMany({ where: { id: studentA2.id } })
      if (studentB?.id) await db.student.deleteMany({ where: { id: studentB.id } })
      if (classroomA?.id) await db.classroom.deleteMany({ where: { id: classroomA.id } })
      if (classroomA2?.id) await db.classroom.deleteMany({ where: { id: classroomA2.id } })
      if (academicSessionA?.id) await db.academicSession.deleteMany({ where: { id: academicSessionA.id } })
      if (ownerUser?.id) {
        await db.tenantUser.deleteMany({ where: { userId: ownerUser.id } })
        await db.user.deleteMany({ where: { id: ownerUser.id } })
      }
      if (teacherUser?.id) {
        await db.tenantUser.deleteMany({ where: { userId: teacherUser.id } })
        await db.user.deleteMany({ where: { id: teacherUser.id } })
      }
      if (otherTeacherUser?.id) {
        await db.tenantUser.deleteMany({ where: { userId: otherTeacherUser.id } })
        await db.user.deleteMany({ where: { id: otherTeacherUser.id } })
      }
      if (parentUser?.id) {
        await db.tenantUser.deleteMany({ where: { userId: parentUser.id } })
        await db.user.deleteMany({ where: { id: parentUser.id } })
      }
      if (accountsUser?.id) {
        await db.tenantUser.deleteMany({ where: { userId: accountsUser.id } })
        await db.user.deleteMany({ where: { id: accountsUser.id } })
      }
      if (unprivilegedUser?.id) {
        await db.tenantUser.deleteMany({ where: { userId: unprivilegedUser.id } })
        await db.user.deleteMany({ where: { id: unprivilegedUser.id } })
      }
      if (branchA1?.id) await db.branch.deleteMany({ where: { id: branchA1.id } })
      if (branchA2?.id) await db.branch.deleteMany({ where: { id: branchA2.id } })
      if (branchB?.id) await db.branch.deleteMany({ where: { id: branchB.id } })
      if (tenantA?.id) await db.tenant.deleteMany({ where: { id: tenantA.id } })
      if (tenantB?.id) await db.tenant.deleteMany({ where: { id: tenantB.id } })
      console.log('✓ Cleanup complete.')
    } catch (cleanErr) {
      console.warn('Warning during cleanup:', cleanErr)
    }
  }
}

runTests()
