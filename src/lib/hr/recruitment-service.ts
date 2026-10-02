import { db } from '@/lib/db'
import { AuditService } from '@/lib/audit/audit-service'
import { StaffService } from './staff-service'
import type { JobApplicationStatus, JobOpeningStatus, InterviewStatus } from '@prisma/client'

export class RecruitmentService {
  /**
   * Create Job Opening
   */
  static async createJobOpening(
    tenantId: string,
    data: {
      title: string
      department: string
      designation: string
      branchId?: string | null
      openingsCount?: number
      minExperienceYears?: number
      qualificationRequired?: string
      description?: string
      closingDate?: Date | string
    },
    actor: { id: string; name: string; role: string }
  ) {
    const opening = await db.jobOpening.create({
      data: {
        tenantId,
        title: data.title,
        department: data.department,
        designation: data.designation,
        branchId: data.branchId || null,
        openingsCount: data.openingsCount ?? 1,
        minExperienceYears: data.minExperienceYears ?? 0,
        qualificationRequired: data.qualificationRequired || null,
        description: data.description || null,
        closingDate: data.closingDate ? new Date(data.closingDate) : null,
        status: 'OPEN',
      },
    })

    await AuditService.record({
      tenantId,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'JOB_OPENING_CREATED',
      entity: 'JobOpening',
      entityId: opening.id,
      module: 'HR',
      summary: `Created job opening for ${opening.title} (${opening.designation})`,
      severity: 'INFO',
    })

    return opening
  }

  /**
   * Submit Job Application
   */
  static async applyForJob(
    tenantId: string,
    jobOpeningId: string,
    data: {
      candidateName: string
      email: string
      phone: string
      currentLocation?: string
      highestQualification?: string
      experienceYears?: number
      resumeUrl?: string
      notes?: string
    }
  ) {
    const opening = await db.jobOpening.findFirst({
      where: { id: jobOpeningId, tenantId },
    })
    if (!opening) throw new Error('Job opening not found')

    return await db.jobApplication.create({
      data: {
        tenantId,
        jobOpeningId,
        candidateName: data.candidateName,
        email: data.email,
        phone: data.phone,
        currentLocation: data.currentLocation || null,
        highestQualification: data.highestQualification || null,
        experienceYears: data.experienceYears ?? 0,
        resumeUrl: data.resumeUrl || null,
        notes: data.notes || null,
        status: 'APPLIED',
      },
    })
  }

  /**
   * Schedule Interview
   */
  static async scheduleInterview(
    tenantId: string,
    jobApplicationId: string,
    data: {
      roundName: string
      scheduledAt: Date | string
      interviewerId?: string
      interviewerName?: string
    }
  ) {
    const app = await db.jobApplication.findFirst({
      where: { id: jobApplicationId, tenantId },
    })
    if (!app) throw new Error('Application not found')

    return await db.$transaction(async (tx) => {
      const interview = await tx.interview.create({
        data: {
          jobApplicationId,
          roundName: data.roundName,
          scheduledAt: new Date(data.scheduledAt),
          interviewerId: data.interviewerId || null,
          interviewerName: data.interviewerName || null,
          status: 'SCHEDULED',
        },
      })

      await tx.jobApplication.update({
        where: { id: jobApplicationId },
        data: { status: 'INTERVIEW' },
      })

      return interview
    })
  }

  /**
   * Convert Hired Candidate directly to Staff Member
   */
  static async convertCandidateToStaff(
    tenantId: string,
    jobApplicationId: string,
    staffData: {
      employeeCode: string
      joiningDate: Date | string
      branchId?: string | null
      basicSalary?: number
    },
    actor: { id: string; name: string; role: string }
  ) {
    const app = await db.jobApplication.findFirst({
      where: { id: jobApplicationId, tenantId },
      include: { jobOpening: true },
    })
    if (!app) throw new Error('Application not found')

    return await db.$transaction(async (tx) => {
      // 1. Mark Application as HIRED
      await tx.jobApplication.update({
        where: { id: jobApplicationId },
        data: { status: 'HIRED' },
      })

      // 2. Create StaffProfile using atomic StaffService logic
      const staff = await StaffService.createStaff({
        tenantId,
        branchId: staffData.branchId || app.jobOpening.branchId,
        mode: 'new',
        fullName: app.candidateName,
        email: app.email,
        phone: app.phone,
        role: app.jobOpening.designation?.toLowerCase().includes('teacher') ? 'TEACHER' : 'COORDINATOR',
        employeeCode: staffData.employeeCode,
        designation: app.jobOpening.designation,
        department: app.jobOpening.department,
        qualification: app.highestQualification,
        joiningDate: staffData.joiningDate,
        employmentType: 'REGULAR',
        salary: staffData.basicSalary ? {
          basicSalary: staffData.basicSalary,
          hra: Math.round(staffData.basicSalary * 0.4),
          specialAllowance: Math.round(staffData.basicSalary * 0.2),
        } : undefined,
      }, actor)

      await AuditService.record({
        tenantId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'CANDIDATE_CONVERTED_TO_STAFF',
        entity: 'JobApplication',
        entityId: jobApplicationId,
        module: 'HR',
        summary: `Converted candidate ${app.candidateName} to staff member (${staffData.employeeCode})`,
        severity: 'INFO',
      }, tx)

      return staff
    })
  }

  /**
   * Move Candidate Pipeline Stage
   */
  static async updateApplicationStatus(
    tenantId: string,
    jobApplicationId: string,
    status: JobApplicationStatus,
    actor: { id: string; name: string; role: string },
    notes?: string
  ) {
    const app = await db.jobApplication.findFirst({
      where: { id: jobApplicationId, tenantId },
    })
    if (!app) throw new Error('Application not found')

    return await db.$transaction(async (tx) => {
      const updated = await tx.jobApplication.update({
        where: { id: jobApplicationId },
        data: {
          status,
          notes: notes ? (app.notes ? `${app.notes}\n[${new Date().toISOString().split('T')[0]}] ${notes}` : notes) : undefined,
        },
      })

      await AuditService.record({
        tenantId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'CANDIDATE_STAGE_UPDATED',
        entity: 'JobApplication',
        entityId: jobApplicationId,
        module: 'HR',
        summary: `Moved candidate ${app.candidateName} stage to ${status}`,
        severity: 'INFO',
        oldValues: { status: app.status },
        newValues: { status, notes },
      }, tx)

      return updated
    })
  }

  /**
   * Record Interview Result (Feedback, Rating, Status)
   */
  static async recordInterviewResult(
    tenantId: string,
    interviewId: string,
    data: {
      status: InterviewStatus
      feedback?: string
      rating?: number
    },
    actor: { id: string; name: string; role: string }
  ) {
    const interview = await db.interview.findUnique({
      where: { id: interviewId },
      include: { jobApplication: true },
    })
    if (!interview || interview.jobApplication.tenantId !== tenantId) {
      throw new Error('Interview round not found')
    }

    return await db.$transaction(async (tx) => {
      const updated = await tx.interview.update({
        where: { id: interviewId },
        data: {
          status: data.status,
          feedback: data.feedback || undefined,
          rating: data.rating !== undefined ? data.rating : undefined,
        },
      })

      await AuditService.record({
        tenantId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'INTERVIEW_RESULT_RECORDED',
        entity: 'Interview',
        entityId: interviewId,
        module: 'HR',
        summary: `Recorded ${data.status} for interview ${interview.roundName} with ${interview.jobApplication.candidateName}`,
        severity: 'INFO',
        newValues: data,
      }, tx)

      return updated
    })
  }
}
