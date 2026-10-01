/**
 * PreOne Plus — Timetable Service
 * Class-wise / teacher-wise weekly schedule management with
 * conflict detection (teacher double-booking, room capacity not needed for preschool).
 */
import { db } from '@/lib/db'

const VALID_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export const TimetableService = {
  async listClassrooms(tenantId: string) {
    const session = await db.academicSession.findFirst({ where: { tenantId, isCurrent: true } })
      || await db.academicSession.findFirst({ where: { tenantId, status: 'ACTIVE' }, orderBy: { startDate: 'desc' } })
    const classrooms = await db.classroom.findMany({
      where: { tenantId, isActive: true, ...(session ? { academicSessionId: session.id } : {}) },
      select: { id: true, name: true, code: true, programType: true, capacity: true },
      orderBy: { name: 'asc' },
    })
    return { classrooms, academicSession: session }
  },

  /** Full weekly grid for a classroom */
  async getClassTimetable(tenantId: string, classroomId: string) {
    const classroom = await db.classroom.findFirst({
      where: { id: classroomId, tenantId },
      include: { academicSession: { select: { id: true, name: true, isCurrent: true } } },
    })
    if (!classroom) throw new Error('Classroom not found')
    const slots = await db.timetableSlot.findMany({
      where: { tenantId, classroomId },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, fullName: true } },
      },
      orderBy: [{ day: 'asc' }, { periodNumber: 'asc' }],
    })
    return { classroom, slots }
  },

  /** Weekly grid aggregated by teacher */
  async getTeacherTimetable(tenantId: string, teacherId: string) {
    const profile = await db.staffProfile.findFirst({
      where: { userId: teacherId, tenantId },
      include: { user: { select: { id: true, fullName: true } } },
    })
    if (!profile) throw new Error('Staff profile not found')
    const slots = await db.timetableSlot.findMany({
      where: { tenantId, teacherId },
      include: {
        classroom: { select: { id: true, name: true, code: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ day: 'asc' }, { periodNumber: 'asc' }],
    })
    return { teacher: profile.user, slots }
  },

  async listTeachers(tenantId: string) {
    return db.staffProfile.findMany({
      where: { tenantId, status: 'ACTIVE', deletedAt: null },
      include: { user: { select: { id: true, fullName: true } } },
      orderBy: { employeeCode: 'asc' },
    })
  },

  async upsertSlot(tenantId: string, data: {
    classroomId: string; academicSessionId: string; day: string; periodNumber: number
    startTime: string; endTime: string; subjectId?: string | null; teacherId?: string | null; label?: string | null
  }) {
    if (!VALID_DAYS.includes(data.day)) throw new Error(`Invalid day "${data.day}"`)
    if (!TIME_RE.test(data.startTime) || !TIME_RE.test(data.endTime)) throw new Error('Time must be in HH:MM 24h format')
    if (timeToMinutes(data.endTime) <= timeToMinutes(data.startTime)) throw new Error('End time must be after start time')
    if (data.periodNumber < 1 || data.periodNumber > 12) throw new Error('Period number must be 1-12')

    const classroom = await db.classroom.findFirst({ where: { id: data.classroomId, tenantId } })
    if (!classroom) throw new Error('Classroom not found')

    // teacher conflict: same day, overlapping time, different classroom
    if (data.teacherId) {
      const teacherSlots = await db.timetableSlot.findMany({
        where: { tenantId, teacherId: data.teacherId, day: data.day as any },
        include: { classroom: { select: { name: true, code: true } } },
      })
      const s = timeToMinutes(data.startTime)
      const e = timeToMinutes(data.endTime)
      for (const ts of teacherSlots) {
        if (ts.classroomId === data.classroomId && ts.periodNumber === data.periodNumber) continue
        const [tsH, tsM] = ts.startTime.split(':').map(Number)
        const [teH, teM] = ts.endTime.split(':').map(Number)
        const tsS = tsH * 60 + tsM
        const tsE = teH * 60 + teM
        if (s < tsE && e > tsS) {
          throw new Error(`Teacher is already booked in ${ts.classroom?.name || 'another class'} during this time (${ts.startTime}-${ts.endTime}, ${ts.day})`)
        }
      }
    }

    return db.timetableSlot.upsert({
      where: { classroomId_day_periodNumber: { classroomId: data.classroomId, day: data.day as any, periodNumber: data.periodNumber } },
      create: {
        tenantId,
        classroomId: data.classroomId,
        academicSessionId: data.academicSessionId || classroom.academicSessionId,
        day: data.day as any,
        periodNumber: data.periodNumber,
        startTime: data.startTime,
        endTime: data.endTime,
        subjectId: data.subjectId || null,
        teacherId: data.teacherId || null,
        label: data.label || null,
      },
      update: {
        startTime: data.startTime,
        endTime: data.endTime,
        subjectId: data.subjectId || null,
        teacherId: data.teacherId || null,
        label: data.label || null,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, fullName: true } },
      },
    })
  },

  async deleteSlot(tenantId: string, slotId: string) {
    const slot = await db.timetableSlot.findFirst({ where: { id: slotId, tenantId } })
    if (!slot) throw new Error('Slot not found')
    await db.timetableSlot.delete({ where: { id: slotId } })
    return { deleted: true }
  },

  /** Clone a day's slots to another day (fast timetable building) */
  async copyDay(tenantId: string, classroomId: string, fromDay: string, toDay: string) {
    if (!VALID_DAYS.includes(fromDay) || !VALID_DAYS.includes(toDay)) throw new Error('Invalid day')
    const slots = await db.timetableSlot.findMany({ where: { tenantId, classroomId, day: fromDay as any } })
    if (slots.length === 0) throw new Error('No slots to copy')
    let copied = 0
    for (const s of slots) {
      await db.timetableSlot.upsert({
        where: { classroomId_day_periodNumber: { classroomId, day: toDay as any, periodNumber: s.periodNumber } },
        create: {
          tenantId, classroomId, academicSessionId: s.academicSessionId,
          day: toDay as any, periodNumber: s.periodNumber,
          startTime: s.startTime, endTime: s.endTime,
          subjectId: s.subjectId, teacherId: s.teacherId, label: s.label,
        },
        update: {
          startTime: s.startTime, endTime: s.endTime,
          subjectId: s.subjectId, teacherId: s.teacherId, label: s.label,
        },
      })
      copied++
    }
    return { copied }
  },
}
