import { db } from '@/lib/db'
import { AuditService } from '@/lib/audit/audit-service'
import type { SubjectType } from '@prisma/client'

export interface CreateSubjectInput {
  name: string
  code: string
  shortName?: string
  description?: string
  subjectType?: SubjectType
  programIds?: string[]
}

export interface UpdateSubjectInput {
  name?: string
  shortName?: string
  description?: string
  subjectType?: SubjectType
  status?: string
  programIds?: string[]
}

export class SubjectService {
  /**
   * List all subjects for a tenant with optional status/type filter
   */
  static async getSubjects(
    tenantId: string,
    filter?: { status?: string; subjectType?: SubjectType }
  ) {
    return db.subject.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(filter?.status ? { status: filter.status } : {}),
        ...(filter?.subjectType ? { subjectType: filter.subjectType } : {}),
      },
      include: {
        programMappings: {
          include: {
            program: {
              select: { id: true, code: true, name: true, programType: true },
            },
          },
        },
        classroomMappings: {
          include: {
            classroom: {
              select: { id: true, name: true, code: true, branchId: true },
            },
            specialistTeacher: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
      },
      orderBy: { code: 'asc' },
    })
  }

  /**
   * Get single subject by ID or code
   */
  static async getSubject(tenantId: string, idOrCode: string) {
    return db.subject.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [{ id: idOrCode }, { code: idOrCode.toUpperCase() }],
      },
      include: {
        programMappings: {
          include: {
            program: {
              select: { id: true, code: true, name: true, programType: true },
            },
          },
        },
        classroomMappings: {
          include: {
            classroom: {
              select: { id: true, name: true, code: true, branchId: true, primaryTeacherId: true },
            },
            specialistTeacher: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
      },
    })
  }

  /**
   * Create a new Subject and optionally map to programs
   */
  static async createSubject(
    tenantId: string,
    data: CreateSubjectInput,
    actor: { id: string; name: string; role?: string }
  ) {
    const tenantExists = await db.tenant.findUnique({ where: { id: tenantId } })
    if (!tenantExists) {
      throw new Error('Tenant not found. Please log out and log in again to refresh your session.')
    }

    const code = data.code.trim().toUpperCase()
    const existing = await db.subject.findUnique({
      where: {
        tenantId_code: { tenantId, code },
      },
    })

    if (existing) {
      if (existing.deletedAt) {
        // Reactivate soft-deleted subject
        return await db.$transaction(async (tx) => {
          const updated = await tx.subject.update({
            where: { id: existing.id },
            data: {
              name: data.name.trim(),
              shortName: data.shortName?.trim() || null,
              description: data.description?.trim() || null,
              subjectType: data.subjectType || 'CORE',
              status: 'ACTIVE',
              deletedAt: null,
              updatedAt: new Date(),
            },
          })

          if (data.programIds && data.programIds.length > 0) {
            await tx.programSubject.deleteMany({ where: { subjectId: updated.id } })
            await tx.programSubject.createMany({
              data: data.programIds.map((pId) => ({
                tenantId,
                programId: pId,
                subjectId: updated.id,
              })),
              skipDuplicates: true,
            })
          }

          await AuditService.record(
            {
              tenantId,
              actorId: actor.id,
              actorName: actor.name,
              actorRole: actor.role || 'OWNER',
              action: 'SUBJECT_REACTIVATED',
              entity: 'Subject',
              entityId: updated.id,
              module: 'ACADEMICS',
              summary: `Reactivated subject ${updated.name} (${updated.code})`,
              severity: 'INFO',
            },
            tx
          )

          return updated
        })
      }
      throw new Error(`Subject with code "${code}" already exists in this school`)
    }

    return await db.$transaction(async (tx) => {
      const subject = await tx.subject.create({
        data: {
          tenantId,
          code,
          name: data.name.trim(),
          shortName: data.shortName?.trim() || null,
          description: data.description?.trim() || null,
          subjectType: data.subjectType || 'CORE',
          status: 'ACTIVE',
        },
      })

      if (data.programIds && data.programIds.length > 0) {
        await tx.programSubject.createMany({
          data: data.programIds.map((pId) => ({
            tenantId,
            programId: pId,
            subjectId: subject.id,
          })),
          skipDuplicates: true,
        })
      }

      await AuditService.record(
        {
          tenantId,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role || 'OWNER',
          action: 'SUBJECT_CREATED',
          entity: 'Subject',
          entityId: subject.id,
          module: 'ACADEMICS',
          summary: `Created subject ${subject.name} (${subject.code}) type: ${subject.subjectType}`,
          severity: 'INFO',
        },
        tx
      )

      return subject
    })
  }

  /**
   * Update Subject details and program mappings
   */
  static async updateSubject(
    tenantId: string,
    id: string,
    data: UpdateSubjectInput,
    actor: { id: string; name: string; role?: string }
  ) {
    const subject = await db.subject.findFirst({
      where: { id, tenantId, deletedAt: null },
    })
    if (!subject) throw new Error('Subject not found')

    return await db.$transaction(async (tx) => {
      const updated = await tx.subject.update({
        where: { id },
        data: {
          name: data.name !== undefined ? data.name.trim() : undefined,
          shortName: data.shortName !== undefined ? (data.shortName?.trim() || null) : undefined,
          description: data.description !== undefined ? (data.description?.trim() || null) : undefined,
          subjectType: data.subjectType !== undefined ? data.subjectType : undefined,
          status: data.status !== undefined ? data.status : undefined,
          updatedAt: new Date(),
        },
      })

      if (data.programIds !== undefined) {
        await tx.programSubject.deleteMany({ where: { subjectId: id } })
        if (data.programIds.length > 0) {
          await tx.programSubject.createMany({
            data: data.programIds.map((pId) => ({
              tenantId,
              programId: pId,
              subjectId: id,
            })),
            skipDuplicates: true,
          })
        }
      }

      await AuditService.record(
        {
          tenantId,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role || 'OWNER',
          action: 'SUBJECT_UPDATED',
          entity: 'Subject',
          entityId: id,
          module: 'ACADEMICS',
          summary: `Updated subject ${updated.name} (${updated.code})`,
          severity: 'INFO',
        },
        tx
      )

      return updated
    })
  }

  /**
   * Soft delete a subject
   */
  static async deleteSubject(
    tenantId: string,
    id: string,
    actor: { id: string; name: string; role?: string }
  ) {
    const subject = await db.subject.findFirst({
      where: { id, tenantId, deletedAt: null },
    })
    if (!subject) throw new Error('Subject not found')

    return await db.$transaction(async (tx) => {
      const deleted = await tx.subject.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: 'INACTIVE',
        },
      })

      await AuditService.record(
        {
          tenantId,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role || 'OWNER',
          action: 'SUBJECT_DELETED',
          entity: 'Subject',
          entityId: id,
          module: 'ACADEMICS',
          summary: `Deactivated subject ${subject.name} (${subject.code})`,
          severity: 'WARNING',
        },
        tx
      )

      return deleted
    })
  }

  /**
   * Map Subject to Classroom with optional specialist teacher
   */
  static async mapSubjectToClassroom(
    tenantId: string,
    classroomId: string,
    subjectId: string,
    specialistTeacherId?: string | null
  ) {
    return db.classroomSubject.upsert({
      where: {
        classroomId_subjectId: { classroomId, subjectId },
      },
      create: {
        tenantId,
        classroomId,
        subjectId,
        specialistTeacherId: specialistTeacherId || null,
      },
      update: {
        specialistTeacherId: specialistTeacherId || null,
      },
    })
  }
}
