/**
 * PreOne Plus — Exams & Results Service
 * Exam lifecycle (DRAFT → PUBLISHED), schedule management, marks entry,
 * auto report-card generation with grade + rank computation.
 */
import { db } from '@/lib/db'
import { Decimal } from '@prisma/client/runtime/library'

export interface ActorContext {
  id: string
  name: string
  role: string
  ipAddress?: string
  userAgent?: string
}

function computeGrade(percentage: number): string {
  if (percentage >= 90) return 'A+'
  if (percentage >= 80) return 'A'
  if (percentage >= 70) return 'B+'
  if (percentage >= 60) return 'B'
  if (percentage >= 50) return 'C'
  if (percentage >= 40) return 'D'
  return 'F'
}

export const ExamsService = {
  async list(tenantId: string, opts: { status?: string; academicSessionId?: string; search?: string } = {}) {
    const where: any = { tenantId, deletedAt: null }
    if (opts.status) where.status = opts.status
    if (opts.academicSessionId) where.academicSessionId = opts.academicSessionId
    if (opts.search) where.OR = [{ name: { contains: opts.search, mode: 'insensitive' } }, { code: { contains: opts.search, mode: 'insensitive' } }]
    return db.exam.findMany({
      where,
      include: { academicSession: { select: { id: true, name: true, isCurrent: true } }, _count: { select: { schedules: true, reportCards: true } } },
      orderBy: { createdAt: 'desc' },
    })
  },

  async get(tenantId: string, id: string) {
    const exam = await db.exam.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        academicSession: true,
        schedules: {
          include: {
            classroom: { select: { id: true, name: true, code: true } },
            subject: { select: { id: true, name: true, code: true } },
            _count: { select: { marks: true } },
          },
          orderBy: { examDate: 'asc' },
        },
      },
    })
    if (!exam) throw new Error('Exam not found')
    return exam
  },

  async create(tenantId: string, data: {
    name: string; code: string; examType?: string; startDate: string; endDate: string; academicSessionId: string; description?: string
  }, actor: ActorContext) {
    const session = await db.academicSession.findFirst({ where: { id: data.academicSessionId, tenantId } })
    if (!session) throw new Error('Academic session not found')
    const dup = await db.exam.findFirst({ where: { tenantId, code: data.code, deletedAt: null } })
    if (dup) throw new Error(`Exam code "${data.code}" already exists`)
    if (new Date(data.endDate) < new Date(data.startDate)) throw new Error('End date cannot be before start date')
    return db.exam.create({
      data: {
        tenantId,
        academicSessionId: data.academicSessionId,
        name: data.name,
        code: data.code,
        examType: (data.examType as any) || 'UNIT_TEST',
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        description: data.description,
        status: 'SCHEDULED',
      },
    })
  },

  async update(tenantId: string, id: string, data: Partial<{ name: string; examType: string; startDate: string; endDate: string; description: string; status: string }>) {
    const exam = await db.exam.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!exam) throw new Error('Exam not found')
    if (exam.status === 'PUBLISHED' && data.status !== 'PUBLISHED') throw new Error('Published exam results are locked')
    const updateData: any = {}
    if (data.name) updateData.name = data.name
    if (data.examType) updateData.examType = data.examType
    if (data.description !== undefined) updateData.description = data.description
    if (data.status) updateData.status = data.status
    if (data.startDate) updateData.startDate = new Date(data.startDate)
    if (data.endDate) updateData.endDate = new Date(data.endDate)
    return db.exam.update({ where: { id }, data: updateData })
  },

  async softDelete(tenantId: string, id: string) {
    const exam = await db.exam.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!exam) throw new Error('Exam not found')
    if (exam.status === 'PUBLISHED') throw new Error('Cannot delete a published exam')
    return db.exam.update({ where: { id }, data: { deletedAt: new Date(), status: 'CANCELLED' } })
  },

  async addSchedule(tenantId: string, examId: string, data: {
    classroomId: string; subjectId: string; examDate: string; startTime: string; endTime: string
    maxMarks?: number; passingMarks?: number; invigilatorId?: string
  }) {
    const exam = await db.exam.findFirst({ where: { id: examId, tenantId, deletedAt: null } })
    if (!exam) throw new Error('Exam not found')
    if (exam.status === 'PUBLISHED') throw new Error('Cannot modify a published exam')
    const classroom = await db.classroom.findFirst({ where: { id: data.classroomId, tenantId } })
    if (!classroom) throw new Error('Classroom not found')
    const subject = await db.subject.findFirst({ where: { id: data.subjectId, tenantId, deletedAt: null } })
    if (!subject) throw new Error('Subject not found')
    const maxMarks = new Decimal(data.maxMarks ?? 100)
    const passingMarks = new Decimal(data.passingMarks ?? 35)
    if (passingMarks.greaterThan(maxMarks)) throw new Error('Passing marks cannot exceed max marks')
    const existing = await db.examSchedule.findUnique({
      where: { examId_classroomId_subjectId: { examId, classroomId: data.classroomId, subjectId: data.subjectId } },
    })
    if (existing) throw new Error('This classroom-subject is already scheduled for this exam')
    return db.examSchedule.create({
      data: {
        tenantId, examId,
        classroomId: data.classroomId, subjectId: data.subjectId,
        examDate: new Date(data.examDate),
        startTime: data.startTime, endTime: data.endTime,
        maxMarks, passingMarks,
        invigilatorId: data.invigilatorId,
      },
      include: { classroom: { select: { id: true, name: true, code: true } }, subject: { select: { id: true, name: true, code: true } } },
    })
  },

  async deleteSchedule(tenantId: string, scheduleId: string) {
    const schedule = await db.examSchedule.findFirst({ where: { id: scheduleId, tenantId } })
    if (!schedule) throw new Error('Schedule not found')
    const marks = await db.examMark.count({ where: { scheduleId } })
    if (marks > 0) throw new Error('Cannot delete a schedule that already has marks entered')
    await db.examSchedule.delete({ where: { id: scheduleId } })
    return { deleted: true }
  },

  /** Roster + existing marks for a schedule (marks entry grid) */
  async getMarkSheet(tenantId: string, scheduleId: string) {
    const schedule = await db.examSchedule.findFirst({
      where: { id: scheduleId, tenantId },
      include: {
        exam: { select: { id: true, name: true, code: true, status: true } },
        classroom: { select: { id: true, name: true, code: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
    })
    if (!schedule) throw new Error('Schedule not found')
    const students = await db.student.findMany({
      where: { tenantId, currentClassroomId: schedule.classroomId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, admissionNo: true, firstName: true, lastName: true, seatNumber: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    })
    const marks = await db.examMark.findMany({ where: { tenantId, scheduleId } })
    const markMap = new Map(marks.map((m) => [m.studentId, m]))
    return {
      schedule,
      students: students.map((s) => {
        const m: any = markMap.get(s.id)
        return {
          ...s,
          marksObtained: m?.marksObtained ?? null,
          isAbsent: m?.isAbsent ?? false,
          remarks: m?.remarks ?? null,
          markId: m?.id ?? null,
        }
      }),
    }
  },

  /** Bulk marks save — upsert per student with range validation */
  async saveMarks(tenantId: string, scheduleId: string, entries: Array<{
    studentId: string; marksObtained?: number | null; isAbsent?: boolean; remarks?: string
  }>, actor: ActorContext) {
    const schedule = await db.examSchedule.findFirst({ where: { id: scheduleId, tenantId } })
    if (!schedule) throw new Error('Schedule not found')
    const exam = await db.exam.findFirst({ where: { id: schedule.examId, tenantId } })
    if (!exam || exam.status === 'PUBLISHED') throw new Error('Marks are locked — exam results already published')
    if (exam.status === 'DRAFT') await db.exam.update({ where: { id: exam.id }, data: { status: 'ONGOING' } })

    const maxMarks = schedule.maxMarks.toNumber()
    let saved = 0
    for (const e of entries) {
      const student = await db.student.findFirst({ where: { id: e.studentId, tenantId, deletedAt: null } })
      if (!student) throw new Error(`Student ${e.studentId} not found`)
      if (!e.isAbsent && e.marksObtained != null) {
        const marks = Number(e.marksObtained)
        if (isNaN(marks) || marks < 0 || marks > maxMarks) {
          throw new Error(`Marks for ${student.firstName} must be between 0 and ${maxMarks}`)
        }
      }
      const data: any = {
        isAbsent: !!e.isAbsent,
        remarks: e.remarks ?? null,
        enteredById: actor.id,
        updatedAt: new Date(),
      }
      if (!e.isAbsent && e.marksObtained != null) {
        const pct = (Number(e.marksObtained) / maxMarks) * 100
        data.marksObtained = new Decimal(Number(e.marksObtained))
        data.grade = computeGrade(pct)
      }
      if (e.isAbsent) data.marksObtained = null
      await db.examMark.upsert({
        where: { scheduleId_studentId: { scheduleId, studentId: e.studentId } },
        create: { tenantId, scheduleId, studentId: e.studentId, ...data, enteredAt: new Date() },
        update: data,
      })
      saved++
    }
    return { saved }
  },

  /**
   * Generate report cards for an exam (per classroom).
   * Total = sum of marks across subjects; rank = dense rank within classroom by obtained marks.
   */
  async generateReportCards(tenantId: string, examId: string, classroomId: string, actor: ActorContext) {
    const exam = await db.exam.findFirst({ where: { id: examId, tenantId, deletedAt: null } })
    if (!exam) throw new Error('Exam not found')
    const schedules = await db.examSchedule.findMany({ where: { examId, classroomId, tenantId } })
    if (schedules.length === 0) throw new Error('No subjects scheduled for this classroom in this exam')
    const unmarked = await db.examMark.count({
      where: { tenantId, schedule: { examId, classroomId }, isAbsent: false, marksObtained: null },
    })
    if (unmarked > 0) throw new Error(`${unmarked} students still have missing marks — complete marks entry first`)

    const students = await db.student.findMany({
      where: { tenantId, currentClassroomId: classroomId, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    })
    const totalMax = schedules.reduce((sum, s) => sum + s.maxMarks.toNumber(), 0)
    const rows: Array<{ studentId: string; obtained: number; failed: boolean }> = []

    for (const student of students) {
      const marks = await db.examMark.findMany({ where: { tenantId, scheduleId: { in: schedules.map((s) => s.id) }, studentId: student.id } })
      if (marks.length === 0) continue
      let obtained = 0
      let failed = false
      for (const m of marks) {
        const schedule = schedules.find((s) => s.id === m.scheduleId)!
        if (m.isAbsent || m.marksObtained == null) {
          failed = true
          continue
        }
        obtained += m.marksObtained.toNumber()
        if (m.marksObtained.toNumber() < schedule.passingMarks.toNumber()) failed = true
      }
      rows.push({ studentId: student.id, obtained, failed })
    }

    rows.sort((a, b) => b.obtained - a.obtained)
    const rankMap = new Map<string, number>()
    let lastPct: number | null = null
    let lastRank = 0
    rows.forEach((r, i) => {
      const pct = totalMax > 0 ? (r.obtained / totalMax) * 100 : 0
      if (lastPct === null || pct < lastPct) { lastRank = i + 1; lastPct = pct }
      rankMap.set(r.studentId, lastRank)
    })

    const results: any[] = []
    for (const r of rows) {
      const pct = totalMax > 0 ? (r.obtained / totalMax) * 100 : 0
      const card = await db.reportCard.upsert({
        where: { studentId_examId: { studentId: r.studentId, examId } },
        create: {
          tenantId, studentId: r.studentId, examId, classroomId,
          totalMarks: new Decimal(totalMax), obtainedMarks: new Decimal(r.obtained),
          percentage: new Decimal(Math.round(pct * 100) / 100),
          grade: computeGrade(pct), rank: rankMap.get(r.studentId),
          result: r.failed ? 'FAIL' : 'PASS',
          generatedById: actor.id,
        },
        update: {
          totalMarks: new Decimal(totalMax), obtainedMarks: new Decimal(r.obtained),
          percentage: new Decimal(Math.round(pct * 100) / 100),
          grade: computeGrade(pct), rank: rankMap.get(r.studentId),
          result: r.failed ? 'FAIL' : 'PASS',
          generatedById: actor.id,
        },
      })
      results.push(card)
    }
    if (exam.status !== 'PUBLISHED') {
      await db.exam.update({ where: { id: examId }, data: { status: 'COMPLETED' } })
    }
    return { generated: results.length, totalMax, reportCards: results }
  },

  async publishResults(tenantId: string, examId: string) {
    const exam = await db.exam.findFirst({ where: { id: examId, tenantId, deletedAt: null } })
    if (!exam) throw new Error('Exam not found')
    const cards = await db.reportCard.count({ where: { examId, tenantId } })
    if (cards === 0) throw new Error('Generate report cards before publishing')
    return db.exam.update({ where: { id: examId }, data: { status: 'PUBLISHED' } })
  },

  async listReportCards(tenantId: string, opts: { examId?: string; classroomId?: string; studentId?: string } = {}) {
    const where: any = { tenantId }
    if (opts.examId) where.examId = opts.examId
    if (opts.classroomId) where.classroomId = opts.classroomId
    if (opts.studentId) where.studentId = opts.studentId
    return db.reportCard.findMany({
      where,
      include: {
        student: { select: { id: true, admissionNo: true, firstName: true, lastName: true } },
        exam: { select: { id: true, name: true, code: true, examType: true, status: true } },
        classroom: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ rank: 'asc' }, { obtainedMarks: 'desc' }],
    })
  },
}
