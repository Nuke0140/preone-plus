/**
 * PreOne Plus — Homework & Assignments Service
 * Teacher assigns homework per classroom/subject, students submit,
 * teachers grade. Late-submission detection + completion stats.
 */
import { db } from '@/lib/db'

export interface ActorContext {
  id: string
  name: string
  role: string
  ipAddress?: string
  userAgent?: string
}

const submissionInclude = {
  student: { select: { id: true, admissionNo: true, firstName: true, lastName: true } },
  gradedBy: { select: { id: true, fullName: true } },
} as const

export const HomeworkService = {
  async list(tenantId: string, opts: { classroomId?: string; teacherId?: string; status?: string; search?: string } = {}) {
    const where: any = { tenantId, deletedAt: null }
    if (opts.classroomId) where.classroomId = opts.classroomId
    if (opts.teacherId) where.teacherId = opts.teacherId
    if (opts.status) where.status = opts.status
    if (opts.search) where.title = { contains: opts.search, mode: 'insensitive' }
    const rows = await db.homework.findMany({
      where,
      include: {
        classroom: { select: { id: true, name: true, code: true } },
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, fullName: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { assignedDate: 'desc' },
    })
    // completion stats: class strength per homework
    const classroomIds = [...new Set(rows.map((r) => r.classroomId))]
    const strengths = await db.student.groupBy({
      by: ['currentClassroomId'],
      where: { tenantId, status: 'ACTIVE', currentClassroomId: { in: classroomIds } },
      _count: { _all: true },
    })
    const strengthMap = new Map(strengths.map((s) => [s.currentClassroomId, s._count._all]))
    return rows.map((r) => ({
      ...r,
      classStrength: strengthMap.get(r.classroomId) ?? 0,
      submittedCount: r._count.submissions,
    }))
  },

  async get(tenantId: string, id: string) {
    return db.homework.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        classroom: { select: { id: true, name: true, code: true } },
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, fullName: true } },
        submissions: { include: submissionInclude, orderBy: { createdAt: 'asc' } },
      },
    })
  },

  async create(tenantId: string, data: any, actor: ActorContext) {
    if (!data.classroomId || !data.title || !data.dueDate) {
      throw new Error('classroomId, title and dueDate are required')
    }
    const classroom = await db.classroom.findFirst({ where: { id: data.classroomId, tenantId } })
    if (!classroom) throw new Error('Classroom not found')
    if (data.subjectId) {
      const subject = await db.subject.findFirst({ where: { id: data.subjectId, tenantId } })
      if (!subject) throw new Error('Subject not found')
    }
    const due = new Date(data.dueDate)
    if (isNaN(due.getTime())) throw new Error('Invalid dueDate')
    const homework = await db.homework.create({
      data: {
        tenantId,
        classroomId: data.classroomId,
        subjectId: data.subjectId ?? null,
        teacherId: data.teacherId ?? actor.id,
        title: String(data.title).trim(),
        description: data.description ?? null,
        attachmentUrl: data.attachmentUrl ?? null,
        assignedDate: data.assignedDate ? new Date(data.assignedDate) : new Date(),
        dueDate: due,
        estimatedMinutes: data.estimatedMinutes ? Number(data.estimatedMinutes) : null,
        status: data.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
      },
    })
    // Pre-create PENDING submissions for all active students in the class
    const students = await db.student.findMany({
      where: { tenantId, status: 'ACTIVE', currentClassroomId: data.classroomId },
      select: { id: true },
    })
    if (students.length) {
      await db.homeworkSubmission.createMany({
        data: students.map((s) => ({ tenantId, homeworkId: homework.id, studentId: s.id })),
      })
    }
    return { ...homework, preCreatedSubmissions: students.length }
  },

  async update(tenantId: string, id: string, data: any) {
    const homework = await db.homework.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!homework) throw new Error('Homework not found')
    if (homework.status === 'CLOSED' && data.status !== 'PUBLISHED') {
      throw new Error('Closed homework cannot be edited')
    }
    const patch: any = {}
    if (data.title !== undefined) patch.title = String(data.title).trim()
    if (data.description !== undefined) patch.description = data.description
    if (data.dueDate !== undefined) {
      const due = new Date(data.dueDate)
      if (isNaN(due.getTime())) throw new Error('Invalid dueDate')
      patch.dueDate = due
    }
    if (data.estimatedMinutes !== undefined) patch.estimatedMinutes = data.estimatedMinutes ? Number(data.estimatedMinutes) : null
    if (data.status !== undefined) {
      if (!['DRAFT', 'PUBLISHED', 'CLOSED'].includes(data.status)) throw new Error('Invalid status')
      patch.status = data.status
    }
    return db.homework.update({ where: { id }, data: patch })
  },

  async softDelete(tenantId: string, id: string) {
    const homework = await db.homework.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!homework) throw new Error('Homework not found')
    return db.homework.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } })
  },

  async listSubmissions(tenantId: string, homeworkId: string) {
    const homework = await db.homework.findFirst({ where: { id: homeworkId, tenantId, deletedAt: null } })
    if (!homework) throw new Error('Homework not found')
    return db.homeworkSubmission.findMany({
      where: { tenantId, homeworkId },
      include: submissionInclude,
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    })
  },

  async submit(tenantId: string, homeworkId: string, studentId: string, data: { remarks?: string; contentUrl?: string }, actor: ActorContext) {
    const homework = await db.homework.findFirst({ where: { id: homeworkId, tenantId, deletedAt: null } })
    if (!homework) throw new Error('Homework not found')
    if (homework.status === 'CLOSED') throw new Error('Homework is closed for submissions')
    const sub = await db.homeworkSubmission.findUnique({
      where: { homeworkId_studentId: { homeworkId, studentId } },
    })
    if (!sub) throw new Error('Submission record not found for this student')
    if (sub.status === 'GRADED') throw new Error('Already graded — cannot resubmit')
    const late = new Date() > homework.dueDate
    return db.homeworkSubmission.update({
      where: { id: sub.id },
      data: {
        submittedAt: new Date(),
        remarks: data.remarks ?? sub.remarks,
        contentUrl: data.contentUrl ?? sub.contentUrl,
        status: late ? 'LATE' : 'SUBMITTED',
      },
      include: submissionInclude,
    })
  },

  async grade(tenantId: string, homeworkId: string, studentId: string, data: { grade?: string; feedback?: string; status?: string }, actor: ActorContext) {
    const sub = await db.homeworkSubmission.findUnique({
      where: { homeworkId_studentId: { homeworkId, studentId } },
    })
    if (!sub) throw new Error('Submission record not found')
    if (sub.status === 'PENDING') throw new Error('Student has not submitted yet')
    const nextStatus = data.status === 'RETURNED' ? 'RETURNED' : 'GRADED'
    return db.homeworkSubmission.update({
      where: { id: sub.id },
      data: {
        grade: data.grade ?? sub.grade,
        feedback: data.feedback ?? sub.feedback,
        gradedById: actor.id,
        gradedAt: new Date(),
        status: nextStatus,
      },
      include: submissionInclude,
    })
  },

  async stats(tenantId: string) {
    const total = await db.homework.count({ where: { tenantId, deletedAt: null } })
    const open = await db.homework.count({ where: { tenantId, deletedAt: null, status: 'PUBLISHED' } })
    const closed = await db.homework.count({ where: { tenantId, deletedAt: null, status: 'CLOSED' } })
    const submissions = await db.homeworkSubmission.count({ where: { tenantId } })
    const graded = await db.homeworkSubmission.count({ where: { tenantId, status: 'GRADED' } })
    const late = await db.homeworkSubmission.count({ where: { tenantId, status: 'LATE' } })
    return { total, open, closed, submissions, graded, late }
  },
}
