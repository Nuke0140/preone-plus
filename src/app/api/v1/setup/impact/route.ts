import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'

/**
 * POST /api/v1/setup/impact
 * Analyzes the downstream cascade impact of proposed configuration changes:
 * - CLASS_CAPACITY_CHANGE: checks enrolled students vs new capacity
 * - ACADEMIC_YEAR_TRANSITION: checks active sessions, admissions, and fee plans
 * - PROGRAM_DEACTIVATION: checks active classrooms, students, and applicants
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'settings:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { actionType, targetId, proposedValue } = body as {
      actionType: 'CLASS_CAPACITY_CHANGE' | 'ACADEMIC_YEAR_TRANSITION' | 'PROGRAM_DEACTIVATION'
      targetId: string
      proposedValue?: unknown
    }

    if (!actionType || !targetId) {
      return Errors.validation('actionType and targetId are required')
    }

    if (actionType === 'CLASS_CAPACITY_CHANGE') {
      const classroom = await db.classroom.findFirst({
        where: { id: targetId, tenantId: session.tenantId },
        include: {
          _count: { select: { students: true } },
          students: { select: { id: true, firstName: true, lastName: true } },
        },
      })
      if (!classroom) return Errors.notFound('Classroom')

      const currentEnrolled = classroom._count.students
      const newCapacity = Number(proposedValue)

      const warnings: string[] = []
      let requiresConfirmation = false

      if (newCapacity < currentEnrolled) {
        requiresConfirmation = true
        warnings.push(
          `Proposed capacity (${newCapacity}) is less than current enrollment (${currentEnrolled} active students). Over-allocation violation.`
        )
      } else if (newCapacity < classroom.capacity) {
        warnings.push(
          `Reducing capacity from ${classroom.capacity} to ${newCapacity} leaves ${newCapacity - currentEnrolled} remaining seats.`
        )
      }

      return ok({
        actionType,
        targetId,
        targetName: classroom.name,
        currentCapacity: classroom.capacity,
        proposedCapacity: newCapacity,
        affectedStudents: currentEnrolled,
        warnings,
        requiresConfirmation,
        canProceed: newCapacity >= currentEnrolled,
      })
    }

    if (actionType === 'ACADEMIC_YEAR_TRANSITION') {
      const targetSession = await db.academicSession.findFirst({
        where: { id: targetId, tenantId: session.tenantId },
      })
      if (!targetSession) return Errors.notFound('Academic session')

      const [activeClassrooms, pendingApplications, activeFeePlans] = await Promise.all([
        db.classroom.count({ where: { academicSessionId: targetId, tenantId: session.tenantId, isActive: true } }),
        db.admissionApplication.count({ where: { tenantId: session.tenantId, status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'DOCS_PENDING', 'INTERVIEW_SCHEDULED'] } } }),
        db.feePlan.count({ where: { tenantId: session.tenantId, isActive: true } }),
      ])

      const warnings: string[] = []
      if (activeClassrooms > 0) {
        warnings.push(`This academic year currently links to ${activeClassrooms} active classrooms.`)
      }
      if (pendingApplications > 0) {
        warnings.push(`${pendingApplications} admissions applications are currently pending in the pipeline.`)
      }

      return ok({
        actionType,
        targetId,
        targetName: targetSession.name,
        activeClassrooms,
        pendingApplications,
        activeFeePlans,
        warnings,
        requiresConfirmation: activeClassrooms > 0 || pendingApplications > 0,
        canProceed: true,
      })
    }

    if (actionType === 'PROGRAM_DEACTIVATION') {
      const program = await db.program.findFirst({
        where: { id: targetId, tenantId: session.tenantId },
        include: {
          classrooms: { select: { id: true, name: true } },
        },
      })
      if (!program) return Errors.notFound('Program')

      const activeClassrooms = program.classrooms.length
      const [applications, students] = await Promise.all([
        db.admissionApplication.count({
          where: { tenantId: session.tenantId, programType: program.programType, status: { notIn: ['ENROLLED', 'REJECTED', 'WITHDRAWN'] } },
        }),
        db.student.count({
          where: { tenantId: session.tenantId, currentClassroom: { programId: targetId }, deletedAt: null },
        }),
      ])

      const warnings: string[] = []
      if (activeClassrooms > 0) warnings.push(`${activeClassrooms} classrooms are currently designated for this program.`)
      if (students > 0) warnings.push(`${students} enrolled students are currently studying in this program.`)
      if (applications > 0) warnings.push(`${applications} pending admission applicants applied for this program.`)

      return ok({
        actionType,
        targetId,
        targetName: program.name,
        affectedClassrooms: activeClassrooms,
        affectedStudents: students,
        affectedApplications: applications,
        warnings,
        requiresConfirmation: activeClassrooms > 0 || students > 0 || applications > 0,
        canProceed: activeClassrooms === 0 && students === 0,
      })
    }

    if (actionType === 'SUBJECT_DEACTIVATION') {
      const subject = await db.subject.findFirst({
        where: { id: targetId, tenantId: session.tenantId },
        include: {
          classroomMappings: {
            include: { classroom: { select: { id: true, name: true } } },
          },
          programMappings: {
            include: { program: { select: { id: true, name: true } } },
          },
        },
      })
      if (!subject) return Errors.notFound('Subject')

      const activeClassrooms = subject.classroomMappings.length
      const activePrograms = subject.programMappings.length
      const warnings: string[] = []
      if (activeClassrooms > 0) {
        warnings.push(
          `Subject is actively assigned to ${activeClassrooms} classroom(s): ${subject.classroomMappings.map((m) => m.classroom.name).join(', ')}`
        )
      }
      if (activePrograms > 0) {
        warnings.push(
          `Subject is mapped to ${activePrograms} program(s): ${subject.programMappings.map((m) => m.program.name).join(', ')}`
        )
      }

      return ok({
        actionType,
        targetId,
        targetName: subject.name,
        affectedClassrooms: activeClassrooms,
        affectedPrograms: activePrograms,
        warnings,
        requiresConfirmation: activeClassrooms > 0 || activePrograms > 0,
        canProceed: true,
      })
    }

    return Errors.validation(`Unknown actionType: ${actionType}`)
  } catch (e) {
    return Errors.system(e)
  }
}

export const POST = withApi(_POST)
