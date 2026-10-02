import { UserRole, Relationship, UserStatus, EmploymentType, Gender, BloodGroup, ProgramType } from '@prisma/client'

export interface StaffCreateInput {
  avatarUrl?: string | null
  fullName: string
  email: string
  phone?: string | null
  username?: string
  password?: string
  role?: UserRole
  roles?: UserRole[]
  primaryRole?: UserRole
  additionalRoles?: UserRole[]
  branchId?: string | null
  employeeCode?: string
  designation?: string
  department?: string
  qualification?: string
  employmentType?: EmploymentType
  joiningDate?: string | Date | null
  dateOfBirth?: string | Date | null
  gender?: Gender | null
  reportingManagerId?: string | null
  classroomId?: string
  status?: UserStatus
}

export interface FamilyCreateInput {
  avatarUrl?: string | null
  role: 'PARENT' | 'GUARDIAN'
  fullName: string
  email: string
  phone: string
  gender?: Gender | null
  username?: string
  password?: string
  status?: UserStatus
  relationship: Relationship
  isPrimaryContact?: boolean
  childMode: 'CREATE' | 'EXISTING'
  existingChild?: {
    studentId?: string
    admissionNo?: string
  }
  additionalChildren?: Array<{
    studentId?: string
    admissionNo?: string
    relationship?: Relationship
  }>
  newChild?: {
    admissionNo?: string
    username?: string
    firstName: string
    lastName?: string
    dob: string | Date
    gender: Gender
    bloodGroup?: BloodGroup
    programType?: ProgramType
    branchId?: string
    classroomId?: string
    seatNumber?: string
    photoUrl?: string
    address?: string
    academicSessionId?: string
  }
  permissions: {
    canPickup?: boolean
    pickupPin?: string | null
    receivesCommunication?: boolean
    isFeePayer?: boolean
  }
  confirmDuplicate?: boolean
}

/**
 * Normalizes input from both canonical fields and unified creation aliases:
 * parentGuardian* and student*
 */
export function normalizeFamilyCreateInput(body: any): FamilyCreateInput {
  const fullName = (body.fullName || body.parentGuardianFullName || '').trim()
  const email = (body.email || body.parentGuardianEmail || '').trim().toLowerCase()
  const phone = (body.phone || body.parentGuardianPhone || '').trim()
  const avatarUrl = body.avatarUrl || body.parentGuardianPhoto || null
  const rawRole = (body.role || body.parentGuardianRole || 'PARENT').toUpperCase()
  const role: 'PARENT' | 'GUARDIAN' = rawRole === 'GUARDIAN' ? 'GUARDIAN' : 'PARENT'
  const gender = body.gender || body.parentGuardianGender || null
  const username = body.username || body.parentGuardianUsername || undefined
  const password = body.password || undefined
  const relationship = (body.relationship || body.relationToChild || (role === 'PARENT' ? 'FATHER' : 'GUARDIAN')) as Relationship
  const isPrimaryContact =
    body.isPrimary !== undefined
      ? Boolean(body.isPrimary)
      : body.isPrimaryContact !== undefined
      ? Boolean(body.isPrimaryContact)
      : true

  const hasNewChildSignals =
    body.childMode === 'CREATE' ||
    Boolean(body.newChild) ||
    Boolean(body.studentFullName) ||
    Boolean(body.studentDateOfBirth) ||
    Boolean(body.childFirstName)

  const childMode: 'CREATE' | 'EXISTING' = hasNewChildSignals ? 'CREATE' : 'EXISTING'

  let newChild = body.newChild
  if (childMode === 'CREATE') {
    const studentFullName = (body.studentFullName || '').trim()
    const names = studentFullName ? studentFullName.split(' ') : []
    const firstName = (body.childFirstName || body.firstName || newChild?.firstName || (names.length > 0 ? names[0] : '')).trim()
    const lastName = (
      body.childLastName ||
      body.lastName ||
      newChild?.lastName ||
      (names.length > 1 ? names.slice(1).join(' ') : undefined)
    )?.trim() || undefined
    const dob = body.studentDateOfBirth || body.childDOB || body.dob || newChild?.dob || ''
    const studentGender = (body.studentGender || body.childGender || body.gender || newChild?.gender || 'MALE') as Gender
    const bloodGroup = (body.studentBloodGroup || body.childBloodGroup || body.bloodGroup || newChild?.bloodGroup || undefined) as BloodGroup | undefined
    const branchId = body.studentBranch || body.childBranchId || body.branchId || newChild?.branchId || undefined
    const classroomId = body.studentClass || body.childClassroomId || body.classroomId || newChild?.classroomId || undefined
    const seatNumber = body.studentSeatNumber || body.childSeatNumber || body.seatNumber || newChild?.seatNumber || undefined
    const admissionNo = body.childAdmissionNo || body.admissionNo || newChild?.admissionNo || undefined
    const programType = body.programType || newChild?.programType || undefined
    const photoUrl = body.studentPhoto || body.photoUrl || newChild?.photoUrl || undefined
    const childUsername = body.studentUsername || body.username || newChild?.username || undefined

    newChild = {
      firstName,
      lastName,
      dob,
      gender: studentGender,
      bloodGroup,
      branchId,
      classroomId,
      seatNumber,
      admissionNo,
      programType,
      photoUrl,
      username: childUsername,
    }
  }

  const existingChild =
    body.existingChild ||
    (body.studentId || body.studentAdmissionNo
      ? { studentId: body.studentId, admissionNo: body.studentAdmissionNo }
      : undefined)

  const permissions = {
    canPickup: body.canPickup !== false && body.permissions?.canPickup !== false,
    pickupPin: body.pickupPin?.trim() || body.permissions?.pickupPin?.trim() || null,
    receivesCommunication:
      body.receivesComm !== false &&
      body.receivesCommunication !== false &&
      body.permissions?.receivesCommunication !== false,
    isFeePayer:
      body.isFeePayer !== undefined
        ? Boolean(body.isFeePayer)
        : body.permissions?.isFeePayer !== undefined
        ? Boolean(body.permissions.isFeePayer)
        : role === 'PARENT',
  }

  return {
    avatarUrl,
    role,
    fullName,
    email,
    phone,
    gender,
    username,
    password,
    status: body.status || 'ACTIVE',
    relationship,
    isPrimaryContact,
    childMode,
    existingChild,
    additionalChildren: body.additionalChildren,
    newChild,
    permissions,
    confirmDuplicate: body.confirmDuplicate,
  }
}

export function validateStaffInput(input: StaffCreateInput): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!input.fullName || !input.fullName.trim()) {
    errors.push('Full name is required')
  }

  if (input.email && input.email.trim()) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
      errors.push('Invalid email address format')
    }
  } else {
    if (!input.username?.trim() && !input.phone?.trim()) {
      errors.push('Either email, username, or phone is required')
    }
  }

  // Staff phone is mandatory — schools depend on it for SMS alerts & emergencies
  if (!input.phone || !input.phone.trim()) {
    errors.push('Mobile phone number is required for staff members (used for SMS alerts & emergencies)')
  } else {
    const digits = input.phone.replace(/[^\d]/g, '')
    if (digits.length < 10) {
      errors.push('Mobile phone number must contain at least 10 digits')
    }
  }

  const assignedRoles =
    input.roles && input.roles.length > 0
      ? input.roles
      : input.additionalRoles && input.additionalRoles.length > 0
      ? [input.primaryRole || input.role || ('TEACHER' as UserRole), ...input.additionalRoles]
      : input.primaryRole
      ? [input.primaryRole]
      : input.role
      ? [input.role]
      : []
  if (assignedRoles.length === 0) {
    errors.push('At least one staff role must be specified')
  }

  // Ensure staff does not contain PARENT, GUARDIAN, or PLATFORM_ADMIN
  for (const r of assignedRoles) {
    if (r === 'PARENT' || r === 'GUARDIAN') {
      errors.push('Parent and Guardian roles cannot be created via Staff creation flow')
    }
    if (r === 'PLATFORM_ADMIN') {
      errors.push('PLATFORM_ADMIN role cannot be assigned through school staff workflow')
    }
  }

  if (input.password !== undefined && input.password !== null && input.password !== '') {
    if (input.password.length < 6) {
      errors.push('Password must be at least 6 characters')
    }
  }

  return { valid: errors.length === 0, errors }
}

export function validateFamilyInput(input: FamilyCreateInput): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (input.role !== 'PARENT' && input.role !== 'GUARDIAN') {
    errors.push('Role must be either PARENT or GUARDIAN')
  }

  if (!input.fullName || !input.fullName.trim()) {
    errors.push('Full name is required')
  }

  if (input.email && input.email.trim()) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
      errors.push('Invalid email address format')
    }
  }

  if (!input.phone || !input.phone.trim()) {
    errors.push('Mobile phone number is required')
  }

  if (input.password !== undefined && input.password !== null && input.password !== '') {
    if (input.password.length < 6) {
      errors.push('Password must be at least 6 characters')
    }
  }

  if (!input.relationship) {
    errors.push('Relationship to child is required')
  }

  if (input.childMode === 'EXISTING') {
    if (!input.existingChild?.studentId && !input.existingChild?.admissionNo) {
      errors.push('Existing student must be selected')
    }
  } else if (input.childMode === 'CREATE') {
    if (!input.newChild?.firstName || !input.newChild.firstName.trim()) {
      errors.push('Child first name is required')
    }
    if (!input.newChild?.dob) {
      errors.push('Child date of birth is required')
    }
    if (!input.newChild?.gender) {
      errors.push('Child gender is required')
    }
  } else {
    errors.push('Invalid childMode: must be CREATE or EXISTING')
  }

  if (input.permissions?.pickupPin) {
    const pin = input.permissions.pickupPin.trim()
    if (!/^\d{4,6}$/.test(pin)) {
      errors.push('Pickup PIN must be 4 to 6 numeric digits')
    }
  }

  return { valid: errors.length === 0, errors }
}
