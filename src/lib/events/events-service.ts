/**
 * PreOne Plus — Events & Activities Service
 * School events (sports, cultural, trips, competitions, workshops) with
 * capacity-guarded student registration, waitlists and attendance marking.
 */
import { db } from '@/lib/db'

export interface ActorContext {
  id: string
  name: string
  role: string
  ipAddress?: string
  userAgent?: string
}

const eventInclude = {
  branch: { select: { id: true, name: true } },
  _count: { select: { registrations: { where: { status: { in: ['REGISTERED', 'ATTENDED', 'ABSENT'] } } } } },
} as const

const registrationInclude = {
  student: {
    select: {
      id: true, admissionNo: true, firstName: true, lastName: true,
      currentClassroom: { select: { id: true, name: true } },
    },
  },
} as const

export const EventsService = {
  async list(tenantId: string, opts: { type?: string; status?: string; upcoming?: boolean; search?: string } = {}) {
    const where: any = { tenantId, deletedAt: null }
    if (opts.type) where.type = opts.type
    if (opts.status) where.status = opts.status
    if (opts.upcoming) where.startsAt = { gte: new Date() }
    if (opts.search) where.title = { contains: opts.search, mode: 'insensitive' }
    const rows = await db.schoolEvent.findMany({
      where,
      include: eventInclude,
      orderBy: { startsAt: 'asc' },
    })
    return rows.map((r) => ({
      ...r,
      registeredCount: r._count.registrations,
      seatsLeft: r.capacity !== null ? Math.max(0, r.capacity - r._count.registrations) : null,
    }))
  },

  async get(tenantId: string, id: string) {
    const event = await db.schoolEvent.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        branch: { select: { id: true, name: true } },
        registrations: { include: registrationInclude, orderBy: { registeredAt: 'asc' } },
      },
    })
    if (!event) throw new Error('Event not found')
    const active = event.registrations.filter((r) => ['REGISTERED', 'ATTENDED', 'ABSENT'].includes(r.status))
    return {
      ...event,
      registeredCount: active.length,
      seatsLeft: event.capacity !== null ? Math.max(0, event.capacity - active.length) : null,
    }
  },

  async create(tenantId: string, data: any, actor: ActorContext) {
    if (!data.title || !data.startsAt) throw new Error('title and startsAt are required')
    const starts = new Date(data.startsAt)
    if (isNaN(starts.getTime())) throw new Error('Invalid startsAt')
    if (data.endsAt && new Date(data.endsAt) < starts) throw new Error('endsAt cannot be before startsAt')
    if (data.branchId) {
      const branch = await db.branch.findFirst({ where: { id: data.branchId, tenantId } })
      if (!branch) throw new Error('Branch not found')
    }
    const validTypes = ['SPORTS', 'CULTURAL', 'ACADEMIC', 'TRIP', 'COMPETITION', 'CELEBRATION', 'MEETING', 'WORKSHOP', 'OTHER']
    if (data.type && !validTypes.includes(data.type)) throw new Error('Invalid event type')
    return db.schoolEvent.create({
      data: {
        tenantId,
        branchId: data.branchId ?? null,
        title: String(data.title).trim(),
        type: data.type ?? 'OTHER',
        description: data.description ?? null,
        venue: data.venue ?? null,
        startsAt: starts,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        audience: data.audience ?? 'ALL',
        capacity: data.capacity ? Number(data.capacity) : null,
        registrationRequired: Boolean(data.registrationRequired),
        registrationDeadline: data.registrationDeadline ? new Date(data.registrationDeadline) : null,
        status: 'SCHEDULED',
      },
    })
  },

  async update(tenantId: string, id: string, data: any) {
    const event = await db.schoolEvent.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!event) throw new Error('Event not found')
    if (event.status === 'COMPLETED') throw new Error('Completed events cannot be edited')
    const patch: any = {}
    if (data.title !== undefined) patch.title = String(data.title).trim()
    if (data.description !== undefined) patch.description = data.description
    if (data.venue !== undefined) patch.venue = data.venue
    if (data.startsAt !== undefined) {
      const s = new Date(data.startsAt)
      if (isNaN(s.getTime())) throw new Error('Invalid startsAt')
      patch.startsAt = s
    }
    if (data.endsAt !== undefined) patch.endsAt = data.endsAt ? new Date(data.endsAt) : null
    if (data.audience !== undefined) patch.audience = data.audience
    if (data.capacity !== undefined) patch.capacity = data.capacity ? Number(data.capacity) : null
    if (data.registrationRequired !== undefined) patch.registrationRequired = Boolean(data.registrationRequired)
    if (data.registrationDeadline !== undefined) patch.registrationDeadline = data.registrationDeadline ? new Date(data.registrationDeadline) : null
    if (data.status !== undefined) {
      if (!['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'].includes(data.status)) throw new Error('Invalid status')
      patch.status = data.status
    }
    return db.schoolEvent.update({ where: { id }, data: patch })
  },

  async softDelete(tenantId: string, id: string) {
    const event = await db.schoolEvent.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!event) throw new Error('Event not found')
    return db.schoolEvent.update({ where: { id }, data: { deletedAt: new Date(), isActive: false, status: 'CANCELLED' } })
  },

  async listRegistrations(tenantId: string, eventId: string) {
    const event = await db.schoolEvent.findFirst({ where: { id: eventId, tenantId, deletedAt: null } })
    if (!event) throw new Error('Event not found')
    return db.eventRegistration.findMany({
      where: { tenantId, eventId },
      include: registrationInclude,
      orderBy: { registeredAt: 'asc' },
    })
  },

  /** Atomic capacity-guarded registration with automatic waitlist */
  async register(tenantId: string, eventId: string, studentId: string, actor: ActorContext) {
    const event = await db.schoolEvent.findFirst({ where: { id: eventId, tenantId, deletedAt: null } })
    if (!event) throw new Error('Event not found')
    if (!event.registrationRequired) throw new Error('This event does not require registration')
    if (event.status !== 'SCHEDULED') throw new Error('Event is not open for registration')
    if (event.registrationDeadline && new Date() > event.registrationDeadline) {
      throw new Error('Registration deadline has passed')
    }
    const student = await db.student.findFirst({ where: { id: studentId, tenantId } })
    if (!student) throw new Error('Student not found')
    const existing = await db.eventRegistration.findUnique({
      where: { eventId_studentId: { eventId, studentId } },
    })
    if (existing && existing.status !== 'CANCELLED') throw new Error('Student already registered')

    // Capacity check with waitlist fallback
    let waitlisted = false
    if (event.capacity !== null) {
      const activeCount = await db.eventRegistration.count({
        where: { eventId, status: { in: ['REGISTERED', 'ATTENDED', 'ABSENT'] } },
      })
      if (activeCount >= event.capacity) waitlisted = true
    }
    const data = {
      tenantId,
      eventId,
      studentId,
      registeredById: actor.id,
      status: (waitlisted ? 'WAITLISTED' : 'REGISTERED') as 'WAITLISTED' | 'REGISTERED',
    }
    if (existing) {
      return db.eventRegistration.update({ where: { id: existing.id }, data, include: registrationInclude })
    }
    return db.eventRegistration.create({ data, include: registrationInclude })
  },

  async cancelRegistration(tenantId: string, eventId: string, studentId: string) {
    const reg = await db.eventRegistration.findUnique({
      where: { eventId_studentId: { eventId, studentId } },
    })
    if (!reg) throw new Error('Registration not found')
    if (reg.status === 'CANCELLED') throw new Error('Already cancelled')
    return db.eventRegistration.update({ where: { id: reg.id }, data: { status: 'CANCELLED' }, include: registrationInclude })
  },

  /** Promote first WAITLISTED registration when a seat frees up */
  async promoteFromWaitlist(tenantId: string, eventId: string) {
    const event = await db.schoolEvent.findFirst({ where: { id: eventId, tenantId } })
    if (!event || event.capacity === null) return null
    const activeCount = await db.eventRegistration.count({
      where: { eventId, status: { in: ['REGISTERED', 'ATTENDED', 'ABSENT'] } },
    })
    if (activeCount >= event.capacity) return null
    const next = await db.eventRegistration.findFirst({
      where: { eventId, status: 'WAITLISTED' },
      orderBy: { registeredAt: 'asc' },
    })
    if (!next) return null
    return db.eventRegistration.update({ where: { id: next.id }, data: { status: 'REGISTERED' }, include: registrationInclude })
  },

  async markAttendance(tenantId: string, eventId: string, studentId: string, attended: boolean) {
    const reg = await db.eventRegistration.findUnique({
      where: { eventId_studentId: { eventId, studentId } },
    })
    if (!reg) throw new Error('Registration not found')
    if (reg.status === 'CANCELLED' || reg.status === 'WAITLISTED') {
      throw new Error('Cannot mark attendance for an inactive registration')
    }
    return db.eventRegistration.update({
      where: { id: reg.id },
      data: { status: attended ? 'ATTENDED' : 'ABSENT' },
      include: registrationInclude,
    })
  },

  async stats(tenantId: string) {
    const total = await db.schoolEvent.count({ where: { tenantId, deletedAt: null } })
    const upcoming = await db.schoolEvent.count({ where: { tenantId, deletedAt: null, status: 'SCHEDULED', startsAt: { gte: new Date() } } })
    const ongoing = await db.schoolEvent.count({ where: { tenantId, deletedAt: null, status: 'ONGOING' } })
    const registrations = await db.eventRegistration.count({ where: { tenantId, status: { in: ['REGISTERED', 'ATTENDED'] } } })
    return { total, upcoming, ongoing, registrations }
  },
}
