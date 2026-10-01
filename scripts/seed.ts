/**
 * PreOne seed — demo tenant "Sunshine Kids Preschool"
 * Users for all 8 roles, 3 classrooms, 24 students, attendance (7 days),
 * fee plans, invoices, payments+receipts, announcements, observations, timeline, leads, applications.
 * Password for ALL demo users: Preone@123
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { sanitizeUsernameSlug } from '../src/lib/users/username-service'

const db = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.PREONE_PG_URL ||
        process.env.DATABASE_URL ||
        process.env.POSTGRES_URL ||
        'postgresql://preone:preone@127.0.0.1:54329/preone',
    },
  },
})

const PASSWORD = 'Preone@123'

function daysAgo(n: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d
}

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function pick<T>(arr: T[], n: number): T[] {
  const copy = [...arr]
  const out: T[] = []
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]!)
  }
  return out
}

async function main() {
  console.log('🌱 Seeding PreOne demo data…')

  // clean slate (idempotent re-run)
  try {
    await db.$executeRawUnsafe('TRUNCATE TABLE "tenants", "users" CASCADE;')
  } catch {
    await db.$transaction([
      db.auditLog.deleteMany(), db.timelineEntry.deleteMany(), db.observation.deleteMany(),
      db.announcement.deleteMany(), db.receipt.deleteMany(), db.payment.deleteMany(),
      db.invoiceItem.deleteMany(), db.invoice.deleteMany(), db.feePlanItem.deleteMany(),
      db.feePlan.deleteMany(), db.attendance.deleteMany(), db.applicationDocument.deleteMany(),
      db.admissionApplication.deleteMany(), db.lead.deleteMany(), db.studentGuardian.deleteMany(),
      db.guardian.deleteMany(), db.student.deleteMany(), db.classroom.deleteMany(),
      db.academicSession.deleteMany(), db.tenantUser.deleteMany(), db.user.deleteMany(),
      db.branch.deleteMany(), db.tenant.deleteMany(),
    ])
  }

  const hash = await bcrypt.hash(PASSWORD, 10)

  // ── Platform admin (no tenant) ──
  await db.user.create({
    data: { email: 'platform@preone.in', username: 'platform.admin', fullName: 'PreOne Platform Admin', passwordHash: hash, status: 'ACTIVE' },
  })

  // ── Tenant ──
  const tenant = await db.tenant.create({
    data: {
      name: 'Sunshine Kids Preschool',
      code: 'SUNSHINE',
      type: 'SCHOOL',
      status: 'ACTIVE',
      subscriptionPlan: 'PRO',
      maxBranches: 5,
      maxStudents: 500,
      address: '123, Koramangala 5th Block',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560095',
      phone: '+918041234567',
      email: 'hello@sunshinekids.in',
      gstNumber: '29ABCDE1234F1Z5',
      onboardingStep: 5,
      onboardedAt: new Date(),
    },
  })

  const branch = await db.branch.create({
    data: {
      tenantId: tenant.id, name: 'Sunshine Kids — Koramangala', code: 'MAIN',
      address: '123, Koramangala 5th Block', city: 'Bengaluru', state: 'Karnataka',
      pincode: '560095', phone: '+918041234567', isMain: true,
    },
  })
  const branch2 = await db.branch.create({
    data: {
      tenantId: tenant.id, name: 'Sunshine Kids — Indiranagar', code: 'IND',
      city: 'Bengaluru', state: 'Karnataka', phone: '+918041234999',
    },
  })

  // ── Staff users ──
  const staffSpecs = [
    { email: 'owner@sunshine.demo', name: 'Meera Iyer', role: 'OWNER' },
    { email: 'principal@sunshine.demo', name: 'Rajni Malhotra', role: 'PRINCIPAL' },
    { email: 'teacher@sunshine.demo', name: 'Anita Sharma', role: 'TEACHER' },
    { email: 'teacher2@sunshine.demo', name: 'Sana Sheikh', role: 'TEACHER' },
    { email: 'teacher3@sunshine.demo', name: 'Kavya Reddy', role: 'TEACHER' },
    { email: 'accounts@sunshine.demo', name: 'Vikram Rao', role: 'ACCOUNTS' },
    { email: 'reception@sunshine.demo', name: 'Divya Nair', role: 'RECEPTIONIST' },
  ] as const

  const staff: Record<string, string> = {}
  for (const s of staffSpecs) {
    const u = await db.user.create({
      data: {
        email: s.email,
        username: sanitizeUsernameSlug(s.name),
        fullName: s.name,
        passwordHash: hash,
        status: 'ACTIVE',
      },
    })
    await db.tenantUser.create({
      data: { tenantId: tenant.id, userId: u.id, role: s.role, branchId: s.role === 'OWNER' ? null : branch.id },
    })
    staff[s.email] = u.id
  }

  const owner = staff['owner@sunshine.demo']!
  const principal = staff['principal@sunshine.demo']!
  const teacher1 = staff['teacher@sunshine.demo']!
  const teacher2 = staff['teacher2@sunshine.demo']!
  const teacher3 = staff['teacher3@sunshine.demo']!
  const accounts = staff['accounts@sunshine.demo']!
  const reception = staff['reception@sunshine.demo']!

  // ── Academic session ──
  const acad = await db.academicSession.create({
    data: {
      tenantId: tenant.id, name: '2026-27',
      startDate: new Date(new Date().getFullYear(), 3, 1),
      endDate: new Date(new Date().getFullYear() + 1, 2, 31),
      status: 'ACTIVE', isCurrent: true,
    },
  })

  // ── Classrooms ──
  const rooms = [
    { name: 'Playgroup Sunshine', code: 'PLA-A', programType: 'PLAYGROUP' as const, teacher: teacher1, capacity: 16 },
    { name: 'Nursery Rainbow', code: 'NUR-A', programType: 'NURSERY' as const, teacher: teacher2, capacity: 20 },
    { name: 'Jr KG Explorer', code: 'LKG-A', programType: 'LKG' as const, teacher: teacher3, capacity: 22 },
  ]
  const classrooms: Record<string, string> = {}
  for (const r of rooms) {
    const c = await db.classroom.create({
      data: {
        tenantId: tenant.id, branchId: branch.id, academicSessionId: acad.id,
        name: r.name, code: r.code, programType: r.programType,
        capacity: r.capacity, primaryTeacherId: r.teacher,
        ageBandMinMonths: r.programType === 'PLAYGROUP' ? 18 : r.programType === 'NURSERY' ? 30 : 42,
        ageBandMaxMonths: r.programType === 'PLAYGROUP' ? 30 : r.programType === 'NURSERY' ? 42 : 54,
      },
    })
    classrooms[r.code] = c.id
  }

  // ── Fee plans ──
  const planSpec = [
    { programType: 'PLAYGROUP', tuition: 110000, name: 'Playgroup Annual Plan' },
    { programType: 'NURSERY', tuition: 130000, name: 'Nursery Annual Plan' },
    { programType: 'LKG', tuition: 150000, name: 'Jr KG Annual Plan' },
  ] as const
  const plans: Record<string, { admission: number; tuition: number; activity: number }> = {}
  for (const p of planSpec) {
    const fp = await db.feePlan.create({
      data: {
        tenantId: tenant.id, name: p.name, programType: p.programType,
        totalAnnualCents: p.tuition * 4 + 750000, installmentCount: 4,
      },
    })
    await db.feePlanItem.createMany({
      data: [
        { feePlanId: fp.id, feeHead: 'ADMISSION', label: 'Admission Fee (One Time)', amountCents: 500000, frequency: 'ONE_TIME' },
        { feePlanId: fp.id, feeHead: 'TUITION', label: 'Tuition Fee (Quarterly)', amountCents: p.tuition, frequency: 'QUARTERLY' },
        { feePlanId: fp.id, feeHead: 'ACTIVITY', label: 'Activity & Materials (Annual)', amountCents: 250000, frequency: 'ANNUALLY' },
      ],
    })
    plans[p.programType] = { admission: 500000, tuition: p.tuition, activity: 250000 }
  }

  // ── Students + guardians ──
  const firstNames = [
    'Aarav', 'Anaya', 'Vivaan', 'Diya', 'Aditya', 'Myra', 'Kabir', 'Ishita', 'Reyansh', 'Anika',
    'Arjun', 'Kiara', 'Vihaan', 'Sara', 'Ayaan', 'Zara', 'Dhruv', 'Meher', 'Rudra', 'Aisha',
    'Neel', 'Tara', 'Yuvaan', 'Riya',
  ]
  const lastNames = ['Sharma', 'Patel', 'Reddy', 'Nair', 'Gupta', 'Singh', 'Khan', 'Rao', 'Iyer', 'Mehta']
  const guardiansFirst = ['Priya', 'Rahul', 'Sneha', 'Amit', 'Kavita', 'Rohan', 'Neha', 'Sanjay', 'Pooja', 'Arvind']

  type Seeded = { id: string; firstName: string; classroom: string; guardianPhone: string }
  const students: Seeded[] = []

  for (let i = 0; i < 24; i++) {
    const roomCode = i < 8 ? 'PLA-A' : i < 16 ? 'NUR-A' : 'LKG-A'
    const programType = i < 8 ? 'PLAYGROUP' : i < 16 ? 'NURSERY' : 'LKG'
    const firstName = firstNames[i]!
    const lastName = lastNames[i % lastNames.length]!
    const parentFirst = guardiansFirst[i % guardiansFirst.length]!
    const guardianPhone = `+9198${String(10000000 + i * 137).slice(0, 8)}`

    const s = await db.student.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        admissionNo: `STU-2026-${String(i + 1).padStart(4, '0')}`,
        firstName,
        lastName,
        dob: new Date(new Date().getFullYear() - (i < 8 ? 2 : i < 16 ? 3 : 4), (i * 5) % 12, ((i * 7) % 27) + 1),
        gender: i % 2 === 0 ? 'MALE' : 'FEMALE',
        admissionDate: daysAgo(120 + i),
        bloodGroup: i % 3 === 0 ? 'O_POSITIVE' : i % 3 === 1 ? 'A_POSITIVE' : 'B_POSITIVE',
        currentClassroomId: classrooms[roomCode],
      },
    })

    const g = await db.guardian.create({
      data: {
        tenantId: tenant.id,
        fullName: `${parentFirst} ${lastName}`,
        relationship: i % 2 === 0 ? 'MOTHER' : 'FATHER',
        phone: guardianPhone,
        email: `${parentFirst.toLowerCase()}.${lastName.toLowerCase()}@example.in`,
        occupation: 'Working Professional',
        isPrimaryContact: true,
      },
    })
    await db.studentGuardian.create({
      data: { studentId: s.id, guardianId: g.id, isPrimary: true, canPickup: true, isFeePayer: true },
    })

    students.push({ id: s.id, firstName, classroom: roomCode, guardianPhone })
  }

  // Parent portal user linked to 2 children via a single guardian record
  const parentUser = await db.user.create({
    data: {
      email: 'parent@sunshine.demo',
      username: sanitizeUsernameSlug('Priya Sharma'),
      fullName: 'Priya Sharma',
      passwordHash: hash,
      status: 'ACTIVE',
    },
  })
  await db.tenantUser.create({
    data: { tenantId: tenant.id, userId: parentUser.id, role: 'PARENT' },
  })
  const parentGuardian = await db.guardian.create({
    data: {
      tenantId: tenant.id, fullName: 'Priya Sharma', relationship: 'MOTHER',
      phone: '+919811111111', email: 'priya.sharma@example.in',
      isPrimaryContact: true, userId: parentUser.id,
    },
  })
  for (const s of students.slice(0, 2)) {
    await db.studentGuardian.create({
      data: { studentId: s.id, guardianId: parentGuardian.id, isPrimary: true, canPickup: true, isFeePayer: true },
    })
  }

  // ── Attendance: last 7 weekdays ──
  let attCount = 0
  for (let d = 0; d < 9; d++) {
    const date = daysAgo(d)
    if (date.getDay() === 0 || date.getDay() === 6) continue // skip weekends
    for (const s of students) {
      const roll = Math.random()
      const status = roll > 0.92 ? 'ABSENT' : roll > 0.86 ? 'LATE' : roll > 0.83 ? 'HALF_DAY' : 'PRESENT'
      await db.attendance.create({
        data: {
          tenantId: tenant.id, branchId: branch.id,
          classroomId: classrooms[s.classroom]!,
          studentId: s.id, date,
          status: status as 'PRESENT',
          markedById: s.classroom === 'PLA-A' ? teacher1 : s.classroom === 'NUR-A' ? teacher2 : teacher3,
        },
      })
      attCount++
    }
  }

  // ── Invoices: admission + quarterly per student, varied statuses ──
  let invSeq = 0
  const fy = new Date().getFullYear()
  for (let i = 0; i < students.length; i++) {
    const s = students[i]!
    const programType = i < 8 ? 'PLAYGROUP' : i < 16 ? 'NURSERY' : 'LKG'
    const plan = plans[programType]!
    invSeq++
    const subtotal = plan.admission + plan.tuition + plan.activity
    const invoice = await db.invoice.create({
      data: {
        tenantId: tenant.id, branchId: branch.id, studentId: s.id,
        invoiceNumber: `INV-${fy}-${String(invSeq).padStart(4, '0')}`,
        title: 'Admission + Term 1 Fees',
        issueDate: daysAgo(90),
        dueDate: daysAgo(-15),
        subtotalCents: subtotal, totalCents: subtotal, balanceCents: subtotal,
        status: 'ISSUED', issuedById: accounts,
        items: {
          create: [
            { feeHead: 'ADMISSION', description: 'Admission Fee (One Time)', amountCents: plan.admission },
            { feeHead: 'TUITION', description: 'Tuition Fee (Quarterly)', amountCents: plan.tuition },
            { feeHead: 'ACTIVITY', description: 'Activity & Materials (Annual)', amountCents: plan.activity },
          ],
        },
      },
    })

    // payment behavior: first 12 paid fully, next 6 partially, rest unpaid/overdue
    if (i < 12) {
      await payInvoice(invoice.id, subtotal, rand(['UPI', 'NET_BANKING', 'CARD']), accounts, tenant.id, s.id)
    } else if (i < 18) {
      const part = plan.tuition
      await payInvoice(invoice.id, part, rand(['UPI', 'CASH']), accounts, tenant.id, s.id)
    } else if (i < 21) {
      // overdue — due date passed, nothing paid
      await db.invoice.update({
        where: { id: invoice.id },
        data: { dueDate: daysAgo(20), status: 'OVERDUE' },
      })
    }
  }

  async function payInvoice(
    invoiceId: string, amountCents: number, method: string, byId: string, tenantId: string, studentId: string
  ) {
    const inv = await db.invoice.findUnique({ where: { id: invoiceId } })
    if (!inv) return
    const payCount = await db.payment.count({ where: { tenantId } })
    const recCount = await db.receipt.count()
    const payment = await db.payment.create({
      data: {
        tenantId, invoiceId, studentId,
        paymentNumber: `PAY-${fy}-${String(payCount + 1).padStart(4, '0')}`,
        amountCents, method: method as 'UPI',
        transactionRef: `TXN${Math.floor(Math.random() * 1e12)}`,
        status: 'SUCCESS', paymentDate: daysAgo(Math.floor(Math.random() * 30)),
        receivedById: byId,
      },
    })
    await db.receipt.create({
      data: {
        paymentId: payment.id,
        receiptNumber: `RCT-${fy}-${String(recCount + 1).padStart(4, '0')}`,
        amountCents,
        tenantId,
      },
    })
    const paid = inv.paidCents + amountCents
    await db.invoice.update({
      where: { id: invoiceId },
      data: {
        paidCents: paid,
        balanceCents: inv.totalCents - paid,
        status: paid >= inv.totalCents ? 'PAID' : 'PARTIALLY_PAID',
      },
    })
  }

  // ── Leads (pipeline) ──
  const leadSpecs = [
    { parent: 'Sunita Verma', status: 'NEW', source: 'WALK_IN', child: 'Tanvi' },
    { parent: 'Manish Gupta', status: 'NEW', source: 'WEBSITE', child: 'Om' },
    { parent: 'Farah Ali', status: 'CONTACTED', source: 'REFERRAL', child: 'Zoya' },
    { parent: 'Deepak Joshi', status: 'CONTACTED', source: 'PHONE', child: 'Aryan' },
    { parent: 'Lakshmi Menon', status: 'QUALIFIED', source: 'INSTAGRAM', child: 'Aditi' },
    { parent: 'Harpreet Singh', status: 'QUALIFIED', source: 'EVENT', child: 'Ekam' },
    { parent: 'Nandini Rao', status: 'APPLICATION_STARTED', source: 'FACEBOOK', child: 'Advik' },
    { parent: 'Gaurav Batra', status: 'LOST', source: 'GOOGLE_ADS', child: 'Kian' },
  ]
  let leadSeq = 0
  for (const l of leadSpecs) {
    leadSeq++
    await db.lead.create({
      data: {
        tenantId: tenant.id, branchId: branch.id,
        leadNumber: `LEAD-${fy}-${String(leadSeq).padStart(4, '0')}`,
        parentName: l.parent, phone: `+9197${String(10000000 + leadSeq * 311).slice(0, 8)}`,
        source: l.source as 'WALK_IN', status: l.status as 'NEW',
        childName: l.child, interestedProgram: 'NURSERY',
        assignedToId: reception, notes: 'Interested in morning batch.',
      },
    })
  }

  // ── Applications (pending pipeline) ──
  const appSpecs = [
    { child: 'Tanvi Verma', status: 'SUBMITTED', program: 'NURSERY' },
    { child: 'Om Gupta', status: 'DOCUMENT_PENDING', program: 'PLAYGROUP' },
    { child: 'Zoya Ali', status: 'VERIFIED', program: 'NURSERY' },
    { child: 'Aditi Menon', status: 'UNDER_REVIEW', program: 'LKG' },
  ]
  let appSeq = 0
  for (const a of appSpecs) {
    appSeq++
    const [first, ...rest] = a.child.split(' ')
    const app = await db.admissionApplication.create({
      data: {
        tenantId: tenant.id, branchId: branch.id, academicSessionId: acad.id,
        applicationNumber: `ADM-${fy}-${String(appSeq).padStart(4, '0')}`,
        programType: a.program as 'NURSERY',
        childFirstName: first!, childLastName: rest.join(' '),
        childDob: new Date(new Date().getFullYear() - 3, 5, 10),
        childGender: appSeq % 2 ? 'FEMALE' : 'MALE',
        parentName: `${a.child.split(' ')[1]}'s Parent`,
        parentPhone: `+9196${String(20000000 + appSeq * 717).slice(0, 8)}`,
        status: a.status as 'SUBMITTED',
        submittedAt: daysAgo(appSeq * 2),
      },
    })
    const docSpecs = ['BIRTH_CERTIFICATE', 'PHOTO', 'PARENT_ID', 'MEDICAL_CERTIFICATE']
    await db.applicationDocument.createMany({
      data: docSpecs.map((docType, ix) => ({
        applicationId: app.id,
        docType: docType as 'BIRTH_CERTIFICATE',
        fileName: `${a.child.toLowerCase().replace(' ', '-')}-${docType.toLowerCase()}.pdf`,
        verified: a.status === 'VERIFIED' || (a.status === 'UNDER_REVIEW' && ix < 3),
      })),
    })
  }

  // ── Announcements ──
  await db.announcement.createMany({
    data: [
      {
        tenantId: tenant.id, title: 'Grandparents Day — Friday!',
        body: 'Invite your parents for a special circle time at 10 AM. Children have prepared songs and a surprise craft activity.',
        type: 'EVENT', audience: 'SCHOOL_WIDE', authorId: principal,
      },
      {
        tenantId: tenant.id, title: 'Term 2 fee receipts',
        body: 'Receipts for all Term 2 payments are now available in the app. Kindly clear outstanding dues by the 15th.',
        type: 'FEE_REMINDER', audience: 'ALL_PARENTS', authorId: accounts,
      },
      {
        tenantId: tenant.id, title: 'Healthy Tiffin Week',
        body: 'Next week we celebrate nutrition — pack one fruit and one veggie every day. Allergy-aware menu shared on the notice board.',
        type: 'IMPORTANT', audience: 'CLASS_PARENTS', classroomId: classrooms['NUR-A'], authorId: teacher2,
      },
    ],
  })

  // ── Timeline entries (parent feed) ──
  const feedSpecs = [
    { type: 'ARRIVAL', title: 'Arrived at school', body: 'Cheerful drop-off, joined free play.' },
    { type: 'MEAL', title: 'Morning snack', body: 'Ate most of the fruit bowl, drank full milk.' },
    { type: 'ACTIVITY', title: 'Block play towers', body: 'Built a 12-block tower with friends — great teamwork!' },
    { type: 'NAP', title: 'Nap time', body: 'Slept for 55 minutes, woke up refreshed.' },
    { type: 'ACTIVITY', title: 'Outdoor play', body: 'Sandpit and slide — lots of giggles.' },
  ]
  for (let i = 0; i < 10; i++) {
    const s = students[i % 10]!
    for (const f of feedSpecs.slice(0, 2 + (i % 4))) {
      await db.timelineEntry.create({
        data: {
          tenantId: tenant.id, studentId: s.id, classroomId: classrooms[s.classroom]!,
          type: f.type as 'ARRIVAL', title: f.title, body: f.body,
          authorId: s.classroom === 'PLA-A' ? teacher1 : s.classroom === 'NUR-A' ? teacher2 : teacher3,
          createdAt: daysAgo(Math.floor(i / 5)),
        },
      })
    }
  }

  // ── Observations ──
  const obsSpecs = [
    { narrative: 'Aarav sorted all the red beads by size today and explained his pattern to the group — emerging mathematical thinking and confidence.', tags: 'Cognitive, Fine Motor' },
    { narrative: 'Anaya comforted a friend who was missing her mother and offered her favourite toy — beautiful empathy and social awareness.', tags: 'Social Skills, Emotional' },
    { narrative: 'Vivaan traced all the letters of his name independently and asked to try "capital letters too" — strong literacy interest.', tags: 'Literacy, Fine Motor' },
    { narrative: 'Diya balanced across the beam without support and then helped two classmates cross safely — gross motor strength plus leadership.', tags: 'Gross Motor, Leadership' },
  ]
  for (let i = 0; i < obsSpecs.length; i++) {
    const s = students[i]!
    const o = await db.observation.create({
      data: {
        tenantId: tenant.id, studentId: s.id, classroomId: classrooms[s.classroom]!,
        teacherId: s.classroom === 'PLA-A' ? teacher1 : s.classroom === 'NUR-A' ? teacher2 : teacher3,
        narrative: obsSpecs[i]!.narrative,
        milestoneTags: obsSpecs[i]!.tags,
        status: i < 2 ? 'PUBLISHED' : 'DRAFT',
        observedAt: daysAgo(i),
        publishedAt: i < 2 ? daysAgo(i) : null,
      },
    })
    if (i < 2) {
      await db.timelineEntry.create({
        data: {
          tenantId: tenant.id, studentId: s.id, classroomId: classrooms[s.classroom]!,
          type: 'OBSERVATION', title: 'Learning Observation', body: obsSpecs[i]!.narrative,
          authorId: teacher1, observationId: o.id, createdAt: daysAgo(i),
        },
      })
    }
  }

  // ── Audit log ──
  await db.auditLog.createMany({
    data: [
      { tenantId: tenant.id, actorId: owner, actorName: 'Meera Iyer', action: 'CREATE', entity: 'Tenant', summary: 'Sunshine Kids Preschool onboarded on PreOne' },
      { tenantId: tenant.id, actorId: principal, actorName: 'Rajni Malhotra', action: 'APPROVE', entity: 'AdmissionApplication', summary: 'Approved ADM-2026 batch — 24 students enrolled' },
      { tenantId: tenant.id, actorId: accounts, actorName: 'Vikram Rao', action: 'CREATE', entity: 'Payment', summary: 'Term 1 fee collection drive — 18 receipts issued' },
      { tenantId: tenant.id, actorId: teacher2, actorName: 'Sana Sheikh', action: 'CREATE', entity: 'Attendance', summary: 'Nursery Rainbow register marked' },
      { tenantId: tenant.id, actorId: reception, actorName: 'Divya Nair', action: 'CREATE', entity: 'Lead', summary: '8 walk-in leads captured this week' },
    ],
  })

  console.log('✅ Seed complete:')
  console.log('   · Tenant: Sunshine Kids Preschool (SUNSHINE)')
  console.log('   · Users: 7 staff + 1 parent + 1 platform admin — password: Preone@123')
  console.log(`   · ${students.length} students, ${attCount} attendance records`)
  console.log('   · 24 invoices (12 paid / 6 partial / 3 overdue), payments + receipts')
  console.log('   · 8 leads, 4 applications, 3 announcements, observations + timeline')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
