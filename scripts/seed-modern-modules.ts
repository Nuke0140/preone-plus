/**
 * PreOne Plus — Demo Seed for Modern School modules
 * (Homework, Health & Medical, Front Office, Events & Activities)
 * Seeds the Sunshine Kids Preschool tenant with realistic data via direct Prisma calls.
 * Run: DATABASE_URL=... bun scripts/seed-modern-modules.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const TENANT = '951b5049-83de-452f-97d6-37fb632c01de' // Sunshine Kids Preschool
const LKG_A = '5484951b-7d6c-449e-84e2-ca82a3baf7d6' // Jr KG Explorer — 8 students
const NUR_A = 'a08cb3ea-9d3b-44de-9738-ed45a64fc606' // Nursery Rainbow — 8 students

function daysAgo(n: number, h = 10): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(h, 0, 0, 0)
  return d
}
function daysAhead(n: number, h = 10): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(h, 0, 0, 0)
  return d
}

async function main() {
  console.log('── Resolving tenant context…')
  const teacher = await db.staffProfile.findFirst({
    where: { tenantId: TENANT, deletedAt: null },
    include: { user: true },
  })
  const teacherId = teacher?.userId ?? null
  const english = await db.subject.findFirst({ where: { tenantId: TENANT, code: 'ENG' } })
  const math = await db.subject.findFirst({ where: { tenantId: TENANT, code: 'MATH' } })
  const art = await db.subject.findFirst({ where: { tenantId: TENANT, code: 'ART' } })

  const lkgStudents = await db.student.findMany({
    where: { tenantId: TENANT, currentClassroomId: LKG_A, status: 'ACTIVE', deletedAt: null },
    orderBy: { firstName: 'asc' },
  })
  const nurStudents = await db.student.findMany({
    where: { tenantId: TENANT, currentClassroomId: NUR_A, status: 'ACTIVE', deletedAt: null },
    orderBy: { firstName: 'asc' },
  })
  const branch = await db.branch.findFirst({ where: { tenantId: TENANT, deletedAt: null } })
  console.log(`   LKG-A: ${lkgStudents.length} students, Nursery-A: ${nurStudents.length}, branch: ${branch?.name}`)

  // ── 1. Homework ──
  console.log('── Seeding homework…')
  const hwDefs = [
    { title: 'Trace A–Z practice sheet', subjectId: english?.id, dueDays: 2, estimated: 20, description: 'Complete the tracing worksheet shared in class. Parents: please sign at the bottom.' },
    { title: 'Count & write 1–50', subjectId: math?.id, dueDays: 1, estimated: 15, description: 'Write numbers 1 to 50 in the notebook. Circle all even numbers.' },
    { title: 'Fingerprint autumn tree', subjectId: art?.id, dueDays: 4, estimated: 30, description: 'Use any 3 colours to make leaves on the tree outline pasted in the activity book.' },
    { title: 'Rhyme recital — Rain Rain Go Away', subjectId: english?.id, dueDays: 3, estimated: 10, description: 'Practice the rhyme at home. Video submission optional.', status: 'CLOSED' as const },
  ]
  for (const hw of hwDefs) {
    const exists = await db.homework.findFirst({ where: { tenantId: TENANT, title: hw.title, deletedAt: null } })
    if (exists) continue
    const created = await db.homework.create({
      data: {
        tenantId: TENANT,
        classroomId: LKG_A,
        subjectId: hw.subjectId ?? null,
        teacherId,
        title: hw.title,
        description: hw.description,
        assignedDate: daysAgo(2),
        dueDate: daysAhead(hw.dueDays),
        estimatedMinutes: hw.estimated,
        status: hw.status ?? 'PUBLISHED',
      },
    })
    const subs = lkgStudents.map((s, idx) => ({
      tenantId: TENANT,
      homeworkId: created.id,
      studentId: s.id,
      // deterministic mix: most submitted, some pending, one late, some graded
      submittedAt: idx % 4 === 3 ? null : daysAgo(idx % 4),
      status: idx % 4 === 3 ? 'PENDING' : idx < 3 ? 'GRADED' : (idx === 5 && hw.dueDays === 1 ? 'LATE' : 'SUBMITTED'),
      grade: idx < 3 ? ['A', 'A+', 'B+'][idx] : null,
      feedback: idx < 3 ? ['Beautiful work!', 'Excellent tracing!', 'Nice effort'][idx] : null,
      gradedById: idx < 3 ? teacherId : null,
      gradedAt: idx < 3 ? daysAgo(1) : null,
    }))
    if (subs.length) await db.homeworkSubmission.createMany({ data: subs })
    console.log(`   ✓ ${hw.title} (${subs.length} submissions)`)
  }

  // ── 2. Health & Medical ──
  console.log('── Seeding health records…')
  const healthDefs = [
    { studentIdx: 0, type: 'ALLERGY' as const, summary: 'Peanut allergy — severe', details: 'Avoid all nut products. EpiPen kept with school nurse.', isChronic: true, days: -90 },
    { studentIdx: 1, type: 'MEDICAL_CONDITION' as const, summary: 'Mild asthma', details: 'Inhaler prescribed during sports period.', isChronic: true, days: -120 },
    { studentIdx: 2, type: 'CHECKUP' as const, summary: 'Annual health checkup — normal', details: 'Height 105cm, weight 17kg. Vision normal.', isChronic: false, days: -30 },
    { studentIdx: 3, type: 'VACCINATION' as const, summary: 'MMR booster administered', details: 'No adverse reaction observed.', isChronic: false, days: -60 },
    { studentIdx: 4, type: 'VISION' as const, summary: 'Squint detected — referral given', details: 'Referred to Dr. Mehta, pediatric ophthalmologist.', isChronic: false, days: -15 },
  ]
  for (const [i, h] of healthDefs.entries()) {
    const student = lkgStudents[h.studentIdx]
    if (!student) continue
    const exists = await db.healthRecord.findFirst({ where: { tenantId: TENANT, studentId: student.id, summary: h.summary } })
    if (exists) continue
    await db.healthRecord.create({
      data: {
        tenantId: TENANT,
        studentId: student.id,
        type: h.type,
        recordDate: daysAgo(-h.days * -1),
        summary: h.summary,
        details: h.details,
        doctorName: i % 2 === 0 ? 'Dr. Kavita Rao' : 'Dr. Sameer Mehta',
        clinicName: 'Sunshine Community Clinic',
        isChronic: h.isChronic,
      },
    })
    console.log(`   ✓ ${h.type} — ${student.firstName}`)
  }

  const visitDefs = [
    { studentIdx: 5, symptoms: 'Mild fever 99.2°F, headache', temp: 37.3, action: 'Rested 40 min in sick bay, water given', med: null, notified: true, days: 0, returned: true },
    { studentIdx: 6, symptoms: 'Stomach ache after lunch', temp: null, action: 'Called parent, student sent home', med: null, notified: true, days: 0, returned: false },
    { studentIdx: 7, symptoms: 'Scraped knee during play', temp: null, action: 'Antiseptic cleaned, bandage applied', med: null, notified: false, days: 2, returned: true },
  ]
  for (const v of visitDefs) {
    const student = lkgStudents[v.studentIdx]
    if (!student) continue
    const exists = await db.sickBayVisit.findFirst({ where: { tenantId: TENANT, studentId: student.id, symptoms: v.symptoms } })
    if (exists) continue
    await db.sickBayVisit.create({
      data: {
        tenantId: TENANT,
        studentId: student.id,
        visitDate: daysAgo(v.days, 11),
        symptoms: v.symptoms,
        temperatureC: v.temp,
        actionTaken: v.action,
        medicationGiven: v.med,
        parentNotified: v.notified,
        parentNotifiedAt: v.notified ? daysAgo(v.days, 11) : null,
        returnedToClassAt: v.returned ? daysAgo(v.days, 12) : null,
        recordedById: teacherId,
      },
    })
    console.log(`   ✓ Sick bay — ${student.firstName} (${v.returned ? 'returned' : 'still in sick bay'})`)
  }

  // ── 3. Front Office ──
  console.log('── Seeding front office…')
  const visitorDefs = [
    { name: 'Rakesh Kumar (DHL)', phone: '+91 98200 11223', org: 'DHL Express', purpose: 'Courier delivery — stationery order', meet: 'Admin office', badge: 'V-101', inAgo: 45, outAgo: 30 },
    { name: 'Mrs. Anjali Desai', phone: '+91 98330 44556', org: null, purpose: 'Parent meeting — Nursery admission enquiry', meet: 'Principal', badge: 'V-102', inAgo: 20, outAgo: null },
    { name: 'Sanjay Patil', phone: '+91 99870 77889', org: 'Bright Fire Safety', purpose: 'Fire extinguisher maintenance', meet: 'Facility manager', badge: 'V-103', inAgo: 90, outAgo: null },
  ]
  for (const v of visitorDefs) {
    const exists = await db.visitorLog.findFirst({ where: { tenantId: TENANT, visitorName: v.name, checkOutAt: v.outAgo ? { not: null } : null } })
    if (exists) continue
    const checkIn = new Date(Date.now() - v.inAgo * 60000)
    await db.visitorLog.create({
      data: {
        tenantId: TENANT,
        branchId: branch?.id,
        visitorName: v.name,
        visitorPhone: v.phone,
        organization: v.org,
        purpose: v.purpose,
        personToMeet: v.meet,
        badgeNumber: v.badge,
        checkInAt: checkIn,
        checkOutAt: v.outAgo ? new Date(Date.now() - v.outAgo * 60000) : null,
      },
    })
    console.log(`   ✓ Visitor — ${v.name}${v.outAgo ? '' : ' (on campus)'}`)
  }

  const gpDefs = [
    { studentIdx: 0, reason: 'Dental appointment — cannot be rescheduled', status: 'RETURNED' as const, guardian: 'Rohit Sharma (father)', days: 3 },
    { studentIdx: 1, reason: 'Family emergency — grandparent hospitalised', status: 'OUT' as const, guardian: 'Priya Iyer (mother)', days: 0 },
    { studentIdx: 2, reason: 'Doctor appointment for fever follow-up', status: 'REQUESTED' as const, guardian: 'Amit Verma (father)', days: 0 },
  ]
  for (const [i, g] of gpDefs.entries()) {
    const student = lkgStudents[g.studentIdx]
    if (!student) continue
    const exists = await db.gatePass.findFirst({ where: { tenantId: TENANT, studentId: student.id, reason: g.reason } })
    if (exists) continue
    const now = new Date()
    const prefix = `GP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`
    const last = await db.gatePass.findFirst({
      where: { tenantId: TENANT, passNumber: { startsWith: prefix } },
      orderBy: { passNumber: 'desc' },
    })
    const seq = last ? Number(last.passNumber.slice(prefix.length)) + 1 : i + 1
    await db.gatePass.create({
      data: {
        tenantId: TENANT,
        studentId: student.id,
        passNumber: `${prefix}${String(seq).padStart(4, '0')}`,
        reason: g.reason,
        guardianName: g.guardian,
        guardianPhone: '+91 90000 12345',
        status: g.status,
        outAt: ['OUT', 'RETURNED'].includes(g.status) ? daysAgo(g.days, 12) : null,
        createdAt: daysAgo(g.days, 11),
      },
    })
    console.log(`   ✓ Gate pass ${g.status} — ${student.firstName}`)
  }

  // ── 4. Events & Activities ──
  console.log('── Seeding events…')
  const eventDefs = [
    {
      title: 'Annual Sports Day 2026', type: 'SPORTS' as const, venue: 'Main ground',
      days: 12, capacity: 100, reg: true, audience: 'ALL',
      description: 'Track races, mini-marathon for parents, and the much-awaited tug-of-war finals.',
    },
    {
      title: 'Little Stars — Cultural Fest', type: 'CULTURAL' as const, venue: 'School auditorium',
      days: 20, capacity: null, reg: false, audience: 'PARENTS',
      description: 'Dance, drama and music performances by Nursery & Jr KG. Invitations will be shared.',
    },
    {
      title: 'Nature Trail — Botanical Garden Trip', type: 'TRIP' as const, venue: 'City Botanical Garden',
      days: 7, capacity: 30, reg: true, audience: 'STUDENTS',
      description: 'Guided nature walk + picnic. Buses depart 9 AM sharp. Consent forms required.',
    },
    {
      title: 'Colouring Competition — Fruits', type: 'COMPETITION' as const, venue: 'Activity room',
      days: 5, capacity: 40, reg: true, audience: 'STUDENTS',
      description: 'Theme: healthy fruits. Crayons provided by school.',
    },
    {
      title: 'Parent-Teacher Meeting (Term 1)', type: 'MEETING' as const, venue: 'Respective classrooms',
      days: -8, capacity: null, reg: false, audience: 'PARENTS',
      description: 'Term 1 report card discussion with class teachers.',
    },
  ]
  for (const ev of eventDefs) {
    const exists = await db.schoolEvent.findFirst({ where: { tenantId: TENANT, title: ev.title, deletedAt: null } })
    if (exists) continue
    const isPast = ev.days < 0
    const created = await db.schoolEvent.create({
      data: {
        tenantId: TENANT,
        branchId: branch?.id,
        title: ev.title,
        type: ev.type,
        description: ev.description,
        venue: ev.venue,
        startsAt: daysAhead(ev.days, 9),
        endsAt: daysAhead(ev.days, 13),
        audience: ev.audience,
        capacity: ev.capacity,
        registrationRequired: ev.reg,
        status: isPast ? 'COMPLETED' : 'SCHEDULED',
      },
    })
    if (ev.reg) {
      // register first 4 LKG students; for full event (capacity small) last one waitlisted
      for (let i = 0; i < Math.min(4, lkgStudents.length); i++) {
        const waitlist = ev.capacity === 30 && i >= 3
        await db.eventRegistration.create({
          data: {
            tenantId: TENANT,
            eventId: created.id,
            studentId: lkgStudents[i].id,
            status: isPast ? (i < 3 ? 'ATTENDED' : 'ABSENT') : waitlist ? 'WAITLISTED' : 'REGISTERED',
          },
        })
      }
    }
    console.log(`   ✓ ${ev.title}${isPast ? ' (completed)' : ''}`)
  }

  console.log('✅ Modern modules seed complete')
  console.log('   → 4 homework items with submissions (graded/submitted/late/pending)')
  console.log('   → 5 health records (2 chronic alerts) + 3 sick-bay visits')
  console.log('   → 3 visitors (2 on campus) + 3 gate passes (all states)')
  console.log('   → 5 events (4 upcoming incl. trip with waitlist, 1 completed)')
}

main()
  .catch((e) => { console.error('Seed failed:', e.message); process.exit(1) })
  .finally(() => db.$disconnect())
