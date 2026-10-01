import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import {
  ok,
  withApi,
  errPermission,
  errValidation,
  errConflict,
  errNotFound,
  errBusiness,
  ErrorCodes,
} from '@/lib/api'
import { requireApi, isResponse, requireBranchAccess, requireCanAssignRole } from '@/lib/auth-api'
import { recordAudit, getRequestMeta } from '@/lib/audit'
import { UserRole, Relationship, UserStatus } from '@prisma/client'
import { FamilyUserService } from '@/lib/users/family-user-service'
import { normalizeFamilyCreateInput } from '@/lib/users/user-validation'
import { normalizeRole } from '@/lib/roles'

/** GET /api/v1/users — directory with role/search filtering & pagination (users:read) */
export const GET = withApi(async (req: NextRequest) => {
  const session = await requireApi(req, 'users:read')
  if (isResponse(session)) return session
  if (!session.tenantId) {
    throw errPermission('Tenant context required')
  }

  const url = new URL(req.url)
  const roleFilter = url.searchParams.get('role') as UserRole | null
  const statusFilter = url.searchParams.get('status') as string | null
  const rawBranchFilter = url.searchParams.get('branchId') || url.searchParams.get('branch')
  const branchFilter =
    rawBranchFilter && rawBranchFilter !== 'undefined' && rawBranchFilter !== 'null'
      ? rawBranchFilter
      : null
  const departmentFilter = url.searchParams.get('department')?.toLowerCase()?.trim()
  const designationFilter = url.searchParams.get('designation')?.toLowerCase()?.trim()
  const userTypeFilter = url.searchParams.get('userType')?.toUpperCase() // 'STAFF' | 'PARENT'
  const query = url.searchParams.get('q')?.toLowerCase()?.trim()
  const activeTab = (url.searchParams.get('activeTab') || 'ALL').toUpperCase()
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '50')))

  const effectiveRoles = session.roles && session.roles.length > 0 ? session.roles : [session.role]
  const isInstitutionWide = effectiveRoles.some((r) =>
    ['OWNER', 'PRINCIPAL', 'PLATFORM_ADMIN'].includes(r)
  )

  let effectiveBranchId: string | undefined = undefined
  if (!isInstitutionWide && session.branchId) {
    if (branchFilter && branchFilter !== session.branchId) {
      throw errPermission('Access denied: branch scope restricted')
    }
    effectiveBranchId = session.branchId
  } else if (branchFilter) {
    effectiveBranchId = branchFilter
  }

  // Build the tenantUser where clause
  const buildWhere = (
    opts: { skipRole?: boolean; skipStatus?: boolean; skipUserType?: boolean } = {}
  ) => {
    const { skipRole = false, skipStatus = false, skipUserType = false } = opts
    const w: any = {
      tenantId: session.tenantId,
      deletedAt: null,
      ...(!skipRole && roleFilter
        ? { OR: [{ role: roleFilter }, { roles: { has: roleFilter } }] }
        : {}),
      ...(!skipStatus && statusFilter && ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'].includes(statusFilter)
        ? { status: statusFilter }
        : {}),
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      ...(!skipUserType && userTypeFilter === 'PARENT'
        ? { OR: [{ role: 'PARENT' }, { roles: { has: 'PARENT' } }] }
        : !skipUserType && userTypeFilter === 'GUARDIAN'
        ? { OR: [{ role: 'GUARDIAN' }, { roles: { has: 'GUARDIAN' } }] }
        : !skipUserType && userTypeFilter === 'FAMILY'
        ? { OR: [{ role: { in: ['PARENT', 'GUARDIAN'] } }, { roles: { hasSome: ['PARENT', 'GUARDIAN'] } }] }
        : !skipUserType && userTypeFilter === 'STAFF'
        ? { AND: [{ role: { notIn: ['PARENT', 'GUARDIAN'] } }, { NOT: { roles: { hasSome: ['PARENT', 'GUARDIAN'] } } }] }
        : {}),
      ...(departmentFilter || designationFilter
        ? {
            user: {
              staffProfile: {
                ...(departmentFilter
                  ? { department: { contains: departmentFilter, mode: 'insensitive' } }
                  : {}),
                ...(designationFilter
                  ? { designation: { contains: designationFilter, mode: 'insensitive' } }
                  : {}),
              },
            },
          }
        : {}),
      ...(query
        ? {
            user: {
              OR: [
                { fullName: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
                { phone: { contains: query } },
                { username: { contains: query, mode: 'insensitive' } },
                { staffProfile: { employeeCode: { contains: query, mode: 'insensitive' } } },
                { staffProfile: { designation: { contains: query, mode: 'insensitive' } } },
                {
                  guardianProfile: {
                    studentLinks: {
                      some: { student: { admissionNo: { contains: query, mode: 'insensitive' } } },
                    },
                  },
                },
                {
                  guardianProfile: {
                    studentLinks: {
                      some: { student: { firstName: { contains: query, mode: 'insensitive' } } },
                    },
                  },
                },
              ],
            },
          }
        : {}),
    }
    return w
  }

  const where = buildWhere()

  const isRoleTab = [
    'TEACHER',
    'STAFF',
    'ACCOUNTS',
    'RECEPTIONIST',
    'ATTENDANT',
    'DRIVER',
    'PRINCIPAL',
    'COORDINATOR',
    'PARENT',
    'GUARDIAN',
  ].includes(activeTab)
  const baseWhere = buildWhere({
    skipRole: isRoleTab,
    skipUserType: activeTab === 'STAFF' || activeTab === 'FAMILY',
    skipStatus: activeTab === 'PENDING',
  })

  const countByRole = (role: UserRole) =>
    db.tenantUser.count({ where: { ...baseWhere, OR: [{ role }, { roles: { has: role } }] } })

  const tabAllP = db.tenantUser.count({ where: baseWhere })
  const tabStaffP = db.tenantUser.count({
    where: {
      ...baseWhere,
      AND: [
        { role: { notIn: ['PARENT', 'GUARDIAN'] } },
        { NOT: { roles: { hasSome: ['PARENT', 'GUARDIAN'] } } },
      ],
    },
  })
  const tabTeacherP = countByRole('TEACHER')
  const tabParentP = countByRole('PARENT')
  const tabGuardianP = countByRole('GUARDIAN')
  const tabPrincipalP = countByRole('PRINCIPAL')
  const tabCoordinatorP = countByRole('COORDINATOR')
  const tabAccountsP = countByRole('ACCOUNTS')
  const tabReceptionistP = countByRole('RECEPTIONIST')
  const tabAttendantP = countByRole('ATTENDANT')
  const tabDriverP = countByRole('DRIVER')
  const tabPendingP = db.tenantUser.count({ where: { ...baseWhere, status: 'PENDING' } })

  const [
    total,
    members,
    activeCount,
    pendingCount,
    suspendedCount,
    inactiveCount,
    tabAll,
    tabStaff,
    tabTeacher,
    tabParent,
    tabGuardian,
    tabPrincipal,
    tabCoordinator,
    tabAccounts,
    tabReceptionist,
    tabAttendant,
    tabDriver,
    tabPending,
  ] = await Promise.all([
    db.tenantUser.count({ where }),
    db.tenantUser.findMany({
      where,
      include: {
        user: {
          include: {
            staffProfile: true,
            taughtClasses: {
              select: { id: true, name: true, programType: true },
            },
            guardianProfile: {
              include: {
                studentLinks: {
                  include: {
                    student: {
                      select: { id: true, firstName: true, lastName: true, admissionNo: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.tenantUser.count({
      where: {
        tenantId: session.tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      },
    }),
    db.tenantUser.count({
      where: {
        tenantId: session.tenantId,
        deletedAt: null,
        status: 'PENDING',
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      },
    }),
    db.tenantUser.count({
      where: {
        tenantId: session.tenantId,
        deletedAt: null,
        status: 'SUSPENDED',
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      },
    }),
    db.tenantUser.count({
      where: {
        tenantId: session.tenantId,
        deletedAt: null,
        status: 'INACTIVE',
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      },
    }),
    tabAllP,
    tabStaffP,
    tabTeacherP,
    tabParentP,
    tabGuardianP,
    tabPrincipalP,
    tabCoordinatorP,
    tabAccountsP,
    tabReceptionistP,
    tabAttendantP,
    tabDriverP,
    tabPendingP,
  ])

  return ok(
    members.map((m) => {
      const assignedRoles: UserRole[] = m.roles && m.roles.length > 0 ? m.roles : [m.role]
      return {
        id: m.id,
        userId: m.user.id,
        username: m.user.username,
        avatarUrl: m.user.avatarUrl,
        name: m.user.fullName,
        email: m.user.email,
        phone: m.user.phone,
        role: m.role,
        roles: assignedRoles,
        status: m.status,
        branchId: m.branchId,
        lastLoginAt: m.user.lastLoginAt,
        createdAt: m.createdAt,
        staffProfile: m.user.staffProfile
          ? {
              employeeCode: m.user.staffProfile.employeeCode,
              designation: m.user.staffProfile.designation,
              department: m.user.staffProfile.department,
              qualification: m.user.staffProfile.qualification,
              employmentType: m.user.staffProfile.employmentType,
              joiningDate: m.user.staffProfile.joiningDate
                ? m.user.staffProfile.joiningDate.toISOString()
                : null,
              dateOfBirth: m.user.staffProfile.dateOfBirth
                ? m.user.staffProfile.dateOfBirth.toISOString()
                : null,
              gender: m.user.staffProfile.gender,
              currentAddress: m.user.staffProfile.currentAddress,
            }
          : null,
        taughtClasses: m.user.taughtClasses,
        guardianProfile: m.user.guardianProfile
          ? {
              id: m.user.guardianProfile.id,
              relationship: m.user.guardianProfile.relationship,
              students: m.user.guardianProfile.studentLinks.map((sl) => ({
                id: sl.student.id,
                name: `${sl.student.firstName} ${sl.student.lastName || ''}`.trim(),
                admissionNo: sl.student.admissionNo,
                canPickup: sl.canPickup,
                receivesComm: sl.receivesComm,
                pickupPin: sl.pickupPin,
                relationship: sl.relationship || m.user.guardianProfile!.relationship,
              })),
            }
          : null,
      }
    }),
    {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      kpis: {
        total: activeCount + pendingCount + suspendedCount + inactiveCount,
        active: activeCount,
        pending: pendingCount,
        suspended: suspendedCount,
        inactive: inactiveCount,
      },
      tabs: {
        ALL: tabAll,
        STAFF: tabStaff,
        TEACHER: tabTeacher,
        PARENT: tabParent,
        GUARDIAN: tabGuardian,
        PRINCIPAL: tabPrincipal,
        COORDINATOR: tabCoordinator,
        ACCOUNTS: tabAccounts,
        RECEPTIONIST: tabReceptionist,
        ATTENDANT: tabAttendant,
        DRIVER: tabDriver,
        PENDING: tabPending,
      },
    }
  )
}, { module: 'users' })

/** POST /api/v1/users — create/invite user with role and relations (users:write) */
export const POST = withApi(async (req: NextRequest) => {
  const session = await requireApi(req, 'users:write')
  if (isResponse(session)) return session
  if (!session.tenantId) {
    throw errPermission('Tenant context required')
  }

  const body = await req.json()
  const {
    fullName,
    email,
    password,
    role,
    roles: inputRoles,
    primaryRole,
    additionalRoles: inputAdditionalRoles,
    phone,
    avatarUrl,
    branchId,
    classroomId,
    guardianId,
    studentId,
    studentIds: inputStudentIds,
    relationship,
    pickupPin,
    canPickup,
    isPrimary,
    designation,
    employeeCode,
    department,
    qualification,
    employmentType,
    dateOfBirth,
    gender,
    joiningDate,
    status: inputStatus,
    isInvite,
  } = body as {
    fullName: string
    email: string
    password: string
    role?: UserRole
    roles?: UserRole[]
    primaryRole?: UserRole
    additionalRoles?: UserRole[]
    phone?: string
    avatarUrl?: string
    branchId?: string
    classroomId?: string
    guardianId?: string
    studentId?: string
    studentIds?: string[]
    relationship?: Relationship
    pickupPin?: string
    canPickup?: boolean
    isPrimary?: boolean
    designation?: string
    employeeCode?: string
    department?: string
    qualification?: string
    employmentType?: any
    dateOfBirth?: string
    gender?: any
    joiningDate?: string
    status?: UserStatus
    isInvite?: boolean
  }

  // Determine roles array and primary role
  let assignedRoles: UserRole[] = []
  if (inputRoles && Array.isArray(inputRoles) && inputRoles.length > 0) {
    assignedRoles = [...new Set(inputRoles.map((r) => normalizeRole(r) as UserRole))]
  } else if (inputAdditionalRoles && Array.isArray(inputAdditionalRoles) && inputAdditionalRoles.length > 0) {
    const primary = normalizeRole(primaryRole || role || ('TEACHER' as UserRole)) as UserRole
    const others = inputAdditionalRoles.map((r) => normalizeRole(r) as UserRole)
    assignedRoles = [...new Set([primary, ...others])]
  } else if (role) {
    assignedRoles = [normalizeRole(role) as UserRole]
  }

  if (!fullName || !email || assignedRoles.length === 0) {
    throw errValidation('fullName, email, and at least one role are required', 'fullName')
  }

  const effectivePassword = password && password.length >= 6 ? password : 'PreOneUser@2026'

  // Primary role defaults to primaryRole if in assignedRoles, else first role in array, else input role
  const normPrimaryRole = primaryRole ? (normalizeRole(primaryRole) as UserRole) : undefined
  const finalPrimaryRole: UserRole =
    normPrimaryRole && assignedRoles.includes(normPrimaryRole)
      ? normPrimaryRole
      : assignedRoles[0]

  // Validate role escalation using centralized helper
  const roleErr = requireCanAssignRole(session, assignedRoles)
  if (roleErr) return roleErr

  // Validate branch boundary using centralized helper
  if (branchId) {
    const branchErr = requireBranchAccess(session, branchId)
    if (branchErr) return branchErr
  }

  const initialStatus: UserStatus = inputStatus || (isInvite ? 'PENDING' : 'ACTIVE')

  const isFamilyFlow =
    assignedRoles.length === 1 &&
    (assignedRoles.includes('PARENT') || assignedRoles.includes('GUARDIAN')) &&
    Boolean(
      (body as any).childMode ||
      (body as any).newChild ||
      (body as any).studentFullName ||
      (body as any).studentDateOfBirth ||
      (body as any).childFirstName ||
      (body as any).studentId ||
      (body as any).studentAdmissionNo ||
      (body as any).existingChild ||
      (body as any).parentGuardianFullName
    )

  if (isFamilyFlow) {
    const familyInput = normalizeFamilyCreateInput({
      ...body,
      fullName: fullName || (body as any).parentGuardianFullName,
      email: email || (body as any).parentGuardianEmail,
      phone: phone || (body as any).parentGuardianPhone,
      role: finalPrimaryRole,
      password: effectivePassword,
      status: initialStatus,
      branchId: branchId || undefined,
    })

    const familyResult = await FamilyUserService.createFamilyUser(
      {
        tenantId: session.tenantId!,
        actorId: session.userId,
        actorName: session.fullName,
        actorRole: session.role,
        actorBranchId: session.branchId,
        reqMeta: getRequestMeta(req),
      },
      familyInput
    )

    return ok(
      {
        id: familyResult.user.id,
        email: familyResult.user.email,
        fullName: familyResult.user.fullName,
        username: familyResult.user.username,
        role: finalPrimaryRole,
        roles: assignedRoles,
        status: familyResult.user.status,
        membershipId: familyResult.membership?.id,
        guardianId: familyResult.guardian?.id,
        studentId: familyResult.student?.id,
        student: familyResult.student,
        isNewStudent: familyResult.isNewStudent,
      },
      { status: 201 }
    )
  }

  const emailNorm = email.toLowerCase().trim()
  const phoneNorm = phone?.trim() || null

  // Check email uniqueness within tenant
  const existingTenantUser = await db.tenantUser.findFirst({
    where: {
      tenantId: session.tenantId,
      user: { email: emailNorm },
      deletedAt: null,
    },
  })
  if (existingTenantUser) {
    throw errConflict(
      'An account with this email already belongs to this school',
      ErrorCodes.CONFLICT_DUPLICATE_EMAIL,
      'email'
    )
  }

  // Check phone uniqueness within tenant if provided
  if (phoneNorm) {
    const existingPhoneUser = await db.tenantUser.findFirst({
      where: {
        tenantId: session.tenantId,
        user: { phone: phoneNorm },
        deletedAt: null,
      },
    })
    if (existingPhoneUser) {
      throw errConflict(
        'An account with this mobile number already exists in this school',
        ErrorCodes.CONFLICT_DUPLICATE_PHONE,
        'phone'
      )
    }
  }

  // Run creation inside an atomic transaction
  const result = await db.$transaction(async (tx) => {
    let user = await tx.user.findUnique({ where: { email: emailNorm } })

    if (!user) {
      user = await tx.user.create({
        data: {
          email: emailNorm,
          fullName: fullName.trim(),
          username: (body as any).username?.trim() || undefined,
          phone: phoneNorm,
          avatarUrl: avatarUrl?.trim() || null,
          passwordHash: await bcrypt.hash(effectivePassword, 10),
          status: initialStatus,
        },
      })
    } else {
      // Update user name/phone/username if provided
      await tx.user.update({
        where: { id: user.id },
        data: {
          fullName: fullName.trim(),
          ...(phoneNorm ? { phone: phoneNorm } : {}),
          ...((body as any).username ? { username: (body as any).username.trim() } : {}),
          ...(avatarUrl ? { avatarUrl: avatarUrl.trim() } : {}),
          status: initialStatus,
        },
      })
    }

    // Create TenantUser membership with primary role and roles array
    const membership = await tx.tenantUser.create({
      data: {
        tenantId: session.tenantId!,
        userId: user.id,
        role: finalPrimaryRole,
        roles: assignedRoles,
        branchId: branchId || null,
        status: initialStatus,
      },
    })

    // If any assigned role is PARENT or GUARDIAN, resolve or link guardian profile
    if (assignedRoles.includes('PARENT') || assignedRoles.includes('GUARDIAN')) {
      let guardian: any = null

      // 1. Explicit guardianId provided
      if (guardianId) {
        guardian = await tx.guardian.findFirst({
          where: { id: guardianId, tenantId: session.tenantId! },
          include: { user: true },
        })
        if (!guardian) {
          throw errNotFound(`Guardian ${guardianId} not found in this school`, ErrorCodes.NOT_FOUND_GUARDIAN)
        }

        // Check for collision if already linked to another active user
        if (guardian.userId && guardian.userId !== user.id) {
          if (guardian.user && guardian.user.status !== 'INACTIVE') {
            throw errConflict(
              `Guardian "${guardian.fullName}" is already linked to parent account (${guardian.user.email}). Cannot reassign without manual unlinking.`
            )
          }
        }

        if (guardian.userId !== user.id) {
          guardian = await tx.guardian.update({
            where: { id: guardianId },
            data: { userId: user.id },
          })
        }
      } else {
        // 2. Check if this user is already linked to a guardian in this tenant
        guardian = await tx.guardian.findFirst({
          where: { userId: user.id, tenantId: session.tenantId! },
        })

        // 3. Match existing guardian by email
        if (!guardian && emailNorm) {
          const byEmail = await tx.guardian.findFirst({
            where: { tenantId: session.tenantId!, email: emailNorm, deletedAt: null },
            include: { user: true },
          })
          if (byEmail) {
            if (byEmail.userId && byEmail.userId !== user.id) {
              // Different active account linked to this email
            } else {
              guardian = await tx.guardian.update({
                where: { id: byEmail.id },
                data: { userId: user.id },
              })
            }
          }
        }

        // 4. Match existing guardian by phone
        if (!guardian && phoneNorm) {
          const byPhone = await tx.guardian.findFirst({
            where: { tenantId: session.tenantId!, phone: phoneNorm, deletedAt: null },
            include: { user: true },
          })
          if (byPhone) {
            const nameMatches =
              byPhone.fullName.toLowerCase().trim() === fullName.trim().toLowerCase()
            if (nameMatches) {
              if (!byPhone.userId || byPhone.userId === user.id) {
                guardian = await tx.guardian.update({
                  where: { id: byPhone.id },
                  data: { userId: user.id },
                })
              }
            }
          }
        }

        // 5. If no safe existing guardian found, create a new Guardian record
        if (!guardian) {
          guardian = await tx.guardian.create({
            data: {
              tenantId: session.tenantId!,
              fullName: fullName.trim(),
              phone: phoneNorm || '',
              email: emailNorm,
              relationship: (relationship as Relationship) || 'OTHER',
              pickupPin: pickupPin?.trim() || null,
              userId: user.id,
              isPrimaryContact: Boolean(isPrimary),
            },
          })
        }
      }

      // 6. Link to student(s) if provided
      const targetStudentIds: string[] = []
      if (studentId) targetStudentIds.push(studentId)
      if (Array.isArray(inputStudentIds)) {
        for (const s of inputStudentIds) {
          if (typeof s === 'string' && s && !targetStudentIds.includes(s)) targetStudentIds.push(s)
        }
      }
      const inputAdmissionNo = (body as any).studentAdmissionNo
      const inputAdmissionNos = (body as any).studentAdmissionNos
      if (inputAdmissionNo && typeof inputAdmissionNo === 'string') {
        const s = await tx.student.findFirst({
          where: {
            tenantId: session.tenantId!,
            admissionNo: inputAdmissionNo.trim(),
            deletedAt: null,
          },
          select: { id: true },
        })
        if (s && !targetStudentIds.includes(s.id)) targetStudentIds.push(s.id)
      }
      if (Array.isArray(inputAdmissionNos)) {
        for (const adm of inputAdmissionNos) {
          if (typeof adm === 'string' && adm.trim()) {
            const s = await tx.student.findFirst({
              where: {
                tenantId: session.tenantId!,
                admissionNo: adm.trim(),
                deletedAt: null,
              },
              select: { id: true },
            })
            if (s && !targetStudentIds.includes(s.id)) targetStudentIds.push(s.id)
          }
        }
      }

      for (const sid of targetStudentIds) {
        const student = await tx.student.findFirst({
          where: { id: sid, tenantId: session.tenantId!, deletedAt: null },
        })
        if (student) {
          await tx.$queryRaw`SELECT id FROM students WHERE id = ${sid} FOR UPDATE`

          // Enforce Max 2 Parents policy if PARENT role
          if (assignedRoles.includes('PARENT')) {
            const currentParents = await FamilyUserService.countActiveParentsForStudent(
              session.tenantId!,
              sid,
              user.id,
              tx
            )
            if (currentParents >= 2) {
              throw errBusiness(
                ErrorCodes.BUSINESS_PARENT_LIMIT_EXCEEDED,
                `Child ${student.firstName} already has 2 registered Parent accounts. An additional caregiver must be registered with the GUARDIAN role.`
              )
            }
          }

          const effectiveIsFeePayer =
            (body as any).isFeePayer !== undefined
              ? Boolean((body as any).isFeePayer)
              : assignedRoles.includes('PARENT')
          const effectiveReceivesComm =
            (body as any).receivesComm !== false && (body as any).receivesCommunication !== false

          const existingLink = await tx.studentGuardian.findUnique({
            where: { studentId_guardianId: { studentId: sid, guardianId: guardian.id } },
          })
          if (!existingLink) {
            await tx.studentGuardian.create({
              data: {
                studentId: sid,
                guardianId: guardian.id,
                relationship: relationship ? (relationship as Relationship) : guardian.relationship,
                canPickup: canPickup !== false,
                pickupPin: pickupPin?.trim() || null,
                isPrimary: Boolean(isPrimary),
                isFeePayer: effectiveIsFeePayer,
                receivesComm: effectiveReceivesComm,
              },
            })
          } else {
            await tx.studentGuardian.update({
              where: { id: existingLink.id },
              data: {
                relationship: relationship ? (relationship as Relationship) : guardian.relationship,
                canPickup: canPickup !== false,
                pickupPin: pickupPin?.trim() || guardian.pickupPin || null,
                isPrimary: Boolean(isPrimary),
                isFeePayer: effectiveIsFeePayer,
                receivesComm: effectiveReceivesComm,
              },
            })
          }
        }
      }
    }

    // If any assigned role is staff or designation provided, ensure StaffProfile exists
    const isStaff = assignedRoles.some((r) =>
      ['OWNER', 'PRINCIPAL', 'COORDINATOR', 'TEACHER', 'STAFF', 'ACCOUNTS', 'RECEPTIONIST', 'ATTENDANT', 'DRIVER'].includes(r)
    )

    if (isStaff || designation) {
      const existingProfile = await tx.staffProfile.findUnique({
        where: { userId: user.id },
      })

      let finalEmpCode = employeeCode?.trim()
      if (!finalEmpCode) {
        if (existingProfile?.employeeCode) {
          finalEmpCode = existingProfile.employeeCode
        } else {
          const prefix = assignedRoles.includes('TEACHER') ? 'TCH' : 'EMP'
          const count = await tx.staffProfile.count({ where: { tenantId: session.tenantId! } })
          finalEmpCode = `${prefix}-${String(count + 1).padStart(4, '0')}`
        }
      }

      const parsedDob = dateOfBirth ? new Date(dateOfBirth) : undefined
      const parsedJoining = joiningDate ? new Date(joiningDate) : undefined

      if (existingProfile) {
        await tx.staffProfile.update({
          where: { id: existingProfile.id },
          data: {
            employeeCode: finalEmpCode,
            designation: designation?.trim() || existingProfile.designation,
            department: department?.trim() || existingProfile.department,
            qualification: qualification?.trim() || existingProfile.qualification,
            employmentType: employmentType || existingProfile.employmentType,
            branchId: branchId || existingProfile.branchId,
            ...(parsedDob ? { dateOfBirth: parsedDob } : {}),
            ...(gender ? { gender } : {}),
            ...(parsedJoining ? { joiningDate: parsedJoining } : {}),
          },
        })
      } else {
        await tx.staffProfile.create({
          data: {
            tenantId: session.tenantId!,
            userId: user.id,
            employeeCode: finalEmpCode,
            designation: designation?.trim() || null,
            department: department?.trim() || null,
            qualification: qualification?.trim() || null,
            employmentType: employmentType || 'REGULAR',
            branchId: branchId || null,
            dateOfBirth: parsedDob || null,
            gender: gender || null,
            joiningDate: parsedJoining || null,
          },
        })
      }
    }

    // If TEACHER is among the assigned roles and classroomId is assigned, set primaryTeacherId
    if (assignedRoles.includes('TEACHER') && classroomId) {
      const classroom = await tx.classroom.findFirst({
        where: { id: classroomId, tenantId: session.tenantId! },
      })
      if (!classroom) {
        throw errNotFound(`Classroom ${classroomId} not found in this school`, ErrorCodes.NOT_FOUND_CLASSROOM)
      }
      await tx.classroom.update({
        where: { id: classroomId },
        data: { primaryTeacherId: user.id },
      })
    }

    return { user, membership, assignedRoles, finalPrimaryRole }
  })

  const meta = getRequestMeta(req)
  await recordAudit({
    tenantId: session.tenantId,
    branchId: branchId || undefined,
    actorId: session.uid,
    actorName: session.name,
    actorRole: session.role,
    action: 'CREATE_USER',
    entity: 'User',
    entityId: result.user.id,
    module: 'Users',
    summary: `Created user ${fullName} with roles [${result.assignedRoles.join(', ')}] (primary: ${result.finalPrimaryRole})`,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    newValues: {
      id: result.membership.id,
      userId: result.user.id,
      email: emailNorm,
      fullName: fullName.trim(),
      role: result.finalPrimaryRole,
      roles: result.assignedRoles,
      branchId: branchId || null,
      designation: designation?.trim() || null,
    },
  })

  return ok(
    {
      id: result.membership.id,
      userId: result.user.id,
      membershipId: result.membership.id,
      fullName: result.user.fullName,
      email: result.user.email,
      phone: result.user.phone,
      role: result.finalPrimaryRole,
      roles: result.assignedRoles,
      status: result.membership.status,
      branchId: result.membership.branchId,
    },
    undefined,
    201
  )
}, { module: 'users' })
