/**
 * PreOne Plus — Library Service
 * Book catalog management, issue/return workflow with copy accounting,
 * overdue fine computation (₹2/day), status transitions.
 */
import { db } from '@/lib/db'

export interface ActorContext {
  id: string
  name: string
  role: string
  ipAddress?: string
  userAgent?: string
}

/** Fine policy: ₹2 per day, capped at book price (or ₹500 max) */
const FINE_PER_DAY_CENTS = 200
const FINE_CAP_CENTS = 50000

export const LibraryService = {
  async listBooks(tenantId: string, opts: { category?: string; search?: string; status?: string; page?: number; pageSize?: number } = {}) {
    const where: any = { tenantId, deletedAt: null }
    if (opts.category) where.category = opts.category
    if (opts.status) where.status = opts.status
    if (opts.search) {
      where.OR = [
        { title: { contains: opts.search, mode: 'insensitive' } },
        { author: { contains: opts.search, mode: 'insensitive' } },
        { isbn: { contains: opts.search, mode: 'insensitive' } },
      ]
    }
    const page = opts.page ?? 1
    const pageSize = Math.min(opts.pageSize ?? 50, 200)
    const [items, total] = await Promise.all([
      db.book.findMany({ where, orderBy: { title: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
      db.book.count({ where }),
    ])
    return { items, total, page, pageSize }
  },

  async listCategories(tenantId: string) {
    const rows = await db.book.findMany({
      where: { tenantId, deletedAt: null, category: { not: null } },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    })
    return rows.map((r) => r.category).filter(Boolean)
  },

  async createBook(tenantId: string, data: {
    title: string; author?: string; isbn?: string; category?: string; publisher?: string
    language?: string; totalCopies?: number; shelfLocation?: string; priceCents?: number
  }) {
    if (!data.title?.trim()) throw new Error('Book title is required')
    const totalCopies = Math.max(1, data.totalCopies ?? 1)
    if (data.isbn) {
      const dup = await db.book.findFirst({ where: { tenantId, isbn: data.isbn, deletedAt: null } })
      if (dup) throw new Error(`A book with ISBN "${data.isbn}" already exists`)
    }
    return db.book.create({
      data: {
        tenantId,
        title: data.title.trim(),
        author: data.author?.trim() || null,
        isbn: data.isbn?.trim() || null,
        category: data.category?.trim() || null,
        publisher: data.publisher?.trim() || null,
        language: data.language || 'English',
        totalCopies,
        availableCopies: totalCopies,
        shelfLocation: data.shelfLocation || null,
        priceCents: data.priceCents ?? null,
      },
    })
  },

  async updateBook(tenantId: string, id: string, data: Partial<{
    title: string; author: string; category: string; publisher: string; language: string
    totalCopies: number; shelfLocation: string; priceCents: number; isActive: boolean
  }>) {
    const book = await db.book.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!book) throw new Error('Book not found')
    if (data.totalCopies != null) {
      const issued = await db.bookIssue.count({ where: { bookId: id, tenantId, status: 'ISSUED' } })
      if (data.totalCopies < issued) throw new Error(`Cannot reduce copies below ${issued} — that many are currently issued`)
      const availableDelta = data.totalCopies - book.totalCopies
      const newAvailable = Math.max(0, book.availableCopies + availableDelta)
      const updateData: any = { ...data, availableCopies: newAvailable }
      if (newAvailable === 0 && issued > 0) updateData.status = 'ISSUED'
      else if (newAvailable > 0) updateData.status = 'AVAILABLE'
      return db.book.update({ where: { id }, data: updateData })
    }
    return db.book.update({ where: { id }, data })
  },

  async softDeleteBook(tenantId: string, id: string) {
    const book = await db.book.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!book) throw new Error('Book not found')
    const issued = await db.bookIssue.count({ where: { bookId: id, tenantId, status: 'ISSUED' } })
    if (issued > 0) throw new Error(`Cannot delete — ${issued} copies still issued`)
    return db.book.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } })
  },

  async listIssues(tenantId: string, opts: { status?: string; studentId?: string; bookId?: string; page?: number } = {}) {
    const where: any = { tenantId }
    if (opts.status) where.status = opts.status
    if (opts.studentId) where.studentId = opts.studentId
    if (opts.bookId) where.bookId = opts.bookId
    const page = opts.page ?? 1
    const pageSize = 50
    const [items, total] = await Promise.all([
      db.bookIssue.findMany({
        where,
        include: {
          book: { select: { id: true, title: true, author: true, category: true } },
          student: { select: { id: true, admissionNo: true, firstName: true, lastName: true } },
          staffUser: { select: { id: true, fullName: true } },
        },
        orderBy: { issuedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.bookIssue.count({ where }),
    ])
    return { items, total, page, pageSize }
  },

  /** Issue a book to a student (or staff) with copy accounting */
  async issueBook(tenantId: string, data: {
    bookId: string; studentId?: string; staffUserId?: string; dueDate: string; remarks?: string
  }, actor: ActorContext) {
    if (!data.studentId && !data.staffUserId) throw new Error('Issue target required — select a student or staff member')
    if (data.studentId && data.staffUserId) throw new Error('Issue to either a student OR a staff member, not both')
    const book = await db.book.findFirst({ where: { id: data.bookId, tenantId, deletedAt: null } })
    if (!book) throw new Error('Book not found')
    if (book.availableCopies <= 0) throw new Error(`No copies available — all ${book.totalCopies} are issued/lost`)
    const due = new Date(data.dueDate)
    if (isNaN(due.getTime())) throw new Error('Invalid due date')
    if (due <= new Date()) throw new Error('Due date must be in the future')

    let studentName = ''
    if (data.studentId) {
      const student = await db.student.findFirst({ where: { id: data.studentId, tenantId, deletedAt: null, status: 'ACTIVE' } })
      if (!student) throw new Error('Student not found or inactive')
      const activeIssues = await db.bookIssue.count({ where: { tenantId, studentId: data.studentId, status: 'ISSUED' } })
      if (activeIssues >= 3) throw new Error(`${student.firstName} already has 3 books issued — return limit is 3 per student`)
      studentName = student.firstName
    }

    const [issue] = await db.$transaction([
      db.bookIssue.create({
        data: {
          tenantId,
          bookId: data.bookId,
          studentId: data.studentId || null,
          staffUserId: data.staffUserId || null,
          issuedById: actor.id,
          dueDate: due,
          status: 'ISSUED',
          remarks: data.remarks,
        },
      }),
      db.book.update({
        where: { id: book.id },
        data: {
          availableCopies: { decrement: 1 },
          status: book.availableCopies - 1 === 0 ? 'ISSUED' : 'AVAILABLE',
        },
      }),
    ])
    return issue
  },

  /** Return a book — computes overdue fine automatically */
  async returnBook(tenantId: string, issueId: string, opts: { lost?: boolean; remarks?: string } = {}, actor?: ActorContext) {
    const issue = await db.bookIssue.findFirst({ where: { id: issueId, tenantId } })
    if (!issue) throw new Error('Issue record not found')
    if (issue.status === 'RETURNED') throw new Error('This book has already been returned')

    const now = new Date()
    let fineCents = 0
    let status: 'RETURNED' | 'LOST' = 'RETURNED'

    if (opts.lost) {
      status = 'LOST'
      const book = await db.book.findUnique({ where: { id: issue.bookId } })
      fineCents = book?.priceCents ?? FINE_CAP_CENTS
      // lost copy permanently reduces total stock
      await db.book.update({ where: { id: issue.bookId }, data: { totalCopies: { decrement: 1 }, status: 'AVAILABLE' } })
    } else {
      const overdueDays = Math.floor((now.getTime() - issue.dueDate.getTime()) / (1000 * 60 * 60 * 24))
      if (overdueDays > 0) {
        fineCents = Math.min(overdueDays * FINE_PER_DAY_CENTS, FINE_CAP_CENTS)
      }
      await db.book.update({
        where: { id: issue.bookId },
        data: { availableCopies: { increment: 1 }, status: 'AVAILABLE' },
      })
    }

    return db.bookIssue.update({
      where: { id: issueId },
      data: {
        status,
        returnedAt: now,
        fineCents,
        remarks: opts.remarks ?? issue.remarks,
      },
      include: { book: { select: { id: true, title: true } } },
    })
  },

  /** Mark unreturned past-due issues as OVERDUE (called on list for freshness) */
  async syncOverdue(tenantId: string) {
    const r = await db.bookIssue.updateMany({
      where: { tenantId, status: 'ISSUED', dueDate: { lt: new Date() } },
      data: { status: 'OVERDUE' },
    })
    return { markedOverdue: r.count }
  },

  async dashboard(tenantId: string) {
    const [totalTitles, totalCopies, availableCopies, activeIssues, overdueIssues] = await Promise.all([
      db.book.count({ where: { tenantId, deletedAt: null } }),
      db.book.aggregate({ where: { tenantId, deletedAt: null }, _sum: { totalCopies: true } }),
      db.book.aggregate({ where: { tenantId, deletedAt: null }, _sum: { availableCopies: true } }),
      db.bookIssue.count({ where: { tenantId, status: 'ISSUED' } }),
      db.bookIssue.count({ where: { tenantId, status: 'OVERDUE' } }),
    ])
    return {
      totalTitles,
      totalCopies: totalCopies._sum.totalCopies ?? 0,
      availableCopies: availableCopies._sum.availableCopies ?? 0,
      activeIssues,
      overdueIssues,
    }
  },
}
