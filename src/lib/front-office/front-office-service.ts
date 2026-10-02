/**
 * PreOne Plus — Front Office Service
 * Visitor management (check-in/check-out with badge + ID proof) and
 * student gate passes (early leave with guardian verification + approval flow).
 */
import { db } from '@/lib/db'

export interface ActorContext {
  id: string
  name: string
  role: string
  ipAddress?: string
  userAgent?: string
}

const visitorInclude = {
  branch: { select: { id: true, name: true } },
  checkedOutBy: { select: { id: true, fullName: true } },
} as const

const gatePassInclude = {
  student: { select: { id: true, admissionNo: true, firstName: true, lastName: true, currentClassroom: { select: { name: true } } } },
  requestedBy: { select: { id: true, fullName: true } },
  approvedBy: { select: { id: true, fullName: true } },
} as const

export const FrontOfficeService = {
  // ── Visitors ──
  async listVisitors(tenantId: string, opts: { date?: string; open?: boolean; search?: string } = {}) {
    const where: any = { tenantId }
    if (opts.date) {
      const d = new Date(opts.date)
      const next = new Date(d)
      next.setDate(next.getDate() + 1)
      where.checkInAt = { gte: d, lt: next }
    }
    if (opts.open) where.checkOutAt = null
    if (opts.search) {
      where.OR = [
        { visitorName: { contains: opts.search, mode: 'insensitive' } },
        { visitorPhone: { contains: opts.search } },
        { purpose: { contains: opts.search, mode: 'insensitive' } },
      ]
    }
    return db.visitorLog.findMany({ where, include: visitorInclude, orderBy: { checkInAt: 'desc' } })
  },

  async checkInVisitor(tenantId: string, data: any, actor: ActorContext) {
    if (!data.visitorName || !data.purpose) throw new Error('visitorName and purpose are required')
    if (data.branchId) {
      const branch = await db.branch.findFirst({ where: { id: data.branchId, tenantId } })
      if (!branch) throw new Error('Branch not found')
    }
    return db.visitorLog.create({
      data: {
        tenantId,
        branchId: data.branchId ?? null,
        visitorName: String(data.visitorName).trim(),
        visitorPhone: data.visitorPhone ?? null,
        organization: data.organization ?? null,
        purpose: String(data.purpose).trim(),
        personToMeet: data.personToMeet ?? null,
        badgeNumber: data.badgeNumber ?? null,
        idProofType: data.idProofType ?? null,
        idProofNumber: data.idProofNumber ?? null,
        notes: data.notes ?? null,
      },
      include: visitorInclude,
    })
  },

  async checkOutVisitor(tenantId: string, id: string, actor: ActorContext) {
    const visitor = await db.visitorLog.findFirst({ where: { id, tenantId } })
    if (!visitor) throw new Error('Visitor entry not found')
    if (visitor.checkOutAt) throw new Error('Visitor already checked out')
    return db.visitorLog.update({
      where: { id },
      data: { checkOutAt: new Date(), checkedOutById: actor.id },
      include: visitorInclude,
    })
  },

  // ── Gate Passes ──
  async listGatePasses(tenantId: string, opts: { status?: string; studentId?: string; date?: string } = {}) {
    const where: any = { tenantId }
    if (opts.status) where.status = opts.status
    if (opts.studentId) where.studentId = opts.studentId
    if (opts.date) {
      const d = new Date(opts.date)
      const next = new Date(d)
      next.setDate(next.getDate() + 1)
      where.createdAt = { gte: d, lt: next }
    }
    return db.gatePass.findMany({ where, include: gatePassInclude, orderBy: { createdAt: 'desc' } })
  },

  async createGatePass(tenantId: string, data: any, actor: ActorContext) {
    if (!data.studentId || !data.reason) throw new Error('studentId and reason are required')
    const student = await db.student.findFirst({
      where: { id: data.studentId, tenantId },
      include: { currentClassroom: { select: { name: true } } },
    })
    if (!student) throw new Error('Student not found')
    // Sequential pass number: GP-YYYYMM-#### per tenant-month
    const now = new Date()
    const prefix = `GP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`
    const last = await db.gatePass.findFirst({
      where: { tenantId, passNumber: { startsWith: prefix } },
      orderBy: { passNumber: 'desc' },
    })
    const lastSeq = last ? Number(last.passNumber.slice(prefix.length)) : 0
    const passNumber = `${prefix}${String(lastSeq + 1).padStart(4, '0')}`
    return db.gatePass.create({
      data: {
        tenantId,
        studentId: data.studentId,
        passNumber,
        reason: String(data.reason).trim(),
        requestedById: actor.id,
        guardianName: data.guardianName ?? null,
        guardianPhone: data.guardianPhone ?? null,
        expectedReturnAt: data.expectedReturnAt ? new Date(data.expectedReturnAt) : null,
        notes: data.notes ?? null,
        // direct approval if actor requests it upfront (receptionist flow)
        status: data.autoApprove ? 'APPROVED' : 'REQUESTED',
        approvedById: data.autoApprove ? actor.id : null,
      },
      include: gatePassInclude,
    })
  },

  async updateGatePassStatus(tenantId: string, id: string, action: string, actor: ActorContext) {
    const pass = await db.gatePass.findFirst({ where: { id, tenantId } })
    if (!pass) throw new Error('Gate pass not found')
    const transitions: Record<string, { from: string[]; to: string }> = {
      approve: { from: ['REQUESTED'], to: 'APPROVED' },
      reject: { from: ['REQUESTED'], to: 'REJECTED' },
      mark_out: { from: ['APPROVED'], to: 'OUT' },
      mark_returned: { from: ['OUT'], to: 'RETURNED' },
    }
    const t = transitions[action]
    if (!t) throw new Error(`Invalid action: ${action}`)
    if (!t.from.includes(pass.status)) {
      throw new Error(`Cannot ${action} a pass in ${pass.status} state`)
    }
    const patch: any = { status: t.to }
    if (action === 'approve') patch.approvedById = actor.id
    if (action === 'mark_out') patch.outAt = new Date()
    return db.gatePass.update({ where: { id }, data: patch, include: gatePassInclude })
  },

  async stats(tenantId: string) {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayNext = new Date(todayStart)
    todayNext.setDate(todayNext.getDate() + 1)
    const visitorsToday = await db.visitorLog.count({ where: { tenantId, checkInAt: { gte: todayStart, lt: todayNext } } })
    const onPremises = await db.visitorLog.count({ where: { tenantId, checkOutAt: null } })
    const passesToday = await db.gatePass.count({ where: { tenantId, createdAt: { gte: todayStart, lt: todayNext } } })
    const pendingApprovals = await db.gatePass.count({ where: { tenantId, status: 'REQUESTED' } })
    const studentsOut = await db.gatePass.count({ where: { tenantId, status: 'OUT' } })
    return { visitorsToday, onPremises, passesToday, pendingApprovals, studentsOut }
  },
}
