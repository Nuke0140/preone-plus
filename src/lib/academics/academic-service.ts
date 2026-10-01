/**
 * PreOne — Academic Module Domain Service (M04)
 *
 * Core business rules, multi-tenant scoping, RBAC checks, and database transactions:
 * 1. Setup Master Integration: AcademicSession, Program, Classroom, Branch.
 * 2. Admissions/Students Integration: Student, StudentAllocation, Guardian, StaffProfile.
 * 3. Curriculum, Learning Areas, and Learning Goals lifecycle.
 * 4. Classroom Activity Planning & Scheduling.
 * 5. Teacher Observations & Concern Triage (FollowUp engine).
 * 6. Academic Progress Tracking with year-scoped immutability.
 * 7. Parent Portal Connectivity (TimelineEntry).
 * 8. Authoritative Academic Reports generation.
 */

import { db } from '@/lib/db'
import { ConfigurationService } from '@/lib/setup/config-service'
import { resolveSessionId, currentSession } from '@/lib/academic'
import { raiseFollowUp } from '@/lib/followups'
import { audit } from '@/lib/sequence'
import type {
  ActivityStatus,
  CurriculumStatus,
  ObservationConcern,
  ProgramType,
  ProgressStage,
} from '@prisma/client'

export interface ScopeContext {
  tenantId: string
  branchId?: string | null
  academicSessionId?: string | null
  academicYearId?: string | null
  actorId?: string | null
  actorName?: string | null
  actorRole?: string | null
}

export class AcademicService {
  /**
   * Authoritative multi-tenant and session scope resolver
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
      if (!session) throw new Error('Academic session not found or does not belong to tenant')
    } else {
      session = (await ConfigurationService.getActiveAcademicYear(tenantId)) || (await currentSession(tenantId))
    }
    if (!session) throw new Error('Active academic session is required. Configure an academic year in Setup first.')

    return {
      tenantId,
      branchId: branchId || null,
      academicSessionId: session.id as string,
      session,
    }
  }

  // =========================================================================
  // 1. DASHBOARD & AGGREGATIONS
  // =========================================================================

  /**
   * Get live, non-hardcoded Academic Dashboard statistics
   */
  static async getDashboardStats(
    ctx: ScopeContext,
    filters?: { branchId?: string; academicSessionId?: string }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, filters?.branchId || ctx.branchId, filters?.academicSessionId || ctx.academicSessionId)

    const [
      activeSession,
      programsCount,
      classroomsCount,
      teachersCount,
      enrolledStudentsCount,
      curriculumsCount,
      activitiesTodayCount,
      observationsCount,
      concernsCount,
      progressStats,
    ] = await Promise.all([
      db.academicSession.findUnique({
        where: { id: scope.academicSessionId },
        select: { id: true, name: true, startDate: true, endDate: true, status: true, isCurrent: true },
      }),
      db.program.count({
        where: { tenantId: scope.tenantId, isActive: true, deletedAt: null },
      }),
      db.classroom.count({
        where: {
          tenantId: scope.tenantId,
          academicSessionId: scope.academicSessionId,
          isActive: true,
          ...(scope.branchId ? { branchId: scope.branchId } : {}),
        },
      }),
      db.user.count({
        where: {
          memberships: { some: { tenantId: scope.tenantId, role: 'TEACHER', status: 'ACTIVE' } },
        },
      }),
      db.studentAllocation.count({
        where: {
          tenantId: scope.tenantId,
          academicSessionId: scope.academicSessionId,
          status: 'ACTIVE',
        },
      }),
      db.curriculum.count({
        where: {
          tenantId: scope.tenantId,
          status: 'ACTIVE',
          deletedAt: null,
        },
      }),
      // Activities scheduled for today
      db.classroomActivity.count({
        where: {
          tenantId: scope.tenantId,
          academicSessionId: scope.academicSessionId,
          activityDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lte: new Date(new Date().setHours(23, 59, 59, 999)),
          },
          deletedAt: null,
        },
      }),
      db.observation.count({
        where: {
          tenantId: scope.tenantId,
          academicSessionId: scope.academicSessionId,
        },
      }),
      // Concerns needing attention
      db.observation.count({
        where: {
          tenantId: scope.tenantId,
          academicSessionId: scope.academicSessionId,
          concern: { in: ['NEEDS_ATTENTION', 'URGENT'] },
        },
      }),
      // Progress milestones achieved
      db.studentProgress.groupBy({
        by: ['stage'],
        where: {
          tenantId: scope.tenantId,
          academicSessionId: scope.academicSessionId,
        },
        _count: true,
      }),
    ])

    const stageCounts: Record<string, number> = {
      NOT_STARTED: 0,
      INTRODUCED: 0,
      DEVELOPING: 0,
      ACHIEVED: 0,
    }
    progressStats.forEach((p) => {
      stageCounts[p.stage] = p._count
    })

    const totalProgressAssessed = stageCounts.INTRODUCED + stageCounts.DEVELOPING + stageCounts.ACHIEVED
    const masteryPercentage = totalProgressAssessed > 0
      ? Math.round((stageCounts.ACHIEVED / totalProgressAssessed) * 100)
      : 0

    return {
      activeSession,
      enrolledStudentsCount,
      classroomsCount,
      teachersCount,
      curriculumCount: curriculumsCount,
      activitiesCount: activitiesTodayCount,
      activitiesTodayCount,
      observationsCount,
      observationsNeedsAttentionCount: concernsCount,
      masteryPercentage,
      metrics: {
        programs: programsCount,
        classrooms: classroomsCount,
        teachers: teachersCount,
        enrolledStudents: enrolledStudentsCount,
        activeCurriculums: curriculumsCount,
        activitiesToday: activitiesTodayCount,
        totalObservations: observationsCount,
        childrenNeedingAttention: concernsCount,
        masteryPercentage,
        progressBreakdown: stageCounts,
      },
    }
  }

  // =========================================================================
  // 2. CURRICULUM MANAGEMENT
  // =========================================================================

  /**
   * List curricula within tenant
   */
  static async listCurricula(
    ctx: ScopeContext,
    filters?: { programId?: string; programType?: ProgramType; status?: CurriculumStatus }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    return db.curriculum.findMany({
      where: {
        tenantId: scope.tenantId,
        deletedAt: null,
        ...(filters?.programId ? { programId: filters.programId } : {}),
        ...(filters?.programType ? { programType: filters.programType } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
      },
      include: {
        program: { select: { id: true, name: true, code: true, programType: true } },
        academicSession: { select: { id: true, name: true } },
        _count: {
          select: {
            learningAreas: true,
            activities: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    })
  }

  /**
   * Get single curriculum with learning areas and goals
   */
  static async getCurriculum(ctx: ScopeContext, curriculumId: string) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const curriculum = await db.curriculum.findFirst({
      where: { id: curriculumId, tenantId: scope.tenantId, deletedAt: null },
      include: {
        program: true,
        academicSession: true,
        learningAreas: {
          where: { deletedAt: null },
          orderBy: { displayOrder: 'asc' },
          include: {
            goals: {
              where: { deletedAt: null },
              orderBy: { displayOrder: 'asc' },
            },
          },
        },
      },
    })

    if (!curriculum) throw new Error('Curriculum not found')
    return curriculum
  }

  /**
   * Create Curriculum and optionally seed foundational preschool learning areas
   */
  static async createCurriculum(
    ctx: ScopeContext,
    input: {
      name: string
      programId?: string
      programType?: ProgramType
      academicSessionId?: string
      framework?: string
      description?: string
      version?: number
      effectiveFrom?: Date | string
      effectiveTo?: Date | string
      seedDefaultAreas?: boolean
    }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, input.academicSessionId || ctx.academicYearId)

    if (!input.name || !input.name.trim()) throw new Error('Curriculum name is required')

    let resolvedProgramType = input.programType
    if (input.programId) {
      const prog = await db.program.findFirst({
        where: { id: input.programId, tenantId: scope.tenantId, deletedAt: null },
      })
      if (!prog) throw new Error('Selected program not found')
      resolvedProgramType = prog.programType
    }

    const curriculum = await db.$transaction(async (tx) => {
      const curr = await tx.curriculum.create({
        data: {
          tenantId: scope.tenantId,
          name: input.name.trim(),
          programId: input.programId || null,
          programType: resolvedProgramType || null,
          academicSessionId: input.academicSessionId || scope.academicSessionId,
          framework: input.framework || 'EYFS',
          description: input.description || null,
          version: input.version || 1,
          status: 'ACTIVE',
          effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
          effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
          createdBy: ctx.actorId,
        },
      })

      // Seed preschool-friendly developmental areas if requested
      if (input.seedDefaultAreas !== false) {
        const defaultAreas = [
          {
            name: 'Language & Communication',
            description: 'Verbal expression, vocabulary, listening comprehension, and phonics awareness',
            displayOrder: 1,
            goals: [
              'Listens attentively to short stories and rhymes',
              'Expresses needs, feelings, and ideas in clear sentences',
              'Recognizes common letter sounds and prints name',
            ],
          },
          {
            name: 'Early Numeracy & Logic',
            description: 'Counting, pattern recognition, spatial concepts, and simple problem solving',
            displayOrder: 2,
            goals: [
              'Counts objects 1 to 10 with 1-to-1 correspondence',
              'Identifies basic geometric shapes and primary colours',
              'Understands concepts of size, order, and simple patterns',
            ],
          },
          {
            name: 'Physical & Motor Skills',
            description: 'Gross motor coordination, balance, fine motor pincer grasp, and self-care',
            displayOrder: 3,
            goals: [
              'Demonstrates tripod pencil grip and safe scissor usage',
              'Balances, jumps, and navigates preschool play structures safely',
              'Manages independent handwashing, jacket buttons, and shoe velcro',
            ],
          },
          {
            name: 'Social & Emotional Development',
            description: 'Peer collaboration, empathy, emotion regulation, and classroom routine adaptation',
            displayOrder: 4,
            goals: [
              'Cooperates with peers in sharing materials and turn-taking',
              'Transitions smoothly between classroom activities and clean-up',
              'Identifies and regulates big emotions with gentle teacher guidance',
            ],
          },
          {
            name: 'Creative Expression & Arts',
            description: 'Music, dramatic pretend play, drawing, and sensory exploration',
            displayOrder: 5,
            goals: [
              'Engages imaginatively in role-play and dress-up activities',
              'Explores painting, clay, and sensory textures with curiosity',
              'Participates enthusiastically in rhythm, dance, and circle time songs',
            ],
          },
        ]

        for (const area of defaultAreas) {
          const la = await tx.curriculumLearningArea.create({
            data: {
              tenantId: scope.tenantId,
              curriculumId: curr.id,
              name: area.name,
              description: area.description,
              displayOrder: area.displayOrder,
            },
          })
          for (let gIdx = 0; gIdx < area.goals.length; gIdx++) {
            await tx.learningGoal.create({
              data: {
                tenantId: scope.tenantId,
                curriculumLearningAreaId: la.id,
                name: area.goals[gIdx],
                displayOrder: gIdx + 1,
              },
            })
          }
        }
      }

      return curr
    })

    await audit({
      tenantId: scope.tenantId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'CREATE_CURRICULUM',
      entity: 'Curriculum',
      entityId: curriculum.id,
      summary: `Curriculum "${curriculum.name}" created with framework ${curriculum.framework}`,
    })

    return this.getCurriculum(ctx, curriculum.id)
  }

  /**
   * Update curriculum metadata
   */
  static async updateCurriculum(
    ctx: ScopeContext,
    curriculumId: string,
    input: {
      name?: string
      description?: string
      status?: CurriculumStatus
      version?: number
      effectiveFrom?: Date | string
      effectiveTo?: Date | string
    }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const existing = await db.curriculum.findFirst({
      where: { id: curriculumId, tenantId: scope.tenantId, deletedAt: null },
    })
    if (!existing) throw new Error('Curriculum not found')

    const updated = await db.curriculum.update({
      where: { id: curriculumId },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.version !== undefined ? { version: input.version } : {}),
        ...(input.effectiveFrom !== undefined ? { effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null } : {}),
        ...(input.effectiveTo !== undefined ? { effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null } : {}),
        updatedBy: ctx.actorId,
      },
    })

    await audit({
      tenantId: scope.tenantId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'UPDATE_CURRICULUM',
      entity: 'Curriculum',
      entityId: curriculumId,
      summary: `Curriculum "${updated.name}" updated`,
    })

    return updated
  }

  /**
   * Archive curriculum (preserves historical child progress)
   */
  static async archiveCurriculum(ctx: ScopeContext, curriculumId: string) {
    return this.updateCurriculum(ctx, curriculumId, { status: 'ARCHIVED' })
  }

  // =========================================================================
  // 3. LEARNING AREAS & GOALS
  // =========================================================================

  /**
   * Add learning area to a curriculum
   */
  static async createLearningArea(
    ctx: ScopeContext,
    input: {
      curriculumId: string
      name: string
      description?: string
      displayOrder?: number
    }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const curr = await db.curriculum.findFirst({
      where: { id: input.curriculumId, tenantId: scope.tenantId, deletedAt: null },
    })
    if (!curr) throw new Error('Curriculum not found')

    const area = await db.curriculumLearningArea.create({
      data: {
        tenantId: scope.tenantId,
        curriculumId: input.curriculumId,
        name: input.name.trim(),
        description: input.description || null,
        displayOrder: input.displayOrder || 0,
      },
    })

    await audit({
      tenantId: scope.tenantId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'CREATE_LEARNING_AREA',
      entity: 'CurriculumLearningArea',
      entityId: area.id,
      summary: `Learning area "${area.name}" added to curriculum "${curr.name}"`,
    })

    return area
  }

  /**
   * Update a learning area
   */
  static async updateLearningArea(
    ctx: ScopeContext,
    areaId: string,
    input: { name?: string; description?: string; displayOrder?: number; status?: string }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const area = await db.curriculumLearningArea.findFirst({
      where: { id: areaId, tenantId: scope.tenantId, deletedAt: null },
    })
    if (!area) throw new Error('Learning area not found')

    const updated = await db.curriculumLearningArea.update({
      where: { id: areaId },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
    })

    await audit({
      tenantId: scope.tenantId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'UPDATE_LEARNING_AREA',
      entity: 'CurriculumLearningArea',
      entityId: areaId,
      summary: `Learning area "${updated.name}" updated`,
    })

    return updated
  }

  /**
   * Add a learning goal / milestone skill
   */
  static async createLearningGoal(
    ctx: ScopeContext,
    input: {
      curriculumLearningAreaId?: string
      learningAreaId?: string
      name: string
      code?: string
      description?: string
      ageMinMonths?: number
      ageMaxMonths?: number
      displayOrder?: number
    }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)
    const areaId = input.curriculumLearningAreaId || input.learningAreaId
    if (!areaId) throw new Error('curriculumLearningAreaId or learningAreaId is required')

    const area = await db.curriculumLearningArea.findFirst({
      where: { id: areaId, tenantId: scope.tenantId, deletedAt: null },
      include: { curriculum: true },
    })
    if (!area) throw new Error('Learning area not found')

    const goal = await db.learningGoal.create({
      data: {
        tenantId: scope.tenantId,
        curriculumLearningAreaId: areaId,
        name: input.name.trim(),
        description: input.description || null,
        ageMinMonths: input.ageMinMonths || null,
        ageMaxMonths: input.ageMaxMonths || null,
        displayOrder: input.displayOrder || 0,
      },
    })

    await audit({
      tenantId: scope.tenantId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'CREATE_LEARNING_GOAL',
      entity: 'LearningGoal',
      entityId: goal.id,
      summary: `Goal "${goal.name}" added to area "${area.name}"`,
    })

    return goal
  }

  /**
   * Update a learning goal
   */
  static async updateLearningGoal(
    ctx: ScopeContext,
    goalId: string,
    input: {
      name?: string
      description?: string
      ageMinMonths?: number
      ageMaxMonths?: number
      displayOrder?: number
      status?: string
    }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const goal = await db.learningGoal.findFirst({
      where: { id: goalId, tenantId: scope.tenantId, deletedAt: null },
    })
    if (!goal) throw new Error('Learning goal not found')

    const updated = await db.learningGoal.update({
      where: { id: goalId },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.ageMinMonths !== undefined ? { ageMinMonths: input.ageMinMonths } : {}),
        ...(input.ageMaxMonths !== undefined ? { ageMaxMonths: input.ageMaxMonths } : {}),
        ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
    })

    await audit({
      tenantId: scope.tenantId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'UPDATE_LEARNING_GOAL',
      entity: 'LearningGoal',
      entityId: goalId,
      summary: `Learning goal "${updated.name}" updated`,
    })

    return updated
  }

  // =========================================================================
  // 4. CLASSROOM ACTIVITIES & LESSON PLANNING
  // =========================================================================

  /**
   * List classroom activities with filters
   */
  static async listActivities(
    ctx: ScopeContext,
    filters?: {
      classroomId?: string
      curriculumId?: string
      learningGoalId?: string
      status?: ActivityStatus
      dateFrom?: Date | string
      dateTo?: Date | string
      teacherId?: string
    }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    // Role-aware teacher restrictions: Teacher only sees assigned classrooms
    let teacherClassroomId: string | undefined = undefined
    if (ctx.actorRole === 'TEACHER' && ctx.actorId) {
      const assignedClass = await db.classroom.findFirst({
        where: { tenantId: scope.tenantId, primaryTeacherId: ctx.actorId, isActive: true },
        select: { id: true },
      })
      if (assignedClass) teacherClassroomId = assignedClass.id
    }

    return db.classroomActivity.findMany({
      where: {
        tenantId: scope.tenantId,
        academicSessionId: scope.academicSessionId,
        deletedAt: null,
        classroomId: teacherClassroomId || filters?.classroomId || undefined,
        ...(filters?.curriculumId ? { curriculumId: filters.curriculumId } : {}),
        ...(filters?.learningGoalId ? { learningGoalId: filters.learningGoalId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.teacherId ? { teacherId: filters.teacherId } : {}),
        ...(filters?.dateFrom || filters?.dateTo
          ? {
              activityDate: {
                ...(filters?.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
                ...(filters?.dateTo ? { lte: new Date(filters.dateTo) } : {}),
              },
            }
          : {}),
      },
      include: {
        classroom: { select: { id: true, name: true, code: true, programType: true } },
        curriculum: { select: { id: true, name: true } },
        learningGoal: {
          select: {
            id: true,
            name: true,
            learningArea: { select: { id: true, name: true } },
          },
        },
        teacher: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: [{ activityDate: 'desc' }, { startTime: 'asc' }],
    })
  }

  /**
   * Schedule / Plan a Classroom Activity
   */
  static async createActivity(
    ctx: ScopeContext,
    input: {
      classroomId: string
      title: string
      activityDate: Date | string
      curriculumId?: string
      learningGoalId?: string
      teacherId?: string
      description?: string
      startTime?: string
      endTime?: string
      durationMinutes?: number
      materials?: string
      instructions?: string
      expectedOutcome?: string
    }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    if (!input.title || !input.title.trim()) throw new Error('Activity title is required')
    if (!input.classroomId) throw new Error('Classroom is required')

    const classroom = await db.classroom.findFirst({
      where: { id: input.classroomId, tenantId: scope.tenantId, isActive: true },
    })
    if (!classroom) throw new Error('Classroom not found or inactive')

    // Teacher authorization: If actor is TEACHER, verify assigned to this classroom
    if (ctx.actorRole === 'TEACHER' && ctx.actorId) {
      if (classroom.primaryTeacherId !== ctx.actorId) {
        throw new Error('You are only authorized to schedule activities for your assigned classroom')
      }
    }

    if (input.learningGoalId) {
      const goal = await db.learningGoal.findFirst({
        where: { id: input.learningGoalId, tenantId: scope.tenantId, deletedAt: null },
      })
      if (!goal) throw new Error('Selected learning goal not found')
    }

    const activity = await db.classroomActivity.create({
      data: {
        tenantId: scope.tenantId,
        academicSessionId: classroom.academicSessionId || scope.academicSessionId,
        classroomId: input.classroomId,
        curriculumId: input.curriculumId || null,
        learningGoalId: input.learningGoalId || null,
        teacherId: input.teacherId || classroom.primaryTeacherId || ctx.actorId,
        title: input.title.trim(),
        description: input.description || null,
        activityDate: new Date(input.activityDate),
        startTime: input.startTime || null,
        endTime: input.endTime || null,
        durationMinutes: input.durationMinutes || 30,
        materials: input.materials || null,
        instructions: input.instructions || null,
        expectedOutcome: input.expectedOutcome || null,
        status: 'PLANNED',
        createdBy: ctx.actorId,
      },
      include: {
        classroom: { select: { id: true, name: true } },
        learningGoal: { select: { id: true, name: true } },
        teacher: { select: { id: true, fullName: true } },
      },
    })

    await audit({
      tenantId: scope.tenantId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'CREATE_ACTIVITY',
      entity: 'ClassroomActivity',
      entityId: activity.id,
      summary: `Activity "${activity.title}" scheduled for ${activity.classroom.name} on ${new Date(input.activityDate).toLocaleDateString()}`,
    })

    return activity
  }

  /**
   * Update activity status or details
   */
  static async updateActivity(
    ctx: ScopeContext,
    activityId: string,
    input: {
      title?: string
      description?: string
      status?: ActivityStatus
      materials?: string
      instructions?: string
      expectedOutcome?: string
      actualOutcome?: string
    }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const activity = await db.classroomActivity.findFirst({
      where: { id: activityId, tenantId: scope.tenantId, deletedAt: null },
      include: { classroom: true },
    })
    if (!activity) throw new Error('Classroom activity not found')

    if (ctx.actorRole === 'TEACHER' && ctx.actorId) {
      if (activity.classroom.primaryTeacherId !== ctx.actorId && activity.teacherId !== ctx.actorId) {
        throw new Error('You are only authorized to modify activities for your assigned classroom')
      }
    }

    const updated = await db.classroomActivity.update({
      where: { id: activityId },
      data: {
        ...(input.title ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.materials !== undefined ? { materials: input.materials } : {}),
        ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
        ...(input.expectedOutcome !== undefined ? { expectedOutcome: input.expectedOutcome } : {}),
        ...(input.actualOutcome !== undefined ? { actualOutcome: input.actualOutcome } : {}),
        updatedBy: ctx.actorId,
      },
    })

    await audit({
      tenantId: scope.tenantId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: input.status === 'COMPLETED' ? 'COMPLETE_ACTIVITY' : 'UPDATE_ACTIVITY',
      entity: 'ClassroomActivity',
      entityId: activityId,
      summary: `Activity "${updated.title}" status updated to ${updated.status}`,
    })

    return updated
  }

  // =========================================================================
  // 5. OBSERVATIONS & LEARNING CONCERNS
  // =========================================================================

  /**
   * Record a teacher observation with optional learning goal and follow-up creation
   */
  static async recordObservation(
    ctx: ScopeContext,
    input: {
      studentId: string
      narrative: string
      category?: string
      concern?: ObservationConcern
      learningGoalId?: string
      activityId?: string
      milestoneTags?: string
      progressStage?: ProgressStage
      publishToTimeline?: boolean
    }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    if (!input.studentId) throw new Error('Student ID is required')
    if (!input.narrative || input.narrative.trim().length < 10) {
      throw new Error('Observation narrative must be at least 10 characters')
    }

    const student = await db.student.findFirst({
      where: { id: input.studentId, tenantId: scope.tenantId, deletedAt: null },
      include: {
        currentClassroom: true,
      },
    })
    if (!student) throw new Error('Student not found')

    // Scoping check for teachers
    if (ctx.actorRole === 'TEACHER' && ctx.actorId) {
      if (student.currentClassroom && student.currentClassroom.primaryTeacherId !== ctx.actorId) {
        throw new Error('You are only authorized to record observations for students in your assigned classroom')
      }
    }

    const concern = input.concern || 'NORMAL'
    const shouldPublish = input.publishToTimeline ?? false

    const result = await db.$transaction(async (tx) => {
      const obs = await tx.observation.create({
        data: {
          tenantId: scope.tenantId,
          studentId: input.studentId,
          classroomId: student.currentClassroomId,
          teacherId: ctx.actorId,
          narrative: input.narrative.trim(),
          category: input.category || null,
          concern,
          learningGoalId: input.learningGoalId || null,
          activityId: input.activityId || null,
          milestoneTags: input.milestoneTags || null,
          status: shouldPublish ? 'PUBLISHED' : 'DRAFT',
          publishedAt: shouldPublish ? new Date() : null,
          academicSessionId: scope.academicSessionId,
        },
      })

      // Update StudentProgress milestone if goal & stage supplied
      if (input.learningGoalId && input.progressStage) {
        await tx.studentProgress.upsert({
          where: {
            tenantId_academicSessionId_studentId_learningGoalId: {
              tenantId: scope.tenantId,
              academicSessionId: scope.academicSessionId,
              studentId: input.studentId,
              learningGoalId: input.learningGoalId,
            },
          },
          create: {
            tenantId: scope.tenantId,
            academicSessionId: scope.academicSessionId,
            studentId: input.studentId,
            learningGoalId: input.learningGoalId,
            stage: input.progressStage,
            assessedBy: ctx.actorId,
            assessedAt: new Date(),
            notes: `Observed: ${input.narrative.slice(0, 120)}`,
          },
          update: {
            stage: input.progressStage,
            assessedBy: ctx.actorId,
            assessedAt: new Date(),
            notes: `Observed: ${input.narrative.slice(0, 120)}`,
          },
        })
      }

      // If publish requested, create parent timeline entry
      if (shouldPublish) {
        await tx.timelineEntry.create({
          data: {
            tenantId: scope.tenantId,
            studentId: input.studentId,
            classroomId: student.currentClassroomId,
            academicSessionId: scope.academicSessionId,
            type: 'OBSERVATION',
            title: input.category ? `Learning: ${input.category}` : 'Learning Observation',
            body: input.narrative.trim(),
            authorId: ctx.actorId,
            observationId: obs.id,
          },
        })
      }

      return obs
    })

    // If concern requires attention or is urgent, raise a follow-up task
    let followUp = null
    if (concern === 'NEEDS_ATTENTION' || concern === 'URGENT') {
      const fuRes = await raiseFollowUp({
        tenantId: scope.tenantId,
        branchId: student.branchId,
        academicSessionId: scope.academicSessionId,
        domain: 'LEARNING',
        severity: concern === 'URGENT' ? 'URGENT' : 'WARNING',
        title: concern === 'URGENT' ? `Urgent Learning Attention: ${student.firstName}` : `Learning Concern: ${student.firstName}`,
        detail: input.narrative.slice(0, 250),
        sourceType: 'Observation',
        sourceId: result.id,
        dedupeKey: `learning:${result.id}`,
        studentId: student.id,
        classroomId: student.currentClassroomId,
        responsibleRole: concern === 'URGENT' ? 'PRINCIPAL' : 'TEACHER',
        actorId: ctx.actorId,
        actorName: ctx.actorName,
      })
      followUp = fuRes.followUp
    }

    await audit({
      tenantId: scope.tenantId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'RECORD_OBSERVATION',
      entity: 'Observation',
      entityId: result.id,
      summary: `Observation recorded for ${student.firstName} (Concern: ${concern})`,
    })

    return { observation: result, followUp }
  }

  /**
   * Publish an observation to the parent timeline
   */
  static async publishObservation(ctx: ScopeContext, observationId: string) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, ctx.academicYearId)

    const observation = await db.observation.findFirst({
      where: { id: observationId, tenantId: scope.tenantId },
      include: { student: true },
    })
    if (!observation) throw new Error('Observation not found')

    if (ctx.actorRole === 'TEACHER' && ctx.actorId && observation.teacherId !== ctx.actorId) {
      throw new Error('You can only publish your own observations')
    }

    if (observation.status === 'PUBLISHED') {
      return { observation, alreadyPublished: true }
    }

    const updated = await db.$transaction(async (tx) => {
      const obs = await tx.observation.update({
        where: { id: observationId },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      })

      await tx.timelineEntry.create({
        data: {
          tenantId: scope.tenantId,
          studentId: observation.studentId,
          classroomId: observation.classroomId,
          academicSessionId: observation.academicSessionId || scope.academicSessionId,
          type: 'OBSERVATION',
          title: observation.category ? `Learning: ${observation.category}` : 'Learning Observation',
          body: observation.narrative,
          authorId: ctx.actorId,
          observationId: obs.id,
        },
      })

      return obs
    })

    await audit({
      tenantId: scope.tenantId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'PUBLISH_OBSERVATION',
      entity: 'Observation',
      entityId: observationId,
      summary: `Observation published to parents of ${observation.student.firstName}`,
    })

    return { observation: updated, alreadyPublished: false }
  }

  // =========================================================================
  // 6. STUDENT PROGRESS TRACKING & MATRIX
  // =========================================================================

  /**
   * Upsert a student's progress on a learning goal within the academic session
   */
  static async updateStudentProgress(
    ctx: ScopeContext,
    studentId: string,
    input: {
      learningGoalId: string
      stage: ProgressStage
      notes?: string
      evidence?: string
      academicSessionId?: string
      createObservation?: boolean
    }
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, input.academicSessionId || ctx.academicYearId)

    const student = await db.student.findFirst({
      where: { id: studentId, tenantId: scope.tenantId, deletedAt: null },
      include: { currentClassroom: true },
    })
    if (!student) throw new Error('Student not found')

    if (ctx.actorRole === 'TEACHER' && ctx.actorId) {
      if (student.currentClassroom && student.currentClassroom.primaryTeacherId !== ctx.actorId) {
        throw new Error('You are only authorized to assess progress for students in your assigned classroom')
      }
    }

    const goal = await db.learningGoal.findFirst({
      where: { id: input.learningGoalId, tenantId: scope.tenantId, deletedAt: null },
      include: { learningArea: true },
    })
    if (!goal) throw new Error('Learning goal not found')

    const result = await db.$transaction(async (tx) => {
      const progress = await tx.studentProgress.upsert({
        where: {
          tenantId_academicSessionId_studentId_learningGoalId: {
            tenantId: scope.tenantId,
            academicSessionId: scope.academicSessionId,
            studentId,
            learningGoalId: input.learningGoalId,
          },
        },
        create: {
          tenantId: scope.tenantId,
          academicSessionId: scope.academicSessionId,
          studentId,
          learningGoalId: input.learningGoalId,
          stage: input.stage,
          notes: input.notes || null,
          evidence: input.evidence || null,
          assessedBy: ctx.actorId,
          assessedAt: new Date(),
        },
        update: {
          stage: input.stage,
          notes: input.notes || null,
          evidence: input.evidence || null,
          assessedBy: ctx.actorId,
          assessedAt: new Date(),
        },
      })

      // When milestone is ACHIEVED or observation requested, create published timeline milestone
      if (input.stage === 'ACHIEVED' || input.createObservation) {
        await tx.timelineEntry.create({
          data: {
            tenantId: scope.tenantId,
            studentId,
            classroomId: student.currentClassroomId,
            academicSessionId: scope.academicSessionId,
            type: 'MILESTONE',
            title: `Milestone Achieved: ${goal.name}`,
            body: `${student.firstName} has achieved this developmental milestone in ${goal.learningArea.name}.${input.notes ? ` Note: ${input.notes}` : ''}`,
            authorId: ctx.actorId,
          },
        })
      }

      return progress
    })

    await audit({
      tenantId: scope.tenantId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'UPDATE_STUDENT_PROGRESS',
      entity: 'StudentProgress',
      entityId: result.id,
      summary: `Progress for ${student.firstName} on "${goal.name}" set to ${input.stage}`,
    })

    return result
  }

  /**
   * Get student progress matrix across all learning areas and goals
   */
  static async getStudentProgress(
    ctx: ScopeContext,
    studentId: string,
    academicSessionId?: string
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, academicSessionId || ctx.academicYearId)

    const student = await db.student.findFirst({
      where: { id: studentId, tenantId: scope.tenantId, deletedAt: null },
      include: {
        currentClassroom: {
          include: { program: true },
        },
      },
    })
    if (!student) throw new Error('Student not found')

    // Find curriculum mapped to child's program
    const programType = student.currentClassroom?.programType || 'NURSERY'
    const curriculum = await db.curriculum.findFirst({
      where: {
        tenantId: scope.tenantId,
        programType,
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: {
        learningAreas: {
          where: { deletedAt: null },
          orderBy: { displayOrder: 'asc' },
          include: {
            goals: {
              where: { deletedAt: null },
              orderBy: { displayOrder: 'asc' },
            },
          },
        },
      },
    })

    // Fetch progress records specifically for this academic session
    const progressRecords = await db.studentProgress.findMany({
      where: {
        tenantId: scope.tenantId,
        academicSessionId: scope.academicSessionId,
        studentId,
      },
    })

    const progressMap = new Map<string, (typeof progressRecords)[0]>()
    progressRecords.forEach((p) => progressMap.set(p.learningGoalId, p))

    const areasWithProgress = (curriculum?.learningAreas || []).map((area) => {
      const goalsWithProgress = area.goals.map((g) => {
        const prog = progressMap.get(g.id)
        return {
          id: g.id,
          name: g.name,
          description: g.description,
          stage: prog?.stage || 'NOT_STARTED',
          assessedAt: prog?.assessedAt || null,
          notes: prog?.notes || null,
          evidence: prog?.evidence || null,
        }
      })

      const achievedCount = goalsWithProgress.filter((g) => g.stage === 'ACHIEVED').length
      const totalCount = goalsWithProgress.length

      return {
        id: area.id,
        name: area.name,
        description: area.description,
        masteryPercentage: totalCount > 0 ? Math.round((achievedCount / totalCount) * 100) : 0,
        goals: goalsWithProgress,
      }
    })

    return {
      student: {
        id: student.id,
        admissionNo: student.admissionNo,
        name: `${student.firstName} ${student.lastName || ''}`.trim(),
        classroom: student.currentClassroom?.name || 'Unallocated',
        program: student.currentClassroom?.program?.name || programType,
      },
      academicSessionId: scope.academicSessionId,
      learningAreas: areasWithProgress,
    }
  }

  // =========================================================================
  // 7. STUDENT 360° ACADEMIC PROFILE
  // =========================================================================

  /**
   * 360° Academic profile for a child
   */
  static async getStudentAcademicProfile(
    ctx: ScopeContext,
    studentId: string,
    academicSessionId?: string
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, academicSessionId || ctx.academicYearId)

    const student = await db.student.findFirst({
      where: { id: studentId, tenantId: scope.tenantId, deletedAt: null },
      include: {
        currentClassroom: {
          include: {
            program: true,
            primaryTeacher: { select: { id: true, fullName: true, email: true } },
          },
        },
        allocations: {
          where: { academicSessionId: scope.academicSessionId },
          include: { classroom: true },
        },
        guardians: {
          include: {
            guardian: { select: { id: true, fullName: true, phone: true, email: true, relationship: true } },
          },
        },
      },
    })
    if (!student) throw new Error('Student not found')

    // Observations
    const observations = await db.observation.findMany({
      where: {
        tenantId: scope.tenantId,
        studentId,
        academicSessionId: scope.academicSessionId,
      },
      orderBy: { observedAt: 'desc' },
      take: 20,
    })

    // Timeline events
    const timeline = await db.timelineEntry.findMany({
      where: {
        tenantId: scope.tenantId,
        studentId,
        academicSessionId: scope.academicSessionId,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    // Progress
    const progress = await this.getStudentProgress(ctx, studentId, scope.academicSessionId)

    return {
      student: {
        id: student.id,
        admissionNo: student.admissionNo,
        firstName: student.firstName,
        lastName: student.lastName,
        fullName: `${student.firstName} ${student.lastName || ''}`.trim(),
        dob: student.dob,
        gender: student.gender,
        photoUrl: student.photoUrl,
        bloodGroup: student.bloodGroup,
        classroom: student.currentClassroom?.name || 'Unallocated',
        program: student.currentClassroom?.program?.name || student.currentClassroom?.programType,
        primaryTeacher: student.currentClassroom?.primaryTeacher || null,
        guardians: student.guardians.map((g) => g.guardian),
      },
      classroom: student.currentClassroom,
      primaryTeacher: student.currentClassroom?.primaryTeacher || null,
      guardians: student.guardians.map((g) => g.guardian),
      academicSessionId: scope.academicSessionId,
      learningProgress: progress.learningAreas,
      observations,
      timeline,
    }
  }

  // =========================================================================
  // 8. ACADEMIC REPORT GENERATION
  // =========================================================================

  /**
   * Generate authoritative student progress report data
   */
  static async generateStudentReport(
    ctx: ScopeContext,
    studentId: string,
    academicSessionId?: string
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, academicSessionId || ctx.academicYearId)

    const profile = await this.getStudentAcademicProfile(ctx, studentId, scope.academicSessionId)
    const school = await db.tenant.findUnique({ where: { id: scope.tenantId } })

    // Calculate overall statistics
    let totalGoals = 0
    let achievedGoals = 0
    let developingGoals = 0
    profile.learningProgress.forEach((area) => {
      area.goals.forEach((g) => {
        totalGoals++
        if (g.stage === 'ACHIEVED') achievedGoals++
        if (g.stage === 'DEVELOPING') developingGoals++
      })
    })

    const overallMastery = totalGoals > 0 ? Math.round((achievedGoals / totalGoals) * 100) : 0

    await audit({
      tenantId: scope.tenantId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'GENERATE_REPORT',
      entity: 'StudentProgress',
      entityId: studentId,
      summary: `Academic progress report generated for ${profile.student.fullName}`,
    })

    return {
      schoolName: school?.name || 'PreOne Academy',
      academicSession: scope.session.name,
      generatedAt: new Date().toISOString(),
      student: profile.student,
      summary: {
        totalGoals,
        achievedGoals,
        developingGoals,
        overallMastery,
      },
      learningAreas: profile.learningProgress,
      recentObservations: profile.observations.filter((o) => o.status === 'PUBLISHED').slice(0, 5),
    }
  }

  /**
   * Generate classroom-wide academic progress report
   */
  static async generateClassroomReport(
    ctx: ScopeContext,
    classroomId: string,
    academicSessionId?: string
  ) {
    const scope = await this.verifyScope(ctx.tenantId, ctx.branchId, academicSessionId || ctx.academicYearId)

    const classroom = await db.classroom.findFirst({
      where: { id: classroomId, tenantId: scope.tenantId },
      include: {
        program: true,
        primaryTeacher: { select: { fullName: true, email: true } },
      },
    })
    if (!classroom) throw new Error('Classroom not found')

    const allocations = await db.studentAllocation.findMany({
      where: {
        tenantId: scope.tenantId,
        academicSessionId: scope.academicSessionId,
        classroomId,
        status: 'ACTIVE',
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, admissionNo: true },
        },
      },
    })

    const studentsProgress = await Promise.all(
      allocations.map(async (alloc) => {
        const p = await this.getStudentProgress(ctx, alloc.student.id, scope.academicSessionId)
        let total = 0
        let achieved = 0
        p.learningAreas.forEach((area) => {
          total += area.goals.length
          achieved += area.goals.filter((g) => g.stage === 'ACHIEVED').length
        })
        return {
          studentId: alloc.student.id,
          admissionNo: alloc.student.admissionNo,
          studentName: `${alloc.student.firstName} ${alloc.student.lastName || ''}`.trim(),
          masteryPercentage: total > 0 ? Math.round((achieved / total) * 100) : 0,
        }
      })
    )

    await audit({
      tenantId: scope.tenantId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: 'GENERATE_REPORT',
      entity: 'Classroom',
      entityId: classroomId,
      summary: `Classroom progress report generated for ${classroom.name}`,
    })

    return {
      classroom: {
        id: classroom.id,
        name: classroom.name,
        code: classroom.code,
        program: classroom.program?.name || classroom.programType,
        teacher: classroom.primaryTeacher?.fullName || 'Unassigned',
        enrolledCount: allocations.length,
      },
      academicSession: scope.session.name,
      students: studentsProgress,
    }
  }
}
