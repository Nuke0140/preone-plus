/**
 * PreOne — Daily Diary Module Architectural & E2E Acceptance Test Suite
 *
 * Verifies PR #3 implementation:
 * 1. Scope and Context Resolution (Admin vs Teacher)
 * 2. Classroom Scoping & Teacher Isolation Guard
 * 3. Daily Attendance Register (Batch Save & Query)
 * 4. Timetable / Classroom Activities (Create & Update)
 * 5. Observations Recording
 * 6. Daily Diary History Aggregation
 * 7. Admin School-Wide Overview & Role Access Control
 */

import { db } from '../src/lib/db'
import { DailyDiaryService } from '../src/lib/daily-diary/daily-diary-service'
import { SessionPayload } from '../src/lib/auth'

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
  console.log('PREONE DAILY DIARY MODULE: ARCHITECTURAL CERTIFICATION & E2E')
  console.log('===============================================================\n')

  const testSuffix = Date.now().toString().slice(-6)
  let tenant: any = null

  try {
    // -------------------------------------------------------------------------
    // SETUP: Tenant, Branch, Session, Classrooms, Teachers, Students
    // -------------------------------------------------------------------------
    tenant = await db.tenant.create({
      data: {
        code: `DD-SCH-${testSuffix}`,
        name: `Daily Diary Test School ${testSuffix}`,
        status: 'ACTIVE',
      },
    })

    const branch = await db.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'Main Campus',
        code: `MAIN-${testSuffix}`,
        isMain: true,
      },
    })

    const session = await db.academicSession.create({
      data: {
        tenantId: tenant.id,
        name: '2026-27',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2027-04-30'),
        status: 'ACTIVE',
        isCurrent: true,
      },
    })

    // Create Admin User
    const adminUser = await db.user.create({
      data: {
        email: `admin-${testSuffix}@test.com`,
        fullName: 'Admin User',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
        status: 'ACTIVE',
        memberships: {
          create: {
            tenantId: tenant.id,
            role: 'PRINCIPAL',
            roles: ['PRINCIPAL'],
            status: 'ACTIVE',
          },
        },
      },
    })

    // Create Teacher 1 (assigned to Class A)
    const teacher1 = await db.user.create({
      data: {
        email: `teacher1-${testSuffix}@test.com`,
        fullName: 'Pooja Teacher',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
        status: 'ACTIVE',
        memberships: {
          create: {
            tenantId: tenant.id,
            role: 'TEACHER',
            roles: ['TEACHER'],
            status: 'ACTIVE',
          },
        },
      },
    })

    // Create Teacher 2 (assigned to Class B)
    const teacher2 = await db.user.create({
      data: {
        email: `teacher2-${testSuffix}@test.com`,
        fullName: 'Rahul Teacher',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
        status: 'ACTIVE',
        memberships: {
          create: {
            tenantId: tenant.id,
            role: 'TEACHER',
            roles: ['TEACHER'],
            status: 'ACTIVE',
          },
        },
      },
    })

    // Create Class A & Class B
    const classA = await db.classroom.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        academicSessionId: session.id,
        name: 'Nursery Red',
        code: `NUR-RED-${testSuffix}`,
        programType: 'NURSERY',
        primaryTeacherId: teacher1.id,
        capacity: 20,
      },
    })

    const classB = await db.classroom.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        academicSessionId: session.id,
        name: 'Nursery Blue',
        code: `NUR-BLU-${testSuffix}`,
        programType: 'NURSERY',
        primaryTeacherId: teacher2.id,
        capacity: 20,
      },
    })

    // Create 2 Students in Class A
    const student1 = await db.student.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        firstName: 'Aarav',
        lastName: 'Sharma',
        dob: new Date('2022-04-15'),
        gender: 'MALE',
        admissionNo: `ADM-1-${testSuffix}`,
        currentClassroomId: classA.id,
        status: 'ACTIVE',
      },
    })

    const student2 = await db.student.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        firstName: 'Ananya',
        lastName: 'Patel',
        dob: new Date('2022-06-20'),
        gender: 'FEMALE',
        admissionNo: `ADM-2-${testSuffix}`,
        currentClassroomId: classA.id,
        status: 'ACTIVE',
      },
    })

    // Session payloads
    const adminSession: SessionPayload = {
      uid: adminUser.id,
      email: adminUser.email!,
      name: adminUser.fullName,
      role: 'PRINCIPAL',
      roles: ['PRINCIPAL', 'ADMIN'],
      tenantId: tenant.id,
      branchId: branch.id,
    }

    const teacher1Session: SessionPayload = {
      uid: teacher1.id,
      email: teacher1.email!,
      name: teacher1.fullName,
      role: 'TEACHER',
      roles: ['TEACHER'],
      tenantId: tenant.id,
      branchId: branch.id,
    }

    const teacher2Session: SessionPayload = {
      uid: teacher2.id,
      email: teacher2.email!,
      name: teacher2.fullName,
      role: 'TEACHER',
      roles: ['TEACHER'],
      tenantId: tenant.id,
      branchId: branch.id,
    }

    const todayStr = new Date().toISOString().split('T')[0]

    // -------------------------------------------------------------------------
    // TEST 1: CONTEXT RESOLUTION (ADMIN vs TEACHER SCOPE)
    // -------------------------------------------------------------------------
    console.log('[1] Context Resolution & Scoping')
    const adminCtx = await DailyDiaryService.getContext(adminSession)
    assert(adminCtx.classrooms.length === 2, 'Admin context sees all 2 classrooms')
    assert(adminCtx.teachers.length >= 2, 'Admin context sees teachers list for scheduling')
    assert(adminCtx.academicSession?.name === '2026-27', 'Context resolves current academic session')

    const teacher1Ctx = await DailyDiaryService.getContext(teacher1Session)
    assert(teacher1Ctx.classrooms.length === 1, 'Teacher context is scoped to assigned classrooms')
    assert(teacher1Ctx.classrooms[0].id === classA.id, 'Teacher 1 only sees Class A')
    assert(teacher1Ctx.teachers.length === 0, 'Teacher context does not expose admin teacher scheduling list')

    // -------------------------------------------------------------------------
    // TEST 2: CLASSROOM OVERVIEW & TEACHER ISOLATION
    // -------------------------------------------------------------------------
    console.log('\n[2] Classroom Overview & Teacher Isolation')
    const classAOverview = await DailyDiaryService.getOverview(teacher1Session, classA.id, todayStr)
    assert(classAOverview.classroom.name === 'Nursery Red', 'Teacher 1 retrieves Class A overview')
    assert(classAOverview.stats.totalStudents === 2, 'Class A reports 2 active students')
    assert(classAOverview.stats.unmarked === 2, 'Initially 2 students are unmarked')

    let teacherForbiddenCaught = false
    try {
      await DailyDiaryService.getOverview(teacher1Session, classB.id, todayStr)
    } catch (err: any) {
      if (err.message.includes('FORBIDDEN_TEACHER_CLASSROOM_ACCESS')) {
        teacherForbiddenCaught = true
      }
    }
    assert(teacherForbiddenCaught, 'Teacher 1 is strictly blocked from viewing Class B overview')

    // -------------------------------------------------------------------------
    // TEST 3: ATTENDANCE REGISTER & BATCH SAVING
    // -------------------------------------------------------------------------
    console.log('\n[3] Attendance Register & Batch Saving')
    const initialRegister = await DailyDiaryService.getAttendanceRegister(teacher1Session, classA.id, todayStr)
    assert(initialRegister.length === 2, 'Attendance register retrieves both students in Class A')

    // Batch save attendance: Aarav = PRESENT, Ananya = LATE
    const saveResult = await DailyDiaryService.saveAttendanceRegister(
      teacher1Session,
      classA.id,
      todayStr,
      [
        { studentId: student1.id, status: 'PRESENT', notes: 'Arrived on time' },
        { studentId: student2.id, status: 'LATE', notes: 'Arrived at 9:30 AM' },
      ]
    )
    assert(saveResult.count === 2, 'Saved 2 attendance records')

    const updatedOverview = await DailyDiaryService.getOverview(teacher1Session, classA.id, todayStr)
    assert(updatedOverview.stats.present === 1, 'Overview reports 1 present student')
    assert(updatedOverview.stats.late === 1, 'Overview reports 1 late student')
    assert(updatedOverview.stats.unmarked === 0, 'Overview reports 0 unmarked students')

    // Verify Teacher 2 cannot save attendance for Class A
    let teacher2BlockAttendance = false
    try {
      await DailyDiaryService.saveAttendanceRegister(
        teacher2Session,
        classA.id,
        todayStr,
        [{ studentId: student1.id, status: 'ABSENT' }]
      )
    } catch (err: any) {
      if (err.message.includes('FORBIDDEN_TEACHER_CLASSROOM_ACCESS')) {
        teacher2BlockAttendance = true
      }
    }
    assert(teacher2BlockAttendance, 'Teacher 2 is blocked from modifying Class A attendance')

    // -------------------------------------------------------------------------
    // TEST 4: TIMETABLE & CLASSROOM ACTIVITIES
    // -------------------------------------------------------------------------
    console.log('\n[4] Timetable & Activities (Create & Update)')
    const activity = await DailyDiaryService.createActivity(teacher1Session, {
      classroomId: classA.id,
      dateStr: todayStr,
      title: 'Morning Circle & Phonemic Rhymes',
      activityType: 'ACTIVITY',
      startTime: '09:00',
      endTime: '09:45',
      description: 'Singing phonics songs and introduction of letter S',
    })
    assert(activity.id !== undefined, 'Activity created successfully')
    assert(activity.activityType === 'ACTIVITY', 'Activity stores activityType')
    assert(activity.status === 'PLANNED', 'Default activity status is PLANNED')

    // Update activity status to COMPLETED
    const updatedActivity = await DailyDiaryService.updateActivity(teacher1Session, activity.id, {
      status: 'COMPLETED',
      notes: 'All children participated enthusiastically',
    })
    assert(updatedActivity.status === 'COMPLETED', 'Activity updated to COMPLETED')
    assert(updatedActivity.actualOutcome === 'All children participated enthusiastically', 'Actual outcome recorded')

    // -------------------------------------------------------------------------
    // TEST 5: OBSERVATIONS RECORDING
    // -------------------------------------------------------------------------
    console.log('\n[5] Observations Recording')
    const observation = await DailyDiaryService.createObservation(teacher1Session, {
      studentId: student1.id,
      classroomId: classA.id,
      narrative: 'Aarav demonstrated excellent hand-eye coordination during sensory play.',
      category: 'Motor Skills',
      concern: 'NORMAL',
      activityId: activity.id,
    })
    assert(observation.id !== undefined, 'Observation created successfully')
    assert(observation.narrative.includes('coordination'), 'Observation narrative saved')
    assert(observation.activityId === activity.id, 'Observation linked to activity')

    // -------------------------------------------------------------------------
    // TEST 6: DAILY DIARY HISTORY
    // -------------------------------------------------------------------------
    console.log('\n[6] Daily Diary History Aggregation')
    const history = await DailyDiaryService.getHistory(
      teacher1Session,
      classA.id,
      todayStr,
      todayStr
    )
    assert(history.attendance.length === 2, 'History includes 2 attendance entries')
    assert(history.activities.length === 1, 'History includes 1 activity entry')
    assert(history.observations.length === 1, 'History includes 1 observation entry')

    // -------------------------------------------------------------------------
    // TEST 7: ADMIN SCHOOL-WIDE COMMAND OVERVIEW
    // -------------------------------------------------------------------------
    console.log('\n[7] Admin School-Wide Command Overview')
    const adminOverview = await DailyDiaryService.getAdminSchoolOverview(adminSession, todayStr)
    assert(adminOverview.stats.totalClasses === 2, 'Admin overview monitors all 2 classes')
    assert(adminOverview.stats.totalStudents === 2, 'Admin overview aggregates 2 total students')
    assert(adminOverview.stats.present === 1, 'Admin overview aggregates 1 present student')
    assert(adminOverview.stats.late === 1, 'Admin overview aggregates 1 late student')
    assert(adminOverview.stats.totalActivities === 1, 'Admin overview aggregates 1 scheduled activity')

  } catch (err: any) {
    console.error('UNEXPECTED EXCEPTION:', err)
    failed++
  } finally {
    if (tenant) {
      console.log('\n[Teardown] Cleaning up test tenant...')
      try {
        await db.observation.deleteMany({ where: { tenantId: tenant.id } })
        await db.classroomActivity.deleteMany({ where: { tenantId: tenant.id } })
        await db.attendance.deleteMany({ where: { tenantId: tenant.id } })
        await db.student.deleteMany({ where: { tenantId: tenant.id } })
        await db.classroom.deleteMany({ where: { tenantId: tenant.id } })
        await db.academicSession.deleteMany({ where: { tenantId: tenant.id } })
        await db.tenantUser.deleteMany({ where: { tenantId: tenant.id } })
        await db.user.deleteMany({ where: { email: { contains: testSuffix } } })
        await db.branch.deleteMany({ where: { tenantId: tenant.id } })
        await db.tenant.delete({ where: { id: tenant.id } })
        console.log('Cleanup completed successfully.')
      } catch (cleanErr) {
        console.warn('Cleanup warning:', cleanErr)
      }
    }
  }

  console.log('\n===============================================================')
  console.log(`DAILY DIARY TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
  console.log('===============================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runTests()
