/**
 * PreOne Plus — Health & Medical Service
 * Student health records (checkups, vaccinations, allergies, chronic
 * conditions), sick-bay visits with parent notification tracking,
 * and campus-wide medical alerts.
 */
import { db } from '@/lib/db'

export interface ActorContext {
  id: string
  name: string
  role: string
  ipAddress?: string
  userAgent?: string
}

const recordInclude = {
  student: { select: { id: true, admissionNo: true, firstName: true, lastName: true, currentClassroomId: true } },
  recordedBy: { select: { id: true, fullName: true } },
} as const

const visitInclude = {
  student: { select: { id: true, admissionNo: true, firstName: true, lastName: true, currentClassroomId: true } },
  recordedBy: { select: { id: true, fullName: true } },
} as const

export const HealthService = {
  async listRecords(tenantId: string, opts: { studentId?: string; type?: string; chronicOnly?: boolean; search?: string } = {}) {
    const where: any = { tenantId, deletedAt: null }
    if (opts.studentId) where.studentId = opts.studentId
    if (opts.type) where.type = opts.type
    if (opts.chronicOnly) where.isChronic = true
    if (opts.search) where.summary = { contains: opts.search, mode: 'insensitive' }
    return db.healthRecord.findMany({
      where,
      include: recordInclude,
      orderBy: { recordDate: 'desc' },
    })
  },

  async createRecord(tenantId: string, data: any, actor: ActorContext) {
    if (!data.studentId || !data.type || !data.summary) {
      throw new Error('studentId, type and summary are required')
    }
    const student = await db.student.findFirst({ where: { id: data.studentId, tenantId } })
    if (!student) throw new Error('Student not found')
    const validTypes = ['CHECKUP', 'VACCINATION', 'ALLERGY', 'MEDICAL_CONDITION', 'INJURY', 'DENTAL', 'VISION']
    if (!validTypes.includes(data.type)) throw new Error('Invalid record type')
    const record = await db.healthRecord.create({
      data: {
        tenantId,
        studentId: data.studentId,
        type: data.type,
        summary: String(data.summary).trim(),
        details: data.details ?? null,
        doctorName: data.doctorName ?? null,
        clinicName: data.clinicName ?? null,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
        isChronic: Boolean(data.isChronic),
        attachmentsUrl: data.attachmentsUrl ?? null,
        recordedById: actor.id,
      },
      include: recordInclude,
    })
    return record
  },

  async updateRecord(tenantId: string, id: string, data: any) {
    const record = await db.healthRecord.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!record) throw new Error('Health record not found')
    const patch: any = {}
    if (data.summary !== undefined) patch.summary = String(data.summary).trim()
    if (data.details !== undefined) patch.details = data.details
    if (data.doctorName !== undefined) patch.doctorName = data.doctorName
    if (data.clinicName !== undefined) patch.clinicName = data.clinicName
    if (data.followUpDate !== undefined) patch.followUpDate = data.followUpDate ? new Date(data.followUpDate) : null
    if (data.isChronic !== undefined) patch.isChronic = Boolean(data.isChronic)
    return db.healthRecord.update({ where: { id }, data: patch, include: recordInclude })
  },

  async deleteRecord(tenantId: string, id: string) {
    const record = await db.healthRecord.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!record) throw new Error('Health record not found')
    return db.healthRecord.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } })
  },

  async listVisits(tenantId: string, opts: { studentId?: string; date?: string } = {}) {
    const where: any = { tenantId }
    if (opts.studentId) where.studentId = opts.studentId
    if (opts.date) {
      const d = new Date(opts.date)
      const next = new Date(d)
      next.setDate(next.getDate() + 1)
      where.visitDate = { gte: d, lt: next }
    }
    return db.sickBayVisit.findMany({
      where,
      include: visitInclude,
      orderBy: { visitDate: 'desc' },
    })
  },

  async createVisit(tenantId: string, data: any, actor: ActorContext) {
    if (!data.studentId || !data.symptoms || !data.actionTaken) {
      throw new Error('studentId, symptoms and actionTaken are required')
    }
    const student = await db.student.findFirst({ where: { id: data.studentId, tenantId } })
    if (!student) throw new Error('Student not found')
    const parentNotified = Boolean(data.parentNotified)
    return db.sickBayVisit.create({
      data: {
        tenantId,
        studentId: data.studentId,
        visitDate: data.visitDate ? new Date(data.visitDate) : new Date(),
        symptoms: String(data.symptoms).trim(),
        temperatureC: data.temperatureC !== undefined && data.temperatureC !== null ? Number(data.temperatureC) : null,
        actionTaken: String(data.actionTaken).trim(),
        medicationGiven: data.medicationGiven ?? null,
        parentNotified,
        parentNotifiedAt: parentNotified ? new Date() : null,
        returnedToClassAt: data.returnedToClassAt ? new Date(data.returnedToClassAt) : null,
        recordedById: actor.id,
        notes: data.notes ?? null,
      },
      include: visitInclude,
    })
  },

  async returnToClass(tenantId: string, id: string) {
    const visit = await db.sickBayVisit.findFirst({ where: { id, tenantId } })
    if (!visit) throw new Error('Sick bay visit not found')
    if (visit.returnedToClassAt) throw new Error('Student already returned to class')
    return db.sickBayVisit.update({ where: { id }, data: { returnedToClassAt: new Date() }, include: visitInclude })
  },

  /** Campus-wide medical alerts: chronic conditions + active allergies */
  async alerts(tenantId: string) {
    const records = await db.healthRecord.findMany({
      where: { tenantId, deletedAt: null, isChronic: true, type: { in: ['ALLERGY', 'MEDICAL_CONDITION'] } },
      include: {
        student: { select: { id: true, admissionNo: true, firstName: true, lastName: true, currentClassroom: { select: { name: true } } } },
      },
      orderBy: { recordDate: 'desc' },
    })
    return records.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: `${r.student.firstName} ${r.student.lastName}`,
      admissionNo: r.student.admissionNo,
      className: r.student.currentClassroom?.name ?? null,
      type: r.type,
      summary: r.summary,
      details: r.details,
    }))
  },

  async stats(tenantId: string) {
    const records = await db.healthRecord.count({ where: { tenantId, deletedAt: null } })
    const chronic = await db.healthRecord.count({ where: { tenantId, deletedAt: null, isChronic: true } })
    const allergies = await db.healthRecord.count({ where: { tenantId, deletedAt: null, type: 'ALLERGY' } })
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const visitsToday = await db.sickBayVisit.count({
      where: { tenantId, visitDate: { gte: todayStart } },
    })
    const pendingReturn = await db.sickBayVisit.count({
      where: { tenantId, returnedToClassAt: null },
    })
    return { records, chronic, allergies, visitsToday, pendingReturn }
  },
}
