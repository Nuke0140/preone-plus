/**
 * PreOne Plus — Demo Seed for new modules (Exams, Timetable, Library, Hostel)
 * Seeds the Sunshine Kids Preschool tenant with realistic data via direct Prisma calls.
 * Run: DATABASE_URL=... bun scripts/seed-preone-plus.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const TENANT = '951b5049-83de-452f-97d6-37fb632c01de' // Sunshine Kids Preschool
const SESSION = '80251e0b-6516-4e92-9ccb-464b93dc9e00' // 2026-27 (current)
const LKG_A = '5484951b-7d6c-449e-84e2-ca82a3baf7d6' // Jr KG Explorer — 8 students
const NUR_A = 'a08cb3ea-9d3b-44de-9738-ed45a64fc606' // Nursery Rainbow — 8 students
const BRANCH = 'd54a5ed4-0163-4d0f-b900-a1f2b06c9f95' // will resolve dynamically

function grade(pct: number): string {
  if (pct >= 90) return 'A+'
  if (pct >= 80) return 'A'
  if (pct >= 70) return 'B+'
  if (pct >= 60) return 'B'
  if (pct >= 50) return 'C'
  if (pct >= 40) return 'D'
  return 'F'
}

async function main() {
  console.log('── Resolving tenant context…')
  const branch = await db.branch.findFirst({ where: { tenantId: TENANT, deletedAt: null } })
  if (!branch) throw new Error('No branch found')
  const teacherUser = await db.staffProfile.findFirst({
    where: { tenantId: TENANT, deletedAt: null },
    include: { user: true },
  })

  // ── 1. Subjects ──
  console.log('── Seeding subjects…')
  const subjectDefs = [
    { code: 'ENG', name: 'English', shortName: 'Eng' },
    { code: 'MATH', name: 'Mathematics', shortName: 'Math' },
    { code: 'EVS', name: 'Environmental Studies', shortName: 'EVS' },
    { code: 'ART', name: 'Art & Craft', shortName: 'Art' },
    { code: 'MUSIC', name: 'Music & Rhymes', shortName: 'Music' },
  ]
  const subjects: any[] = []
  for (const s of subjectDefs) {
    const existing = await db.subject.findUnique({ where: { tenantId_code: { tenantId: TENANT, code: s.code } } })
    subjects.push(existing || await db.subject.create({
      data: { tenantId: TENANT, ...s, subjectType: s.code === 'ART' || s.code === 'MUSIC' ? 'ACTIVITY' : 'CORE' },
    }))
  }

  // ── 2. Exam + schedules + marks + report cards ──
  console.log('── Seeding exam cycle…')
  let exam = await db.exam.findUnique({ where: { tenantId_code: { tenantId: TENANT, code: 'TERM1-26' } } })
  if (!exam) {
    exam = await db.exam.create({
      data: {
        tenantId: TENANT, academicSessionId: SESSION,
        name: 'Term 1 Assessment', code: 'TERM1-26',
        examType: 'QUARTERLY', status: 'SCHEDULED',
        startDate: new Date('2026-09-14'), endDate: new Date('2026-09-18'),
        description: 'First quarterly assessment for academic year 2026-27',
      },
    })
  }
  const examSubjects = subjects.slice(0, 3) // English, Math, EVS
  const schedules: any[] = []
  for (let i = 0; i < examSubjects.length; i++) {
    const s = examSubjects[i]
    const existing = await db.examSchedule.findUnique({
      where: { examId_classroomId_subjectId: { examId: exam.id, classroomId: LKG_A, subjectId: s.id } },
    })
    if (existing) { schedules.push(existing); continue }
    schedules.push(await db.examSchedule.create({
      data: {
        tenantId: TENANT, examId: exam.id, classroomId: LKG_A, subjectId: s.id,
        examDate: new Date(`2026-09-1${4 + i}`),
        startTime: i % 2 === 0 ? '09:30' : '10:30', endTime: i % 2 === 0 ? '10:30' : '11:30',
        maxMarks: 50, passingMarks: 20,
        invigilatorId: teacherUser?.userId ?? null,
      },
    }))
  }

  const lkgStudents = await db.student.findMany({
    where: { tenantId: TENANT, currentClassroomId: LKG_A, status: 'ACTIVE', deletedAt: null },
    orderBy: { firstName: 'asc' },
  })
  console.log(`   LKG-A students: ${lkgStudents.length}`)

  // deterministic pseudo-random marks per student/subject
  const seededMarksCount = await db.examMark.count({ where: { tenantId: TENANT, scheduleId: { in: schedules.map((s) => s.id) } } })
  if (seededMarksCount === 0 && lkgStudents.length > 0) {
    console.log('── Entering marks…')
    lkgStudents.forEach((student, si) => {
      // one student (last) is absent in EVS to demo the flow
    })
    for (let si = 0; si < lkgStudents.length; si++) {
      for (let mi = 0; mi < schedules.length; mi++) {
        const isAbsent = si === lkgStudents.length - 1 && mi === 2
        const base = 25 + ((si * 7 + mi * 13) % 22) // 25..46 of 50
        const pct = base / 50 * 100
        await db.examMark.upsert({
          where: { scheduleId_studentId: { scheduleId: schedules[mi].id, studentId: lkgStudents[si].id } },
          create: {
            tenantId: TENANT, scheduleId: schedules[mi].id, studentId: lkgStudents[si].id,
            marksObtained: isAbsent ? null : base, grade: isAbsent ? null : grade(pct),
            isAbsent, remarks: isAbsent ? 'Medical leave' : null,
          },
          update: {},
        })
      }
    }
  }

  const cardsCount = await db.reportCard.count({ where: { tenantId: TENANT, examId: exam.id } })
  if (cardsCount === 0 && lkgStudents.length > 0) {
    console.log('── Generating report cards…')
    const totalMax = schedules.reduce((sum, s) => sum + s.maxMarks.toNumber(), 0)
    const rows: any[] = []
    for (const student of lkgStudents) {
      const marks = await db.examMark.findMany({ where: { tenantId: TENANT, scheduleId: { in: schedules.map((s) => s.id) }, studentId: student.id } })
      if (marks.length === 0) continue
      let obtained = 0, failed = false
      for (const m of marks) {
        const sched = schedules.find((s) => s.id === m.scheduleId)!
        if (m.isAbsent || m.marksObtained == null) { failed = true; continue }
        obtained += m.marksObtained.toNumber()
        if (m.marksObtained.toNumber() < sched.passingMarks.toNumber()) failed = true
      }
      rows.push({ studentId: student.id, obtained, failed })
    }
    rows.sort((a, b) => b.obtained - a.obtained)
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const pct = (r.obtained / totalMax) * 100
      const rank = i > 0 && rows[i - 1].obtained === r.obtained ? null : i + 1
      await db.reportCard.upsert({
        where: { studentId_examId: { studentId: r.studentId, examId: exam.id } },
        create: {
          tenantId: TENANT, studentId: r.studentId, examId: exam.id, classroomId: LKG_A,
          totalMarks: totalMax, obtainedMarks: r.obtained,
          percentage: Math.round(pct * 100) / 100, grade: grade(pct), rank: rank ?? i,
          result: r.failed ? 'FAIL' : 'PASS',
          remarks: pct >= 85 ? 'Excellent performance!' : pct >= 70 ? 'Good progress' : 'Keep practising',
        },
        update: {},
      })
    }
    await db.exam.update({ where: { id: exam.id }, data: { status: 'COMPLETED' } })
  }

  // ── 3. Timetable for LKG-A ──
  console.log('── Seeding timetable…')
  const existingSlots = await db.timetableSlot.count({ where: { tenantId: TENANT, classroomId: LKG_A } })
  if (existingSlots === 0) {
    const dayPlan = [
      { p: 1, start: '08:30', end: '09:10', subject: 'ENG' },
      { p: 2, start: '09:10', end: '09:50', subject: 'MATH' },
      { p: 3, start: '09:50', end: '10:30', subject: 'EVS' },
      { p: 4, start: '10:30', end: '11:00', label: 'Lunch Break' },
      { p: 5, start: '11:00', end: '11:40', subject: 'ART' },
      { p: 6, start: '11:40', end: '12:20', subject: 'MUSIC' },
    ]
    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']
    const teacherPool = await db.staffProfile.findMany({
      where: { tenantId: TENANT, deletedAt: null },
      include: { user: true },
      take: 4,
    })
    for (const day of days) {
      for (const dp of dayPlan) {
        const subject = subjects.find((s) => s.code === dp.subject)
        // rotate teachers per period to avoid conflicts
        const teacher = teacherPool[(dp.p + days.indexOf(day)) % Math.max(teacherPool.length, 1)] ?? null
        await db.timetableSlot.upsert({
          where: { classroomId_day_periodNumber: { classroomId: LKG_A, day: day as any, periodNumber: dp.p } },
          create: {
            tenantId: TENANT, academicSessionId: SESSION, classroomId: LKG_A,
            day: day as any, periodNumber: dp.p,
            startTime: dp.start, endTime: dp.end,
            subjectId: subject?.id ?? null, teacherId: teacher?.userId ?? null,
            label: dp.label ?? null,
          },
          update: {},
        })
      }
    }
  }

  // ── 4. Library ──
  console.log('── Seeding library…')
  const booksCount = await db.book.count({ where: { tenantId: TENANT } })
  if (booksCount === 0) {
    const bookDefs = [
      { title: 'The Very Hungry Caterpillar', author: 'Eric Carle', category: 'Story Books', totalCopies: 4, shelfLocation: 'A-01', priceCents: 29900 },
      { title: 'Chicka Chicka Boom Boom', author: 'Bill Martin Jr.', category: 'Story Books', totalCopies: 3, shelfLocation: 'A-02', priceCents: 24900 },
      { title: 'Brown Bear, Brown Bear', author: 'Bill Martin Jr.', category: 'Story Books', totalCopies: 2, shelfLocation: 'A-03', priceCents: 24900 },
      { title: 'My First Math Workbook', author: 'Penguin Early Learning', category: 'Activity', totalCopies: 10, shelfLocation: 'B-01', priceCents: 19900 },
      { title: 'ABC Tracing & Colouring', author: 'Penguin Early Learning', category: 'Activity', totalCopies: 8, shelfLocation: 'B-02', priceCents: 14900 },
      { title: 'Wheels on the Bus — Sing Along', author: 'Raffi', category: 'Rhymes', totalCopies: 3, shelfLocation: 'C-01', priceCents: 17900 },
      { title: 'Little Kids First Big Book of Animals', author: 'National Geographic', category: 'General Knowledge', totalCopies: 5, shelfLocation: 'D-01', priceCents: 39900 },
      { title: 'Panchatantra Tales (Illustrated)', author: 'Vishnu Sharma', category: 'Story Books', totalCopies: 6, shelfLocation: 'A-04', priceCents: 22900 },
    ]
    const created: any[] = []
    for (const b of bookDefs) {
      created.push(await db.book.create({
        data: { tenantId: TENANT, ...b, availableCopies: b.totalCopies },
      }))
    }
    // issue 2 books to first two students
    const issuers = await db.user.findFirst({ where: { memberships: { some: { tenantId: TENANT, role: 'OWNER' } } } })
    if (lkgStudents.length >= 2) {
      await db.bookIssue.create({
        data: {
          tenantId: TENANT, bookId: created[0].id, studentId: lkgStudents[0].id,
          issuedById: issuers?.id, dueDate: new Date(Date.now() + 7 * 864e5), status: 'ISSUED',
        },
      })
      await db.book.update({ where: { id: created[0].id }, data: { availableCopies: { decrement: 1 } } })
      await db.bookIssue.create({
        data: {
          tenantId: TENANT, bookId: created[3].id, studentId: lkgStudents[1].id,
          issuedById: issuers?.id, dueDate: new Date(Date.now() - 3 * 864e5), status: 'OVERDUE',
        },
      })
      await db.book.update({ where: { id: created[3].id }, data: { availableCopies: { decrement: 1 } } })
    }
  }

  // ── 5. Hostel ──
  console.log('── Seeding hostel…')
  const roomsCount = await db.hostelRoom.count({ where: { tenantId: TENANT } })
  if (roomsCount === 0) {
    const roomDefs = [
      { roomNumber: '101', block: 'A — Sunflower Wing', floor: 'Ground', roomType: 'SHARING', capacity: 4, monthlyFeeCents: 350000 },
      { roomNumber: '102', block: 'A — Sunflower Wing', floor: 'Ground', roomType: 'SHARING', capacity: 4, monthlyFeeCents: 350000 },
      { roomNumber: '103', block: 'A — Sunflower Wing', floor: 'First', roomType: 'SHARING', capacity: 3, monthlyFeeCents: 350000 },
      { roomNumber: '201', block: 'B — Tulip Wing', floor: 'First', roomType: 'DORMITORY', capacity: 8, monthlyFeeCents: 250000 },
      { roomNumber: '301', block: 'B — Tulip Wing', floor: 'Second', roomType: 'PRIVATE', capacity: 1, monthlyFeeCents: 600000 },
    ]
    const rooms: any[] = []
    for (const r of roomDefs) {
      rooms.push(await db.hostelRoom.create({ data: { tenantId: TENANT, branchId: branch.id, ...r } }))
    }
    // allocate first 3 students
    for (let i = 0; i < Math.min(3, lkgStudents.length); i++) {
      const room = rooms[i % 2]
      await db.hostelAllocation.create({
        data: { tenantId: TENANT, roomId: room.id, studentId: lkgStudents[i].id, bedNumber: `B${i + 1}`, status: 'ACTIVE' },
      })
      await db.hostelRoom.update({ where: { id: room.id }, data: { occupied: { increment: 1 } } })
    }
  }

  console.log('✅ PreOne Plus seed complete')
  console.log('   → Exam "Term 1 Assessment" with 3 schedules, marks & report cards (LKG-A)')
  console.log('   → Weekly timetable for LKG-A (6 periods × 5 days)')
  console.log('   → 8 library books, 2 active issues (1 overdue)')
  console.log('   → 5 hostel rooms, 3 active residents')
}

main()
  .catch((e) => { console.error('Seed failed:', e.message); process.exit(1) })
  .finally(() => db.$disconnect())
