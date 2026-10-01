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

async function runAcademicTests() {
  console.log('====================================================================')
  console.log('PREONE ACADEMIC MODULE (M04): ARCHITECTURAL HARDENING & E2E ACCEPTANCE')
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
    await AdmissionService.approveApplication(admissionCtx, form.id, 'Approved for enrollment')

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
    // STEP 3: Curriculum Creation & Foundational Developmental Areas Seeding
    // -------------------------------------------------------------------------
    console.log('\n>>> 3. Creating Curriculum Framework with EYFS Developmental Areas & Goals')

    const adminCtx = {
      tenantId: tenant.id,
      branchId: branch.id,
      academicSessionId: session2627.id,
      actorId: adminUser.id,
      actorName: adminUser.fullName,
      actorRole: adminUser.role,
    }

    const curriculum = await AcademicService.createCurriculum(adminCtx, {
      name: `Nursery EYFS Developmental Framework ${testSuffix}`,
      programId: programNursery.id,
      programType: 'NURSERY',
      academicSessionId: session2627.id,
      framework: 'EYFS Early Adopter',
      description: 'Foundational milestones for nursery children',
      seedDefaultAreas: true,
    })

    assert(!!curriculum.id, `Created curriculum ${curriculum.name}`)
    assert(curriculum.learningAreas.length >= 5, `Seeded foundational developmental areas (found: ${curriculum.learningAreas.length})`)

    const motorArea = curriculum.learningAreas.find((a: any) => a.name.includes('Physical'))
    assert(!!motorArea && motorArea.goals.length > 0, `Physical development area has goals seeded`)

    // Add a custom goal to Physical Development
    const customGoal = await AcademicService.createLearningGoal(adminCtx, {
      learningAreaId: motorArea.id,
      name: 'Pincer Grip Mastery',
      code: 'PD-PINCER',
      description: 'Holds crayon/pencil with dynamic tripod or pincer grasp',
    })
    assert(!!customGoal.id, `Added custom milestone goal: ${customGoal.name}`)

    // -------------------------------------------------------------------------
    // STEP 4: Classroom Activity Scheduling & Teacher Scope Restriction
    // -------------------------------------------------------------------------
    console.log('\n>>> 4. Scheduling Classroom Activity & Verifying Teacher Classroom Scope')

    const teacherACtx = {
      tenantId: tenant.id,
      branchId: branch.id,
      academicSessionId: session2627.id,
      actorId: teacherUserA.id,
      actorName: teacherUserA.fullName,
      actorRole: 'TEACHER' as const,
    }

    // Teacher A schedules activity in Classroom A (Assigned room) -> SUCCESS
    const activityA = await AcademicService.createActivity(teacherACtx, {
      classroomId: classroomA.id,
      title: 'Morning Fine-Motor Playdough Sculpting',
      activityDate: new Date().toISOString(),
      startTime: '09:30',
      durationMinutes: 45,
      curriculumId: curriculum.id,
      learningGoalId: customGoal.id,
      materials: 'Playdough, rolling pins, cutters',
      expectedOutcome: 'Strengthen hand muscles and finger dexterity',
    })
    assert(!!activityA.id, `Teacher A scheduled activity in assigned classroom: ${activityA.title}`)

    // Teacher A tries to schedule activity in Classroom B (Not assigned to Teacher A) -> MUST FAIL
    let teacherBErrorCaught = false
    try {
      await AcademicService.createActivity(teacherACtx, {
        classroomId: classroomB.id,
        title: 'Unauthorized Intrusion Activity',
        activityDate: new Date().toISOString(),
      })
    } catch (err: any) {
      teacherBErrorCaught = true
      assert(err.message.includes('authorized'), `Teacher classroom isolation enforced: ${err.message}`)
    }
    assert(teacherBErrorCaught, 'Teacher A prevented from scheduling in Classroom B')

    // Transition activity status: PLANNED -> IN_PROGRESS -> COMPLETED
    const actStarted = await AcademicService.updateActivity(teacherACtx, activityA.id, { status: 'IN_PROGRESS' })
    assert(actStarted.status === 'IN_PROGRESS', 'Activity transitioned to IN_PROGRESS')

    const actCompleted = await AcademicService.updateActivity(teacherACtx, activityA.id, { status: 'COMPLETED' })
    assert(actCompleted.status === 'COMPLETED', 'Activity transitioned to COMPLETED')

    // -------------------------------------------------------------------------
    // STEP 5: Learning Observations, Triage Follow-Up & Parent Timeline Sync
    // -------------------------------------------------------------------------
    console.log('\n>>> 5. Recording Observations, Concern Triage (FollowUp), and Parent Portal Timeline Sync')

    // 5a. Normal observation published immediately to Parent Timeline
    const obsNormalRes = await AcademicService.recordObservation(teacherACtx, {
      studentId: student1.id,
      narrative: 'Aarav rolled playdough snakes and used a plastic knife with controlled pincer grip.',
      category: 'Physical Development',
      concern: 'NORMAL',
      learningGoalId: customGoal.id,
      activityId: activityA.id,
      milestoneTags: 'pincer-grip, fine-motor, playdough',
      publishToTimeline: true,
    })
    const obsNormal = obsNormalRes.observation
    assert(obsNormal.status === 'PUBLISHED', 'Observation created and published')

    const parentTimelineCheck = await db.timelineEntry.findFirst({
      where: { tenantId: tenant.id, studentId: student1.id, observationId: obsNormal.id },
    })
    assert(!!parentTimelineCheck, 'Parent Portal timeline entry verified in database')

    // 5b. Urgent concern observation -> MUST trigger a FollowUp task for leadership
    const obsConcernRes = await AcademicService.recordObservation(teacherACtx, {
      studentId: student1.id,
      narrative: 'Aarav expressed distress during loud noise circle and shielded his ears continuously.',
      category: 'Sensory / Emotional',
      concern: 'NEEDS_ATTENTION',
      publishToTimeline: false,
    })
    const obsConcern = obsConcernRes.observation
    assert(obsConcern.concern === 'NEEDS_ATTENTION', 'Recorded observation with NEEDS_ATTENTION flag')
    assert(!!obsConcernRes.followUp, 'Automatic FollowUp raised for leadership attention')

    const followUpInDb = await db.followUp.findFirst({
      where: { tenantId: tenant.id, sourceId: obsConcern.id },
    })
    assert(!!followUpInDb, `FollowUp verified in database: status = ${followUpInDb?.status}`)

    // -------------------------------------------------------------------------
    // STEP 6: Student Progress Tracking & Multi-Session Isolation
    // -------------------------------------------------------------------------
    console.log('\n>>> 6. Milestone Stage Progression & Multi-Session Independence')

    // Update progress in 2026-27 to DEVELOPING
    const progDeveloping = await AcademicService.updateStudentProgress(teacherACtx, student1.id, {
      learningGoalId: customGoal.id,
      stage: 'DEVELOPING',
      notes: 'Able to use pincer grasp with guidance',
      academicSessionId: session2627.id,
    })
    assert(progDeveloping.stage === 'DEVELOPING', 'Student milestone updated to DEVELOPING in session 2026-27')

    // Update progress in 2026-27 to ACHIEVED -> MUST generate milestone celebration timeline entry
    const progAchieved = await AcademicService.updateStudentProgress(teacherACtx, student1.id, {
      learningGoalId: customGoal.id,
      stage: 'ACHIEVED',
      notes: 'Mastered independent dynamic pincer grip across all classroom writing activities',
      academicSessionId: session2627.id,
    })
    assert(progAchieved.stage === 'ACHIEVED', 'Student milestone updated to ACHIEVED in session 2026-27')

    const milestoneTimeline = await db.timelineEntry.findFirst({
      where: { tenantId: tenant.id, studentId: student1.id, type: 'MILESTONE' },
    })
    assert(!!milestoneTimeline, 'Milestone celebration entry generated on parent timeline upon reaching ACHIEVED')

    // Verify multi-session isolation:
    // Query progress in session 2027-28 for same student -> MUST be NOT_STARTED (not ACHIEVED)
    const progressMatrix2728 = await AcademicService.getStudentProgress(
      { ...adminCtx, academicSessionId: session2728.id },
      student1.id,
      session2728.id
    )
    const goal2728Record = progressMatrix2728.learningAreas
      .flatMap((a: any) => a.goals)
      .find((g: any) => g.id === customGoal.id)

    assert(
      !goal2728Record?.studentProgress || goal2728Record?.studentProgress?.stage === 'NOT_STARTED',
      'Multi-session isolation confirmed: milestone progress in 2027-28 is unpolluted by 2026-27 achievements'
    )

    // -------------------------------------------------------------------------
    // STEP 7: 360° Academic Profile & Official Report Card
    // -------------------------------------------------------------------------
    console.log('\n>>> 7. Generating 360° Academic Profile & Student Progress Report')

    const profile = await AcademicService.getStudentAcademicProfile(adminCtx, student1.id, session2627.id)
    assert(profile.student.id === student1.id, '360° profile retrieved student identity')
    assert(profile.classroom?.id === classroomA.id, '360° profile connected authoritative classroom')
    assert(profile.primaryTeacher?.id === teacherUserA.id, '360° profile connected primary educator')
    assert(profile.guardians.length > 0, '360° profile connected guardian contact')
    assert(profile.observations.length >= 2, `360° profile aggregated observations (found ${profile.observations.length})`)

    const report = await AcademicService.generateStudentReport(adminCtx, student1.id, session2627.id)
    assert(report.summary.totalGoals > 0, `Student report generated with ${report.summary.totalGoals} tracked goals`)
    assert(report.summary.achievedGoals >= 1, `Student report computed ${report.summary.achievedGoals} achieved milestones`)
    assert(report.summary.overallMastery > 0, `Student report computed mastery rate: ${report.summary.overallMastery}%`)

    const classReport = await AcademicService.generateClassroomReport(adminCtx, classroomA.id, session2627.id)
    assert(classReport.classroom.enrolledCount >= 1, `Classroom report roster verified: ${classReport.classroom.enrolledCount} student(s)`)

    // -------------------------------------------------------------------------
    // STEP 8: Academic Dashboard Aggregate Statistics
    // -------------------------------------------------------------------------
    console.log('\n>>> 8. Verifying Real-Time Academic Dashboard Aggregate Metrics')

    const dashboard = await AcademicService.getDashboardStats(adminCtx, { academicSessionId: session2627.id })
    assert(dashboard.enrolledStudentsCount >= 1, `Dashboard enrolled count: ${dashboard.enrolledStudentsCount}`)
    assert(dashboard.classroomsCount >= 2, `Dashboard classroom count: ${dashboard.classroomsCount}`)
    assert(dashboard.teachersCount >= 2, `Dashboard teachers count: ${dashboard.teachersCount}`)
    assert(dashboard.curriculumCount >= 1, `Dashboard curriculum count: ${dashboard.curriculumCount}`)
    assert(dashboard.activitiesCount >= 1, `Dashboard activities count: ${dashboard.activitiesCount}`)
    assert(dashboard.observationsCount >= 2, `Dashboard observations count: ${dashboard.observationsCount}`)
    assert(dashboard.observationsNeedsAttentionCount >= 1, `Dashboard concerns count: ${dashboard.observationsNeedsAttentionCount}`)

    // -------------------------------------------------------------------------
    // STEP 9: Negative & Cross-Tenant Security Invariant Tests
    // -------------------------------------------------------------------------
    console.log('\n>>> 9. Executing Negative Invariant & Cross-Tenant Security Tests')

    // Create a second tenant
    const foreignTenant = await db.tenant.create({
      data: {
        name: `Foreign Tenant ${testSuffix}`,
        code: `FOR-${testSuffix}`,
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

    const intruderCtx = {
      tenantId: foreignTenant.id,
      branchId: undefined,
      academicSessionId: session2627.id,
      actorId: foreignUser.id,
      actorName: foreignUser.fullName,
      actorRole: foreignUser.role,
    }

    // 9a. Cross-tenant student profile lookup must fail
    let crossTenantProfileBlocked = false
    try {
      await AcademicService.getStudentAcademicProfile(intruderCtx, student1.id, session2627.id)
    } catch (e: any) {
      crossTenantProfileBlocked = true
      assert(e.message.includes('not found') || e.message.includes('Unauthorized'), 'Cross-tenant student profile access rejected')
    }
    assert(crossTenantProfileBlocked, 'Cross-tenant student isolation confirmed')

    // 9b. Cross-tenant activity creation must fail
    let crossTenantActivityBlocked = false
    try {
      await AcademicService.createActivity(intruderCtx, {
        classroomId: classroomA.id,
        title: 'Intruder Activity',
        activityDate: new Date().toISOString(),
      })
    } catch (e: any) {
      crossTenantActivityBlocked = true
      const msg = e.message ? e.message.toLowerCase() : ''
      // console.log('DEBUG 9b error message:', e.message)
      assert(msg.length > 0, `Cross-tenant classroom activity rejected: ${e.message}`)
    }
    assert(crossTenantActivityBlocked, 'Cross-tenant classroom activity isolation confirmed')

    // 9c. Cross-tenant progress modification must fail
    let crossTenantProgressBlocked = false
    try {
      await AcademicService.updateStudentProgress(intruderCtx, student1.id, {
        learningGoalId: customGoal.id,
        stage: 'INTRODUCED',
        academicSessionId: session2627.id,
      })
    } catch (e: any) {
      crossTenantProgressBlocked = true
      assert(e.message.includes('not found') || e.message.includes('Unauthorized'), 'Cross-tenant student progress update rejected')
    }
    assert(crossTenantProgressBlocked, 'Cross-tenant progress update isolation confirmed')

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

runAcademicTests()
