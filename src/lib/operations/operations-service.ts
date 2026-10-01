/**
 * PreOne — Operations Domain Service
 *
 * Core business orchestration for the daily operational execution layer:
 * 1. Daily Operations Dashboard & Real-Time KPIs
 * 2. Gate Scanner & Child Resolution (Admission No, Seat No, QR/Barcode)
 * 3. Morning Arrival & Late Cutoff Integration
 * 4. Attendance Synchronization & Correction Management
 * 5. Classroom Daily Care Sheets (Meals, Nap, Bathroom/Toilet, Water, Mood, Activities)
 * 6. Health Checks & Symptom Isolation Triage
 * 7. Safety Incidents & Escalation Workflow
 * 8. Authorized Pickup, PIN Verification, and Duplicate Release Prevention
 * 9. Late Pickup Duration Calculation & Finance Invoice Integration
 * 10. Daily Parent Report Aggregation
 * 11. Operational Reports & Analytics Aggregation
 *
 * Architecture Rules:
 * - Single source of truth for Student, Classroom, Staff, Guardian, Attendance, Invoice, Timeline
 * - Zero duplicate entities or tables
 * - Multi-tenant, branch, and academic session scoped
 * - Full transactional safety, audit logging, and parent timeline publishing
 */

import { db } from '@/lib/db'
import { ConfigurationService } from '@/lib/setup/config-service'
import { resolveSessionId, currentSession } from '@/lib/academic'
import { raiseFollowUp } from '@/lib/followups'
import { recordChildEvent } from '@/lib/notify'
import { recordAudit } from '@/lib/audit'
import { isoDate } from '@/lib/format'
import { dayStatus } from '@/lib/calendar'
import { nextNumber } from '@/lib/sequence'
import { OperationPolicies } from './operation-policies'
import type { AttendanceStatus, FollowUpSeverity, UserRole } from '@prisma/client'

export interface ScopeContext {
  tenantId: string
  branchId?: string | null
  academicSessionId?: string | null
  actorId?: string | null
  actorName?: string | null
  actorRole?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

export interface ArrivalInput {
  studentId?: string
  code?: string
  date?: string
  notes?: string
}

export interface PickupInput {
  studentId: string
  guardianId?: string
  phone?: string
  userId?: string
  pin?: string | null
  notes?: string
  pickupTime?: Date
}

export interface CareItemInput {
  studentId: string
  type: 'ARRIVAL' | 'MEAL' | 'NAP' | 'BATHROOM' | 'WATER' | 'MOOD' | 'ACTIVITY' | 'NOTE'
  title?: string
  body?: string
  mood?: string
  quantity?: string
  durationMinutes?: number
}

export interface HealthCheckInput {
  studentId: string
  outcome: 'CLEAR' | 'ATTENTION' | 'ISOLATE' | 'PARENT_CONTACT_REQUIRED'
  temperature?: number | null
  symptoms?: string[]
  notes?: string
}

export interface IncidentInput {
  studentId: string
  category: 'INJURY' | 'ILLNESS' | 'BEHAVIOR' | 'SAFETY' | 'EMERGENCY' | 'OTHER'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  title: string
  description: string
  location?: string
  actionTaken?: string
  witnesses?: string[]
}

export class OperationsService {
  /**
   * Verify and resolve authoritative tenant, branch, and academic session scope
   */
  static async verifyScope(
    tenantId: string,
    branchId?: string | null,
    academicSessionId?: string | null
  ) {
    if (!tenantId) throw new Error('Tenant context is required')

    const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) throw new Error('Tenant not found')

    let session: any = null
    if (academicSessionId) {
      session = await db.academicSession.findFirst({
        where: { id: academicSessionId, tenantId },
      })
    }
    if (!session) {
      session = (await ConfigurationService.getActiveAcademicYear(tenantId)) || (await currentSession(tenantId))
    }

    let branch: any = null
    if (branchId) {
      branch = await db.branch.findFirst({
        where: { id: branchId, tenantId, deletedAt: null },
      })
    }
    if (!branch) {
      branch = await ConfigurationService.getBranch(tenantId)
    }

    return { tenant, session, branch }
  }

  /**
   * 1. GET TODAY OPERATIONS DASHBOARD
   * Aggregates real-time KPIs, attendance counters, care events, and follow-ups.
   */
  static async getTodayOperations(
    tenantId: string,
    branchId?: string | null,
    academicSessionId?: string | null,
    filterDate?: string
  ) {
    const { session, branch } = await this.verifyScope(tenantId, branchId, academicSessionId)
    const dateStr = filterDate || isoDate()
    const targetDate = new Date(dateStr)

    const day = await dayStatus(tenantId, targetDate, branch?.id)

    // Load active classrooms for branch / session
    const classrooms = await db.classroom.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(branch?.id ? { branchId: branch.id } : {}),
        ...(session?.id ? { academicSessionId: session.id } : {}),
      },
      include: {
        primaryTeacher: { select: { id: true, fullName: true } },
        _count: {
          select: {
            students: { where: { status: 'ACTIVE', deletedAt: null } },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const classroomIds = classrooms.map((c) => c.id)

    // Query today attendance for these classrooms
    const attendances = await db.attendance.findMany({
      where: {
        tenantId,
        date: targetDate,
        classroomId: { in: classroomIds },
      },
      select: {
        classroomId: true,
        studentId: true,
        status: true,
        markedAt: true,
      },
    })

    const presentCount = attendances.filter((a) => ['PRESENT', 'LATE', 'HALF_DAY'].includes(a.status)).length
    const absentCount = attendances.filter((a) => a.status === 'ABSENT').length
    const lateCount = attendances.filter((a) => a.status === 'LATE').length

    const totalExpected = classrooms.reduce((acc, c) => acc + c._count.students, 0)
    const totalMarked = attendances.length
    const unmarkedCount = Math.max(0, totalExpected - totalMarked)

    // Query today pickups and arrivals from TimelineEntry
    const [arrivalsCount, pickupsCount, healthAlertsCount, openIncidentsCount] = await Promise.all([
      db.timelineEntry.count({
        where: {
          tenantId,
          type: 'ARRIVAL',
          createdAt: {
            gte: new Date(`${dateStr}T00:00:00.000Z`),
            lte: new Date(`${dateStr}T23:59:59.999Z`),
          },
        },
      }),
      db.timelineEntry.count({
        where: {
          tenantId,
          type: 'PICKUP',
          createdAt: {
            gte: new Date(`${dateStr}T00:00:00.000Z`),
            lte: new Date(`${dateStr}T23:59:59.999Z`),
          },
        },
      }),
      db.followUp.count({
        where: {
          tenantId,
          domain: 'HEALTH',
          status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'WAITING'] },
        },
      }),
      db.followUp.count({
        where: {
          tenantId,
          domain: 'SAFETY',
          status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'WAITING'] },
        },
      }),
    ])

    const pickupPendingCount = Math.max(0, presentCount - pickupsCount)

    // Section breakdown
    const sections = classrooms.map((c) => {
      const classAtt = attendances.filter((a) => a.classroomId === c.id)
      const cPresent = classAtt.filter((a) => ['PRESENT', 'LATE', 'HALF_DAY'].includes(a.status)).length
      const cAbsent = classAtt.filter((a) => a.status === 'ABSENT').length
      const cExpected = c._count.students
      return {
        id: c.id,
        name: c.name,
        programType: c.programType,
        teacher: c.primaryTeacher?.fullName || 'Unassigned',
        teacherId: c.primaryTeacherId,
        capacity: c.capacity,
        expected: cExpected,
        present: cPresent,
        absent: cAbsent,
        unmarked: Math.max(0, cExpected - classAtt.length),
        attendancePct: cExpected > 0 ? Math.round((cPresent / cExpected) * 100) : 0,
        understaffed: !c.primaryTeacherId,
      }
    })

    // Active exception follow-ups
    const followUps = await db.followUp.findMany({
      where: {
        tenantId,
        status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'WAITING'] },
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
        classroom: { select: { name: true } },
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    })

    const critical = followUps.filter((f) => f.severity === 'EMERGENCY' || f.severity === 'URGENT')
    const attention = followUps.filter((f) => f.severity === 'WARNING')

    return {
      today: dateStr,
      academicSession: session ? { id: session.id, name: session.name } : null,
      branch: branch ? { id: branch.id, name: branch.name } : null,
      schoolStatus: {
        dayStatus: day.status,
        eventTitle: day.eventTitle || null,
        attendanceExpected: day.attendanceExpected,
        open: day.workingDay,
      },
      kpis: {
        totalStudents: totalExpected,
        expectedChildren: totalExpected,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        unmarked: unmarkedCount,
        checkedIn: arrivalsCount,
        checkedOut: pickupsCount,
        pickupPending: pickupPendingCount,
        healthAlerts: healthAlertsCount,
        openIncidents: openIncidentsCount,
        attendancePct: totalExpected > 0 ? Math.round((presentCount / totalExpected) * 100) : 0,
      },
      sections,
      exceptions: {
        criticalCount: critical.length,
        attentionCount: attention.length,
        unresolvedTotal: followUps.length,
        critical: critical.map((f) => ({
          id: f.id,
          domain: f.domain,
          severity: f.severity,
          status: f.status,
          title: f.title,
          detail: f.detail,
          student: f.student ? `${f.student.firstName} ${f.student.lastName || ""}`.trim() : null,
          studentId: f.studentId,
          classroom: f.classroom?.name || null,
          createdAt: f.createdAt,
          dueAt: f.dueAt,
          responsibleRole: f.responsibleRole,
        })),
        attention: attention.map((f) => ({
          id: f.id,
          domain: f.domain,
          severity: f.severity,
          status: f.status,
          title: f.title,
          detail: f.detail,
          student: f.student ? `${f.student.firstName} ${f.student.lastName || ""}`.trim() : null,
          studentId: f.studentId,
          classroom: f.classroom?.name || null,
          createdAt: f.createdAt,
          dueAt: f.dueAt,
          responsibleRole: f.responsibleRole,
        })),
      },
    }
  }

  /**
   * 2. GATE SCANNER LOOKUP
   * Resolves student identity from scanned code (admissionNo, seatNumber, or id)
   */
  static async lookupScanEntity(tenantId: string, code: string) {
    if (!code || !code.trim()) throw new Error("Scan code is required")
    const cleanCode = code.trim()

    const student = await db.student.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { admissionNo: cleanCode },
          { seatNumber: cleanCode },
          { id: cleanCode },
        ],
      },
      include: {
        currentClassroom: {
          include: {
            primaryTeacher: { select: { id: true, fullName: true, email: true } },
          },
        },
        guardians: {
          include: { guardian: true },
        },
      },
    })

    if (!student) {
      throw new Error(`Student not recognized from scan code: "${cleanCode}"`)
    }

    const todayDate = new Date(isoDate())
    const [att, latestPickup] = await Promise.all([
      db.attendance.findUnique({
        where: {
          studentId_date: {
            studentId: student.id,
            date: todayDate,
          },
        },
      }),
      db.timelineEntry.findFirst({
        where: {
          tenantId,
          studentId: student.id,
          type: 'PICKUP',
          createdAt: {
            gte: new Date(`${isoDate()}T00:00:00.000Z`),
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return {
      student: {
        id: student.id,
        admissionNo: student.admissionNo,
        seatNumber: student.seatNumber,
        name: `${student.firstName} ${student.lastName || ""}`.trim(),
        firstName: student.firstName,
        lastName: student.lastName,
        photoUrl: student.photoUrl,
        classroomId: student.currentClassroomId,
        classroom: student.currentClassroom?.name || "Unassigned",
        teacher: student.currentClassroom?.primaryTeacher?.fullName || "Unassigned",
        status: student.status,
        todayAttendance: att?.status || null,
        isPickedUp: Boolean(latestPickup),
        pickedUpAt: latestPickup?.createdAt || null,
        guardians: student.guardians.map((g) => ({
          id: g.guardian.id,
          name: g.guardian.fullName,
          relationship: g.guardian.relationship,
          phone: g.guardian.phone,
          canPickup: g.canPickup,
          hasPin: Boolean(g.guardian.pickupPin),
          isPrimary: g.isPrimary,
        })),
      },
    }
  }

  /**
   * 3. RECORD MORNING ARRIVAL (CHECK-IN)
   * Idempotent check-in evaluating late cutoff against Setup OPERATING schedule.
   */
  static async recordArrival(ctx: ScopeContext, input: ArrivalInput) {
    const { tenant, session } = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicSessionId)
    const code = (input.code || input.studentId || "").trim()
    if (!code) throw new Error("Student ID or scan code is required")

    const student = await db.student.findFirst({
      where: {
        tenantId: ctx.tenantId,
        deletedAt: null,
        OR: [
          { admissionNo: code },
          { seatNumber: code },
          { id: code },
        ],
      },
      include: {
        currentClassroom: true,
      },
    })

    if (!student) throw new Error(`Student not recognized for arrival: "${code}"`)
    if (student.status !== 'ACTIVE') {
      throw new Error(`Cannot record arrival for inactive/withdrawn student (${student.status})`)
    }

    const todayStr = input.date || isoDate()
    const todayDate = new Date(todayStr)
    const now = new Date()

    // Evaluate late arrival policy
    const arrivalPolicy = await OperationPolicies.evaluateArrivalStatus(ctx.tenantId, now)
    const attStatus: AttendanceStatus = arrivalPolicy.isLate ? 'LATE' : 'PRESENT'

    // Check if arrival already recorded today (Idempotency)
    const existingArrival = await db.timelineEntry.findFirst({
      where: {
        tenantId: ctx.tenantId,
        studentId: student.id,
        type: 'ARRIVAL',
        createdAt: {
          gte: new Date(`${todayStr}T00:00:00.000Z`),
          lte: new Date(`${todayStr}T23:59:59.999Z`),
        },
      },
    })

    let timelineId = existingArrival?.id

    await db.$transaction(async (tx) => {
      // Upsert attendance record atomically
      await tx.attendance.upsert({
        where: {
          studentId_date: {
            studentId: student.id,
            date: todayDate,
          },
        },
        update: {
          status: attStatus,
          markedById: ctx.actorId,
          markedAt: now,
          notes: input.notes || (arrivalPolicy.isLate ? arrivalPolicy.rule : undefined),
          academicSessionId: student.currentClassroom?.academicSessionId || session?.id,
        },
        create: {
          tenantId: ctx.tenantId,
          branchId: student.branchId,
          classroomId: student.currentClassroomId || "",
          studentId: student.id,
          date: todayDate,
          status: attStatus,
          markedById: ctx.actorId,
          markedAt: now,
          notes: input.notes || (arrivalPolicy.isLate ? arrivalPolicy.rule : undefined),
          academicSessionId: student.currentClassroom?.academicSessionId || session?.id,
        },
      })

      // Only create timeline entry if not already arrived today
      if (!existingArrival) {
        const entry = await tx.timelineEntry.create({
          data: {
            tenantId: ctx.tenantId,
            studentId: student.id,
            classroomId: student.currentClassroomId,
            academicSessionId: student.currentClassroom?.academicSessionId || session?.id,
            type: 'ARRIVAL',
            title: arrivalPolicy.isLate ? 'Late arrival recorded' : 'Arrived at preschool',
            body: `Arrived at ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}. ${input.notes || ""}`.trim(),
            authorId: ctx.actorId,
          },
        })
        timelineId = entry.id
      }
    })

    // Audit log
    await recordAudit({
      tenantId: ctx.tenantId,
      branchId: student.branchId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'SCAN_ARRIVAL',
      entity: 'Attendance',
      entityId: student.id,
      module: 'Operations',
      summary: `Arrival recorded for ${student.firstName} (${attStatus}) at ${now.toLocaleTimeString('en-IN')}`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    })

    return {
      success: true,
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName || ""}`.trim(),
      status: attStatus,
      isLate: arrivalPolicy.isLate,
      time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      timelineId,
      isRepeatScan: Boolean(existingArrival),
    }
  }

  /**
   * 4. VERIFY & RECORD PICKUP (RELEASE)
   * Validates guardian authorization, checks PIN, enforces single release per day,
   * evaluates late pickup charges and generates Finance Invoices if applicable.
   */
  static async recordPickup(ctx: ScopeContext, input: PickupInput) {
    const { session } = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicSessionId)
    const { studentId, guardianId, phone, userId, pin, notes } = input

    if (!studentId || (!guardianId && !phone && !userId && !pin)) {
      throw new Error("studentId and guardian identifier (guardianId, phone, userId, or pin) are required for pickup")
    }

    const student = await db.student.findFirst({
      where: { id: studentId, tenantId: ctx.tenantId, deletedAt: null },
      include: { currentClassroom: true },
    })

    if (!student) throw new Error("Student not found")

    // Policy verification: Is person authorized? Does PIN match? Evaluates entire guardian set
    const authCheck = await OperationPolicies.verifyPickupPerson(
      ctx.tenantId,
      studentId,
      { guardianId, phone, userId, pin: pin || undefined },
      pin
    )

    if (!authCheck.authorized) {
      const attemptedTarget = guardianId || phone || userId || 'Provided-PIN'
      // SECURITY VIOLATION: Raise emergency safety follow-up and audit immediately
      await raiseFollowUp({
        tenantId: ctx.tenantId,
        branchId: student.branchId,
        domain: 'SAFETY',
        severity: 'EMERGENCY',
        title: `Unauthorized pickup blocked: ${student.firstName}`,
        detail: `Attempted pickup by ${attemptedTarget}. Reason: ${authCheck.reason}. Blocked at gate by ${ctx.actorName || "Staff"}.`,
        sourceType: 'PickupAttempt',
        sourceId: attemptedTarget,
        dedupeKey: `pickup-block:${studentId}:${isoDate()}:${Date.now()}`,
        studentId: student.id,
        classroomId: student.currentClassroomId,
        responsibleRole: 'PRINCIPAL',
      })

      await recordAudit({
        tenantId: ctx.tenantId,
        branchId: student.branchId,
        actorId: ctx.actorId,
        actorName: ctx.actorName,
        actorRole: ctx.actorRole,
        action: 'PICKUP_BLOCKED',
        entity: 'Student',
        entityId: student.id,
        module: 'Operations',
        severity: 'CRITICAL',
        summary: `BLOCKED unauthorized pickup for ${student.firstName}. Status: NOT_MATCH. Reason: ${authCheck.reason}`,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      })

      throw new Error(`Release blocked: ${authCheck.reason}`)
    }

    const todayStr = isoDate()
    const now = input.pickupTime || new Date()

    // Concurrency / Duplicate pickup prevention
    const alreadyPickedUp = await db.timelineEntry.findFirst({
      where: {
        tenantId: ctx.tenantId,
        studentId: student.id,
        type: 'PICKUP',
        createdAt: {
          gte: new Date(`${todayStr}T00:00:00.000Z`),
        },
      },
    })

    if (alreadyPickedUp) {
      throw new Error(`Student ${student.firstName} has already been released today at ${alreadyPickedUp.createdAt.toLocaleTimeString('en-IN')}`)
    }

    // Late pickup financial evaluation
    const lateCalc = await OperationPolicies.calculateLatePickup(ctx.tenantId, now)
    let invoiceCreatedId: string | null = null

    await db.$transaction(async (tx) => {
      // 1. Create TimelineEntry for pickup
      const entry = await tx.timelineEntry.create({
        data: {
          tenantId: ctx.tenantId,
          studentId: student.id,
          classroomId: student.currentClassroomId,
          academicSessionId: student.currentClassroom?.academicSessionId || session?.id,
          type: 'PICKUP',
          title: 'Released to authorized guardian',
          body: `Released to ${authCheck.guardianName} (${authCheck.relationship || "Guardian"}). Verified by ${ctx.actorName || "Staff"}. ${notes || ""}`.trim(),
          authorId: ctx.actorId,
        },
      })

      // 2. If late pickup charge applies, integrate with authoritative Finance module
      if (lateCalc.isLate && lateCalc.chargeCents > 0) {
        const invNum = await nextNumber('invoice', ctx.tenantId)
        const invoice = await tx.invoice.create({
          data: {
            tenantId: ctx.tenantId,
            branchId: student.branchId,
            studentId: student.id,
            invoiceNumber: invNum,
            title: `Late Pickup Fee — ${todayStr}`,
            subtotalCents: lateCalc.chargeCents,
            totalCents: lateCalc.chargeCents,
            balanceCents: lateCalc.chargeCents,
            dueDate: new Date(Date.now() + 7 * 864e5), // 7 days
            academicSessionId: student.currentClassroom?.academicSessionId || session?.id,
            issuedById: ctx.actorId,
            notes: lateCalc.policyNote,
            items: {
              create: [
                {
                  feeHead: 'LATE_FEE',
                  description: `Late pickup on ${todayStr} (${lateCalc.lateMinutes} mins late)`,
                  amountCents: lateCalc.chargeCents,
                },
              ],
            },
          },
        })
        invoiceCreatedId = invoice.id
      }
    })

    // Audit log
    await recordAudit({
      tenantId: ctx.tenantId,
      branchId: student.branchId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'SCAN_PICKUP_RELEASED',
      entity: 'Student',
      entityId: student.id,
      module: 'Operations',
      summary: `Authorized pickup released: ${student.firstName} to ${authCheck.guardianName}. ${lateCalc.isLate ? `(LATE: ₹${lateCalc.chargeRupees} billed)` : ""}`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    })

    return {
      success: true,
      released: true,
      status: 'MATCH' as const,
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName || ""}`.trim(),
      guardianId: authCheck.guardianId,
      guardianName: authCheck.guardianName,
      relationship: authCheck.relationship,
      releasedAt: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      latePickup: lateCalc,
      invoiceId: invoiceCreatedId,
    }
  }

  /**
   * 5. CLASSROOM OPERATIONAL BOARD
   * Returns complete student roster with attendance, meals, nap, health, and pickup state.
   */
  static async getClassroomOperationalBoard(
    tenantId: string,
    classroomId: string,
    dateStr?: string,
    requestingTeacherId?: string | null
  ) {
    const todayStr = dateStr || isoDate()
    const targetDate = new Date(todayStr)

    const classroom = await db.classroom.findFirst({
      where: { id: classroomId, tenantId },
      include: {
        primaryTeacher: { select: { id: true, fullName: true, email: true } },
        program: true,
      },
    })

    if (!classroom) throw new Error("Classroom not found")

    // Teacher classroom scoping check (RBAC)
    if (requestingTeacherId && classroom.primaryTeacherId && classroom.primaryTeacherId !== requestingTeacherId) {
      throw new Error("You are only authorized to access your assigned classroom")
    }

    const students = await db.student.findMany({
      where: {
        tenantId,
        currentClassroomId: classroomId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: {
        guardians: {
          include: { guardian: true },
        },
      },
      orderBy: { firstName: 'asc' },
    })

    const studentIds = students.map((s) => s.id)

    // Parallel fetch of attendance and today care logs
    const [attendances, todayTimeline] = await Promise.all([
      db.attendance.findMany({
        where: {
          tenantId,
          date: targetDate,
          classroomId,
        },
      }),
      db.timelineEntry.findMany({
        where: {
          tenantId,
          studentId: { in: studentIds },
          createdAt: {
            gte: new Date(`${todayStr}T00:00:00.000Z`),
            lte: new Date(`${todayStr}T23:59:59.999Z`),
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    const attendanceMap = new Map<string, any>(attendances.map((a) => [a.studentId, a]))

    const roster = students.map((s) => {
      const att = attendanceMap.get(s.id)
      const events = todayTimeline.filter((e) => e.studentId === s.id)

      const meals = events.filter((e) => e.type === 'MEAL')
      const naps = events.filter((e) => e.type === 'NAP')
      const bathrooms = events.filter((e) => e.type === 'BATHROOM')
      const healths = events.filter((e) => e.type === 'HEALTH_CHECK')
      const incidents = events.filter((e) => e.type === 'INCIDENT')
      const pickup = events.find((e) => e.type === 'PICKUP')
      const arrival = events.find((e) => e.type === 'ARRIVAL')

      const primaryGuardian = s.guardians.find((g) => g.isPrimary)?.guardian || s.guardians[0]?.guardian

      return {
        id: s.id,
        name: `${s.firstName} ${s.lastName || ""}`.trim(),
        admissionNo: s.admissionNo,
        seatNumber: s.seatNumber,
        photoUrl: s.photoUrl,
        bloodGroup: s.bloodGroup,
        primaryGuardian: primaryGuardian ? { name: primaryGuardian.fullName, phone: primaryGuardian.phone } : null,
        attendance: att?.status || 'UNMARKED',
        attendanceNotes: att?.notes || null,
        arrivedAt: arrival?.createdAt ? arrival.createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null,
        isPickedUp: Boolean(pickup),
        pickedUpAt: pickup?.createdAt ? pickup.createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null,
        careSummary: {
          mealsCount: meals.length,
          napCount: naps.length,
          bathroomCount: bathrooms.length,
          healthFlag: healths.some((h) => h.title.includes('ABNORMAL') || h.title.includes('ISOLATE')),
          incidentCount: incidents.length,
          events: events.map((e) => ({
            id: e.id,
            type: e.type,
            title: e.title,
            body: e.body,
            mood: e.mood,
            createdAt: e.createdAt.toISOString(),
            time: e.createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          })),
        },
      }
    })

    return {
      classroom: {
        id: classroom.id,
        name: classroom.name,
        program: classroom.program?.name || classroom.programType,
        teacher: classroom.primaryTeacher?.fullName || "Unassigned",
        teacherId: classroom.primaryTeacherId,
        capacity: classroom.capacity,
        studentCount: students.length,
      },
      date: todayStr,
      students: roster,
      summary: {
        total: students.length,
        present: roster.filter((r) => ['PRESENT', 'LATE', 'HALF_DAY'].includes(r.attendance)).length,
        absent: roster.filter((r) => r.attendance === 'ABSENT').length,
        late: roster.filter((r) => r.attendance === 'LATE').length,
        unmarked: roster.filter((r) => r.attendance === 'UNMARKED').length,
        pickedUp: roster.filter((r) => r.isPickedUp).length,
      },
    }
  }

  /**
   * 6. RECORD CLASSROOM CARE ITEM
   * Intake for meals, nap, bathroom, water, mood, activities into TimelineEntry.
   */
  static async recordClassroomCare(ctx: ScopeContext, items: CareItemInput[]) {
    const { session } = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicSessionId)
    if (!items || !items.length) throw new Error("No care items provided")

    const results: any[] = []

    for (const item of items) {
      const student = await db.student.findFirst({
        where: { id: item.studentId, tenantId: ctx.tenantId, deletedAt: null },
      })
      if (!student) continue

      const typeMap: Record<string, any> = {
        ARRIVAL: 'ARRIVAL',
        MEAL: 'MEAL',
        NAP: 'NAP',
        BATHROOM: 'BATHROOM',
        WATER: 'NOTE',
        MOOD: 'NOTE',
        ACTIVITY: 'ACTIVITY',
        NOTE: 'NOTE',
      }

      const mappedType = typeMap[item.type] || 'NOTE'
      const title = item.title || `${item.type.charAt(0) + item.type.slice(1).toLowerCase()} recorded`

      const entry = await recordChildEvent({
        tenantId: ctx.tenantId,
        studentId: student.id,
        classroomId: student.currentClassroomId,
        academicSessionId: session?.id,
        type: mappedType,
        title,
        body: item.body || (item.quantity ? `Quantity: ${item.quantity}` : undefined),
        mood: item.mood,
        actorId: ctx.actorId,
      })

      results.push({ studentId: student.id, entryId: entry.id, type: item.type })
    }

    return { recordedCount: results.length, results }
  }

  /**
   * 7. RECORD HEALTH CHECK
   * Triage symptoms; if concerning/abnormal, raises URGENT HEALTH FollowUp.
   */
  static async recordHealthCheck(ctx: ScopeContext, input: HealthCheckInput) {
    const { session } = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicSessionId)
    const { studentId, outcome, temperature, symptoms, notes } = input

    const student = await db.student.findFirst({
      where: { id: studentId, tenantId: ctx.tenantId, deletedAt: null },
      include: { currentClassroom: true },
    })
    if (!student) throw new Error("Student not found")

    const evaluation = OperationPolicies.evaluateHealthOutcome(outcome, temperature, symptoms)

    const symptomText = symptoms?.length ? `Symptoms: ${symptoms.join(', ')}` : ''
    const tempText = temperature ? `Temp: ${temperature}°F` : ''
    const fullBody = [tempText, symptomText, notes, evaluation.actionNeeded].filter(Boolean).join('. ')

    // Create TimelineEntry
    const entry = await recordChildEvent({
      tenantId: ctx.tenantId,
      studentId: student.id,
      classroomId: student.currentClassroomId,
      academicSessionId: student.currentClassroom?.academicSessionId || session?.id,
      type: 'HEALTH_CHECK',
      title: `Morning Health Check: ${outcome}`,
      body: fullBody,
      actorId: ctx.actorId,
    })

    let followUpId: string | null = null

    // If concerning or abnormal, create URGENT FollowUp
    if (evaluation.isConcerning) {
      const fu = await raiseFollowUp({
        tenantId: ctx.tenantId,
        branchId: student.branchId,
        domain: 'HEALTH',
        severity: evaluation.severity as FollowUpSeverity,
        title: `Health Alert — ${student.firstName} (${outcome})`,
        detail: fullBody,
        sourceType: 'HealthCheck',
        sourceId: entry.id,
        studentId: student.id,
        classroomId: student.currentClassroomId,
        academicSessionId: student.currentClassroom?.academicSessionId || session?.id,
        responsibleRole: 'PRINCIPAL',
      })
      followUpId = fu.followUp?.id || null
    }

    await recordAudit({
      tenantId: ctx.tenantId,
      branchId: student.branchId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'HEALTH_CHECK_RECORDED',
      entity: 'Student',
      entityId: student.id,
      module: 'Operations',
      summary: `Health check for ${student.firstName}: ${outcome} (${evaluation.severity})`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    })

    return {
      success: true,
      studentId: student.id,
      outcome,
      evaluation,
      timelineId: entry.id,
      followUpId,
    }
  }

  /**
   * 8. RECORD INCIDENT
   * Creates TimelineEntry, raises immediate FollowUp with P0/P1/P2 escalation, and audits.
   */
  static async recordIncident(ctx: ScopeContext, input: IncidentInput) {
    const { session } = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicSessionId)
    const { studentId, category, severity, title, description, location, actionTaken, witnesses } = input

    const student = await db.student.findFirst({
      where: { id: studentId, tenantId: ctx.tenantId, deletedAt: null },
      include: { currentClassroom: true },
    })
    if (!student) throw new Error("Student not found")

    const severityMap: Record<string, FollowUpSeverity> = {
      LOW: 'INFO',
      MEDIUM: 'WARNING',
      HIGH: 'URGENT',
      CRITICAL: 'EMERGENCY',
    }

    const followUpSeverity = severityMap[severity] || 'WARNING'

    const fullDetail = [
      `Category: ${category}`,
      location ? `Location: ${location}` : '',
      description,
      actionTaken ? `Immediate Action: ${actionTaken}` : '',
    ].filter(Boolean).join('\n')

    // 1. Create TimelineEntry
    const entry = await recordChildEvent({
      tenantId: ctx.tenantId,
      studentId: student.id,
      classroomId: student.currentClassroomId,
      academicSessionId: student.currentClassroom?.academicSessionId || session?.id,
      type: 'INCIDENT',
      title: `Incident Reported: ${title}`,
      body: description,
      actorId: ctx.actorId,
    })

    // 2. Raise FollowUp
    const fu = await raiseFollowUp({
      tenantId: ctx.tenantId,
      branchId: student.branchId,
      domain: 'SAFETY',
      severity: followUpSeverity,
      title: `Safety Incident: ${title} (${student.firstName})`,
      detail: fullDetail,
      sourceType: 'Incident',
      sourceId: entry.id,
      studentId: student.id,
      classroomId: student.currentClassroomId,
      academicSessionId: student.currentClassroom?.academicSessionId || session?.id,
      responsibleRole: severity === 'CRITICAL' || severity === 'HIGH' ? 'PRINCIPAL' : 'TEACHER',
    })

    // 3. Immutable AuditLog
    await recordAudit({
      tenantId: ctx.tenantId,
      branchId: student.branchId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'INCIDENT_CREATED',
      entity: 'Student',
      entityId: student.id,
      module: 'Operations',
      severity: severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
      summary: `Incident logged for ${student.firstName}: [${category}] ${title} (${severity})`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    })

    return {
      success: true,
      studentId: student.id,
      incidentId: entry.id,
      followUpId: fu.followUp?.id,
      severity,
    }
  }

  /**
   * 9. GENERATE DAILY PARENT REPORT
   * Aggregates real records for a student into an end-of-day summary without table duplication.
   */
  static async generateDailyReport(tenantId: string, studentId: string, dateStr?: string) {
    const todayStr = dateStr || isoDate()
    const targetDate = new Date(todayStr)

    const student = await db.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      include: {
        currentClassroom: {
          include: {
            primaryTeacher: { select: { fullName: true } },
          },
        },
      },
    })
    if (!student) throw new Error("Student not found")

    const [att, timelineEntries] = await Promise.all([
      db.attendance.findUnique({
        where: { studentId_date: { studentId, date: targetDate } },
      }),
      db.timelineEntry.findMany({
        where: {
          tenantId,
          studentId,
          createdAt: {
            gte: new Date(`${todayStr}T00:00:00.000Z`),
            lte: new Date(`${todayStr}T23:59:59.999Z`),
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    return {
      student: {
        id: student.id,
        name: `${student.firstName} ${student.lastName || ""}`.trim(),
        admissionNo: student.admissionNo,
        classroom: student.currentClassroom?.name || "Unassigned",
        teacher: student.currentClassroom?.primaryTeacher?.fullName || "Unassigned",
      },
      date: todayStr,
      attendance: att?.status || 'UNMARKED',
      timeline: timelineEntries.map((e) => ({
        id: e.id,
        type: e.type,
        title: e.title,
        body: e.body,
        mood: e.mood,
        time: e.createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      })),
      meals: timelineEntries.filter((e) => e.type === 'MEAL').map((e) => e.title),
      naps: timelineEntries.filter((e) => e.type === 'NAP').map((e) => e.title),
      health: timelineEntries.filter((e) => e.type === 'HEALTH_CHECK').map((e) => e.title),
      activities: timelineEntries.filter((e) => e.type === 'ACTIVITY').map((e) => e.title),
      pickup: timelineEntries.find((e) => e.type === 'PICKUP')?.title || 'Not yet picked up',
    }
  }
}
