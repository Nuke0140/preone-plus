/**
 * PreOne Plus — Hostel Service
 * Room inventory (blocks/floors), student allocations with capacity guard,
 * vacate workflow with occupied-count maintenance.
 */
import { db } from '@/lib/db'

export interface ActorContext {
  id: string
  name: string
  role: string
  ipAddress?: string
  userAgent?: string
}

export const HostelService = {
  async listRooms(tenantId: string, opts: { branchId?: string; status?: string; search?: string } = {}) {
    const where: any = { tenantId, deletedAt: null }
    if (opts.branchId) where.branchId = opts.branchId
    if (opts.status) where.status = opts.status
    if (opts.search) where.roomNumber = { contains: opts.search, mode: 'insensitive' }
    return db.hostelRoom.findMany({
      where,
      include: { branch: { select: { id: true, name: true, code: true } }, _count: { select: { allocations: { where: { status: 'ACTIVE' } } } } },
      orderBy: [{ block: 'asc' }, { roomNumber: 'asc' }],
    })
  },

  async createRoom(tenantId: string, data: {
    branchId: string; roomNumber: string; block?: string; floor?: string; roomType?: string
    capacity: number; monthlyFeeCents?: number; notes?: string
  }) {
    const branch = await db.branch.findFirst({ where: { id: data.branchId, tenantId, deletedAt: null } })
    if (!branch) throw new Error('Branch not found')
    if (!data.roomNumber?.trim()) throw new Error('Room number is required')
    if (data.capacity < 1 || data.capacity > 50) throw new Error('Capacity must be between 1 and 50')
    const dup = await db.hostelRoom.findFirst({
      where: { tenantId, branchId: data.branchId, roomNumber: data.roomNumber.trim(), deletedAt: null },
    })
    if (dup) throw new Error(`Room "${data.roomNumber}" already exists in this branch`)
    return db.hostelRoom.create({
      data: {
        tenantId,
        branchId: data.branchId,
        roomNumber: data.roomNumber.trim(),
        block: data.block?.trim() || null,
        floor: data.floor?.trim() || null,
        roomType: data.roomType || 'SHARING',
        capacity: data.capacity,
        monthlyFeeCents: data.monthlyFeeCents ?? null,
        notes: data.notes || null,
      },
    })
  },

  async updateRoom(tenantId: string, id: string, data: Partial<{
    block: string; floor: string; roomType: string; capacity: number; monthlyFeeCents: number; status: string; notes: string
  }>) {
    const room = await db.hostelRoom.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!room) throw new Error('Room not found')
    if (data.capacity != null) {
      if (data.capacity < 1 || data.capacity > 50) throw new Error('Capacity must be between 1 and 50')
      if (data.capacity < room.occupied) throw new Error(`Cannot reduce capacity below ${room.occupied} — that many students are resident`)
    }
    const updateData: any = { ...data }
    if (data.capacity != null && room.status !== 'MAINTENANCE') {
      updateData.status = room.occupied >= data.capacity ? 'FULL' : 'AVAILABLE'
    }
    return db.hostelRoom.update({ where: { id }, data: updateData })
  },

  async softDeleteRoom(tenantId: string, id: string) {
    const room = await db.hostelRoom.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!room) throw new Error('Room not found')
    if (room.occupied > 0) throw new Error(`Cannot delete — ${room.occupied} students are still resident`)
    return db.hostelRoom.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } })
  },

  async listAllocations(tenantId: string, opts: { roomId?: string; status?: string } = {}) {
    const where: any = { tenantId }
    if (opts.roomId) where.roomId = opts.roomId
    if (opts.status) where.status = opts.status
    return db.hostelAllocation.findMany({
      where,
      include: {
        room: { select: { id: true, roomNumber: true, block: true, floor: true, roomType: true, monthlyFeeCents: true } },
        student: { select: { id: true, admissionNo: true, firstName: true, lastName: true, currentClassroom: { select: { name: true } } } },
      },
      orderBy: { allocatedAt: 'desc' },
    })
  },

  /** Allocate a student to a room — atomic capacity guard */
  async allocate(tenantId: string, data: { roomId: string; studentId: string; bedNumber?: string; notes?: string }, actor: ActorContext) {
    const room = await db.hostelRoom.findFirst({ where: { id: data.roomId, tenantId, deletedAt: null } })
    if (!room) throw new Error('Room not found')
    if (room.status === 'MAINTENANCE') throw new Error('Room is under maintenance')
    const student = await db.student.findFirst({
      where: { id: data.studentId, tenantId, deletedAt: null, status: 'ACTIVE' },
      include: { currentClassroom: { select: { name: true } } },
    })
    if (!student) throw new Error('Student not found or inactive')

    const existingActive = await db.hostelAllocation.findFirst({
      where: { tenantId, studentId: data.studentId, status: 'ACTIVE' },
      include: { room: { select: { roomNumber: true } } },
    })
    if (existingActive) throw new Error(`${student.firstName} is already resident in room ${existingActive.room.roomNumber} — vacate first`)
    const dupInRoom = await db.hostelAllocation.findUnique({
      where: { roomId_studentId: { roomId: data.roomId, studentId: data.studentId } },
    })
    if (dupInRoom && dupInRoom.status === 'ACTIVE') throw new Error('Student already allocated to this room')

    // atomic capacity guard: update rows only if occupied < capacity
    const updateResult = await db.hostelRoom.updateMany({
      where: { id: room.id, occupied: { lt: room.capacity }, status: { not: 'MAINTENANCE' } },
      data: { occupied: { increment: 1 } },
    })
    if (updateResult.count === 0) throw new Error(`Room ${room.roomNumber} is full (${room.occupied}/${room.capacity})`)

    try {
      const allocation = await db.hostelAllocation.create({
        data: {
          tenantId,
          roomId: data.roomId,
          studentId: data.studentId,
          bedNumber: data.bedNumber?.trim() || null,
          notes: data.notes || null,
          status: 'ACTIVE',
        },
      })
      const newOccupied = room.occupied + 1
      if (newOccupied >= room.capacity) {
        await db.hostelRoom.update({ where: { id: room.id }, data: { status: 'FULL' } })
      }
      return allocation
    } catch (err) {
      // rollback occupancy on allocation failure
      await db.hostelRoom.update({ where: { id: room.id }, data: { occupied: { decrement: 1 } } }).catch(() => {})
      throw err
    }
  },

  /** Vacate a student from their room */
  async vacate(tenantId: string, allocationId: string, opts: { notes?: string } = {}) {
    const allocation = await db.hostelAllocation.findFirst({ where: { id: allocationId, tenantId } })
    if (!allocation) throw new Error('Allocation not found')
    if (allocation.status === 'VACATED') throw new Error('Student has already vacated')
    const now = new Date()
    const [updated] = await db.$transaction([
      db.hostelAllocation.update({
        where: { id: allocationId },
        data: { status: 'VACATED', vacatedAt: now, notes: opts.notes || allocation.notes },
      }),
      db.hostelRoom.update({
        where: { id: allocation.roomId },
        data: {
          occupied: { decrement: 1 },
          status: 'AVAILABLE',
        },
      }),
    ])
    return updated
  },

  async dashboard(tenantId: string) {
    const [totalRooms, activeResidents, rooms, byStatus] = await Promise.all([
      db.hostelRoom.count({ where: { tenantId, deletedAt: null } }),
      db.hostelAllocation.count({ where: { tenantId, status: 'ACTIVE' } }),
      db.hostelRoom.findMany({ where: { tenantId, deletedAt: null }, select: { capacity: true, occupied: true } }),
      db.hostelRoom.groupBy({ by: ['status'], where: { tenantId, deletedAt: null }, _count: true }),
    ])
    const totalCapacity = rooms.reduce((s, r) => s + r.capacity, 0)
    const statusMap: Record<string, number> = {}
    for (const g of byStatus) statusMap[g.status] = g._count
    return {
      totalRooms,
      totalCapacity,
      activeResidents,
      occupancyPct: totalCapacity > 0 ? Math.round((activeResidents / totalCapacity) * 100) : 0,
      available: statusMap['AVAILABLE'] ?? 0,
      full: statusMap['FULL'] ?? 0,
      maintenance: statusMap['MAINTENANCE'] ?? 0,
    }
  },
}
