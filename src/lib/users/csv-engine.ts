import { db } from '@/lib/db'
import { StaffUserService } from './staff-user-service'
import { FamilyUserService, normalizeRelationship } from './family-user-service'
import { UserRole, Relationship, UserStatus, EmploymentType, Gender, ProgramType, BloodGroup } from '@prisma/client'
import { normalizeRole, type CanonicalRole } from '@/lib/roles'

/**
 * Sanitizes a cell against spreadsheet formula injection (=, +, -, @, \t, \r)
 */
export function sanitizeCsvCell(val: string | null | undefined): string {
  if (val === null || val === undefined) return '""'
  let s = String(val).trim()
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`
  }
  return `"${s.replace(/"/g, '""')}"`
}

export function sanitizeInputCellValue(val: string): string {
  if (!val) return ''
  let cleaned = val.replace(/^["']|["']$/g, '').trim()
  if (/^[=+\-@]/.test(cleaned)) {
    cleaned = cleaned.replace(/^[=+\-@]+/, '').trim()
  }
  return cleaned
}

export function parseCsvString(csvContent: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) return { headers: [], rows: [] }

  const parseLine = (line: string): string[] => {
    const values: string[] = []
    let current = ''
    let insideQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          insideQuotes = !insideQuotes
        }
      } else if (char === ',' && !insideQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim())
    return values
  }

  const rawHeaders = parseLine(lines[0])
  const headers = rawHeaders.map((h) => h.replace(/^["']|["']$/g, '').trim())

  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const rawValues = parseLine(lines[i])
    const rowObj: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      const h = headers[j]
      const val = rawValues[j] !== undefined ? sanitizeInputCellValue(rawValues[j]) : ''
      rowObj[h] = val
    }
    rows.push(rowObj)
  }

  return { headers, rows }
}

export interface CsvPreviewRow {
  rowNumber: number
  status: 'VALID' | 'WARNING' | 'BLOCKED'
  action: 'CREATE' | 'LINK' | 'SKIP' | 'BLOCK'
  identifier: string
  name: string
  role: string
  details: string
  errors: string[]
  warnings: string[]
  data: Record<string, any>
}

export interface CsvPreviewResult {
  templateType: 'STAFF' | 'FAMILY'
  totalRows: number
  validRows: number
  warningRows: number
  blockedRows: number
  rows: CsvPreviewRow[]
}

export class UserCsvEngine {
  /**
   * Generates downloadable Staff CSV template
   */
  static getStaffTemplate(): string {
    const headers = [
      'username',
      'fullName',
      'email',
      'phone',
      'role',
      'branchCode',
      'employeeCode',
      'designation',
      'department',
      'qualification',
      'employmentType',
      'joiningDate',
      'dateOfBirth',
      'gender',
    ]

    const sampleRows = [
      ['ananya.sharma', 'Ananya Sharma', 'ananya.sharma@preschool.com', '+919876543210', 'TEACHER', 'MAIN', 'EMP-2026-01', 'Lead Montessori Teacher', 'Academics', 'B.Ed, Early Childhood Dip.', 'REGULAR', '2026-06-01', '1992-05-14', 'FEMALE'],
      ['vikas.nair', 'Vikas Nair', 'vikas.nair@preschool.com', '+919876543211', 'ACCOUNTS', 'MAIN', 'EMP-2026-02', 'Senior Accounts Officer', 'Finance', 'M.Com, Tally Pro', 'REGULAR', '2026-05-15', '1988-11-20', 'MALE'],
      ['kavita.patil', 'Kavita Patil', 'kavita.patil@preschool.com', '+919876543212', 'STAFF', 'MAIN', 'EMP-2026-03', 'Classroom Assistant', 'Operations', 'High School', 'CONTRACT', '2026-06-10', '1995-02-18', 'FEMALE'],
      ['sunil.verma', 'Sunil Verma', 'sunil.verma@preschool.com', '+919876543213', 'DRIVER', 'MAIN', 'EMP-2026-04', 'School Bus Driver', 'Transport', 'Heavy Vehicle License', 'REGULAR', '2026-05-01', '1985-08-09', 'MALE'],
    ]

    return [
      headers.map(sanitizeCsvCell).join(','),
      ...sampleRows.map((r) => r.map(sanitizeCsvCell).join(',')),
    ].join('\r\n')
  }

  /**
   * Generates downloadable Parent CSV template (max 2 per student)
   */
  static getParentTemplate(): string {
    const headers = [
      'username',
      'fullName',
      'email',
      'phone',
      'role',
      'branchCode',
      'studentAdmissionNo',
      'relationship',
      'canPickup',
      'receivesComm',
      'pickupPin',
    ]

    const sampleRows = [
      ['rahul01', 'Rahul Sharma', 'rahul@example.com', '+919876543210', 'PARENT', 'MAIN', 'PRE-1024', 'FATHER', 'true', 'true', '1234'],
      ['rahul01', 'Rahul Sharma', 'rahul@example.com', '+919876543210', 'PARENT', 'MAIN', 'PRE-1031', 'FATHER', 'true', 'true', '1234'],
      ['priya01', 'Priya Sharma', 'priya@example.com', '+919876543211', 'PARENT', 'MAIN', 'PRE-1024', 'MOTHER', 'true', 'true', '5678'],
    ]

    return [
      headers.map(sanitizeCsvCell).join(','),
      ...sampleRows.map((r) => r.map(sanitizeCsvCell).join(',')),
    ].join('\r\n')
  }

  /**
   * Generates downloadable Guardian CSV template (unlimited per student)
   */
  static getGuardianTemplate(): string {
    const headers = [
      'username',
      'fullName',
      'email',
      'phone',
      'role',
      'branchCode',
      'studentAdmissionNo',
      'relationship',
      'canPickup',
      'receivesComm',
      'pickupPin',
    ]

    const sampleRows = [
      ['sunita01', 'Sunita Sharma', 'sunita@example.com', '+919876543212', 'GUARDIAN', 'MAIN', 'PRE-1024', 'GRANDMOTHER', 'true', 'true', '4321'],
      ['ramesh.uncle', 'Ramesh Uncle', 'ramesh@example.com', '+919876543213', 'GUARDIAN', 'MAIN', 'PRE-1024', 'OTHER', 'true', 'false', '9988'],
    ]

    return [
      headers.map(sanitizeCsvCell).join(','),
      ...sampleRows.map((r) => r.map(sanitizeCsvCell).join(',')),
    ].join('\r\n')
  }

  /**
   * Generates downloadable Canonical 21-column Family CSV template (PARENT & GUARDIAN)
   */
  static getFamilyTemplate(): string {
    const headers = [
      'photo',
      'username',
      'name',
      'gender',
      'email',
      'phone',
      'role',
      'relationship',
      'studentAdmissionNo',
      'studentUsername',
      'studentName',
      'studentDateOfBirth',
      'studentGender',
      'studentBloodGroup',
      'studentBranch',
      'studentClass',
      'studentSeatNumber',
      'studentAdmissionYear',
      'pickupPin',
      'feePayer',
      'status',
    ]

    const sampleRows = [
      ['', 'rahul.patil', 'Rahul Patil', 'MALE', 'rahul.patil@example.com', '+919876543210', 'PARENT', 'FATHER', 'ADM-2026-00123', 'aarav.patil', 'Aarav Patil', '2021-04-12', 'MALE', 'B_POSITIVE', 'MAIN', 'NURSERY-A', 'SEAT-01', '2026-27', '1234', 'true', 'ACTIVE'],
      ['', 'priya.patil', 'Priya Patil', 'FEMALE', 'priya.patil@example.com', '+919876543211', 'PARENT', 'MOTHER', 'ADM-2026-00123', 'aarav.patil', 'Aarav Patil', '2021-04-12', 'MALE', 'B_POSITIVE', 'MAIN', 'NURSERY-A', 'SEAT-01', '2026-27', '5678', 'false', 'ACTIVE'],
      ['', 'sunita.patil', 'Sunita Patil', 'FEMALE', 'sunita.patil@example.com', '+919876543212', 'GUARDIAN', 'GRANDPARENT', 'ADM-2026-00123', 'aarav.patil', 'Aarav Patil', '2021-04-12', 'MALE', 'B_POSITIVE', 'MAIN', 'NURSERY-A', 'SEAT-01', '2026-27', '4321', 'false', 'ACTIVE'],
      ['', 'vikram.joshi', 'Vikram Joshi', 'MALE', 'vikram.joshi@example.com', '+919876543213', 'PARENT', 'FATHER', 'ADM-2026-00124', 'ananya.joshi', 'Ananya Joshi', '2022-01-15', 'FEMALE', 'O_POSITIVE', 'MAIN', 'PLAYGROUP-A', '', '2026-27', '9876', 'true', 'ACTIVE'],
    ]

    return [
      headers.map(sanitizeCsvCell).join(','),
      ...sampleRows.map((r) => r.map(sanitizeCsvCell).join(',')),
    ].join('\r\n')
  }

  /**
   * Preview & Validation for Staff CSV
   */
  static async previewStaffCsv(tenantId: string, csvContent: string): Promise<CsvPreviewResult> {
    const { rows } = parseCsvString(csvContent)
    const previewRows: CsvPreviewRow[] = []

    const seenEmails = new Set<string>()
    const seenPhones = new Set<string>()
    const seenUsernames = new Set<string>()

    const CANONICAL_STAFF_ROLES: CanonicalRole[] = [
      'OWNER',
      'PRINCIPAL',
      'COORDINATOR',
      'TEACHER',
      'STAFF',
      'ACCOUNTS',
      'RECEPTIONIST',
      'DRIVER',
      'ATTENDANT',
    ]

    // Fetch branches in tenant for code matching
    const branches = await db.branch.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, code: true, name: true },
    })
    const branchCodeMap = new Map<string, string>(branches.map((b) => [b.code.toUpperCase(), b.id]))

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const rowNum = i + 2
      const errors: string[] = []
      const warnings: string[] = []

      const username = r.username?.trim().toLowerCase() || ''
      const fullName = r.fullName?.trim() || ''
      const email = r.email?.trim().toLowerCase() || ''
      const phone = r.phone?.trim() || ''
      const rawRole = (r.role?.trim().toUpperCase() || 'TEACHER')
      const roleStr = normalizeRole(rawRole) as UserRole
      const branchCode = r.branchCode?.trim().toUpperCase() || ''

      if (!fullName) errors.push('Full name is missing')
      if (!email) {
        errors.push('Email is missing')
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('Invalid email format')
      }

      // Check duplicate within CSV file
      if (email) {
        if (seenEmails.has(email)) {
          errors.push(`Duplicate email "${email}" found multiple times in CSV file`)
        } else {
          seenEmails.add(email)
        }
      }

      if (username) {
        if (seenUsernames.has(username)) {
          errors.push(`Duplicate username "${username}" found multiple times in CSV file`)
        } else {
          seenUsernames.add(username)
        }
      }

      if (phone) {
        if (seenPhones.has(phone)) {
          warnings.push(`Shared phone "${phone}" appears multiple times in file`)
        } else {
          seenPhones.add(phone)
        }
      }

      // Check branch
      let branchId: string | null = null
      if (branchCode) {
        if (branchCodeMap.has(branchCode)) {
          branchId = branchCodeMap.get(branchCode)!
        } else {
          errors.push(`Branch code "${branchCode}" not found in this school`)
        }
      }

      // Validate role
      if (roleStr === 'PARENT' || roleStr === 'GUARDIAN') {
        errors.push('Cannot assign PARENT or GUARDIAN role in Staff CSV. Use Family CSV.')
      } else if (!CANONICAL_STAFF_ROLES.includes(roleStr as CanonicalRole)) {
        errors.push(`Invalid staff role "${rawRole}". Allowed: ${CANONICAL_STAFF_ROLES.join(', ')}.`)
      }

      // Check existing User in DB
      let isExisting = false
      if (email || username) {
        const existing = await db.user.findFirst({
          where: {
            OR: [
              ...(email ? [{ email }] : []),
              ...(username ? [{ username }] : []),
            ],
          },
          include: { staffProfile: true },
        })
        if (existing) {
          isExisting = true
          warnings.push(`User already exists in system. Profile will be linked/updated.`)
        }
      }

      const isBlocked = errors.length > 0
      previewRows.push(
        (() => {
          const status = isBlocked ? 'BLOCKED' : warnings.length > 0 ? 'WARNING' : 'VALID'
          const action = isBlocked ? 'BLOCK' : isExisting ? 'LINK' : 'CREATE'
          const rawEmpType = r.employmentType?.toUpperCase()
          const empType: EmploymentType =
            rawEmpType === 'REGULAR' || rawEmpType === 'FULL_TIME'
              ? 'FULL_TIME'
              : rawEmpType === 'INTERN' || rawEmpType === 'PROBATION'
              ? 'PROBATION'
              : (rawEmpType as EmploymentType) || 'FULL_TIME'

          return {
            rowNumber: rowNum,
            status,
            action,
            identifier: email || username || phone,
            name: fullName,
            role: roleStr,
            details: `Branch: ${branchId || 'Main'}, EmpCode: ${r.employeeCode || 'Auto'}`,
            errors,
            warnings,
            data: {
              username: username || undefined,
              fullName,
              email,
              phone,
              role: roleStr,
              branchId,
              designation: r.designation || null,
              department: r.department || null,
              employeeCode: r.employeeCode || null,
              qualification: r.qualification || null,
              employmentType: empType,
              joiningDate: r.joiningDate || null,
              dateOfBirth: r.dateOfBirth || null,
              gender: (r.gender?.toUpperCase() as Gender) || null,
              status: (r.status?.toUpperCase() as UserStatus) || 'ACTIVE',
            },
          }
        })()
      )
    }

    const blockedCount = previewRows.filter((r) => r.status === 'BLOCKED').length
    const warningCount = previewRows.filter((r) => r.status === 'WARNING').length
    const validCount = previewRows.filter((r) => r.status === 'VALID').length

    return {
      templateType: 'STAFF',
      totalRows: previewRows.length,
      validRows: validCount,
      warningRows: warningCount,
      blockedRows: blockedCount,
      rows: previewRows,
    }
  }

  /**
   * Preview & Validation for Parent / Guardian CSV
   * Supports Multi-Child linking and enforces strict Max 2 Parents rule
   */
  /**
   * Preview & Validation for Parent / Guardian CSV
   * Supports Multi-Child linking, authoritative student resolution, and enforces strict Max 2 Parents rule
   */
  static async previewFamilyCsv(tenantId: string, csvContent: string): Promise<CsvPreviewResult> {
    const { rows } = parseCsvString(csvContent)
    const previewRows: CsvPreviewRow[] = []

    // Track user occurrences across rows for multi-child deduplication
    const seenUserKeys = new Set<string>()
    const seenStudentCaregiverPairs = new Set<string>()

    // Track incoming parent count per student ID to enforce max 2 limit across CSV
    const studentDbParentCount = new Map<string, number>()
    const studentIncomingParents = new Map<string, number>()

    // Preload branches and classrooms for code/name lookup
    const branches = await db.branch.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, code: true, name: true },
    })
    const branchMap = new Map<string, string>()
    for (const b of branches) {
      branchMap.set(b.code.toUpperCase(), b.id)
      branchMap.set(b.name.toUpperCase(), b.id)
    }

    type ClassroomItem = { id: string; code: string | null; name: string; branchId: string | null; programType: ProgramType }
    const classrooms: ClassroomItem[] = await db.classroom.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, code: true, name: true, branchId: true, programType: true },
    })
    const classroomMap = new Map<string, ClassroomItem>()
    for (const c of classrooms) {
      if (c.code) classroomMap.set(c.code.toUpperCase(), c)
      classroomMap.set(c.name.toUpperCase(), c)
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const rowNum = i + 2
      const errors: string[] = []
      const warnings: string[] = []

      const photo = r.photo || r.avatarUrl || ''
      const username = r.username?.trim().toLowerCase() || ''
      const role = (r.role?.trim().toUpperCase() || 'PARENT') as 'PARENT' | 'GUARDIAN'
      const fullName = r.name?.trim() || r.fullName?.trim() || ''
      const gender = (r.gender?.trim().toUpperCase() as Gender) || null
      const email = r.email?.trim().toLowerCase() || ''
      const phone = r.phone?.trim() || ''
      const relationship = normalizeRelationship(r.relationship || r.relationToChild)
      const admissionNo = r.studentAdmissionNo?.trim() || r.admissionNo?.trim() || ''
      const studentUsername = r.studentUsername?.trim().toLowerCase() || ''
      const studentName = r.studentName?.trim() || r.childName?.trim() || ''
      const studentDateOfBirth = r.studentDateOfBirth?.trim() || r.studentDob?.trim() || r.childDOB?.trim() || ''
      const studentGender = (r.studentGender?.trim().toUpperCase() || r.childGender?.trim().toUpperCase() || 'MALE') as Gender
      const studentBloodGroup = (r.studentBloodGroup?.trim().toUpperCase() || r.bloodGroup?.trim().toUpperCase()) as BloodGroup | undefined
      const branchInput = r.studentBranch?.trim().toUpperCase() || r.branchCode?.trim().toUpperCase() || ''
      const classInput = r.studentClass?.trim().toUpperCase() || r.classroomCode?.trim().toUpperCase() || ''
      const seatNumber = r.studentSeatNumber?.trim() || r.seatNumber?.trim() || r.seatNo?.trim() || ''
      const admissionYear = r.studentAdmissionYear?.trim() || r.admissionYear?.trim() || ''
      const pickupPin = r.pickupPin?.trim() || ''
      const feePayerInput = r.feePayer || r.isFeePayer
      const status = (r.status?.trim().toUpperCase() as UserStatus) || 'ACTIVE'

      if (role !== 'PARENT' && role !== 'GUARDIAN') {
        errors.push(`Invalid role "${role}". Allowed: PARENT or GUARDIAN only.`)
      }
      if (!fullName) errors.push('Caregiver full name is missing')
      if (!email) {
        errors.push('Caregiver email is missing')
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('Invalid email format')
      }
      if (!phone) errors.push('Caregiver mobile phone is missing')

      const userKey = email || username

      // Check if this same caregiver + student is repeated in the CSV
      if (userKey && admissionNo) {
        const pairKey = `${userKey}::${admissionNo.toUpperCase()}`
        if (seenStudentCaregiverPairs.has(pairKey)) {
          errors.push(`Duplicate entry: Caregiver already linked to student "${admissionNo}" in this CSV`)
        } else {
          seenStudentCaregiverPairs.add(pairKey)
        }
      }

      // Check existing user in database
      let userInDb: any = null
      if (email || username) {
        userInDb = await db.user.findFirst({
          where: {
            OR: [
              ...(email ? [{ email }] : []),
              ...(username ? [{ username }] : []),
            ],
          },
        })
      }

      const isMultiChildLink = seenUserKeys.has(userKey)
      if (userKey) {
        seenUserKeys.add(userKey)
      }

      // Priority 1: studentAdmissionNo; Priority 2: studentUsername
      let targetStudent: any = null
      if (admissionNo) {
        targetStudent = await db.student.findFirst({
          where: { tenantId, admissionNo, deletedAt: null },
          include: { currentClassroom: true },
        })
      }
      if (!targetStudent && studentUsername) {
        targetStudent = await db.student.findFirst({
          where: { tenantId, username: studentUsername, deletedAt: null },
          include: { currentClassroom: true },
        })
      }

      const isExistingChild = Boolean(targetStudent)
      let isAlreadyLinked = false

      if (isExistingChild) {
        // Mismatch checks — Do NOT silently overwrite existing student data!
        if (studentName) {
          const dbFullName = `${targetStudent.firstName} ${targetStudent.lastName || ''}`.trim().toLowerCase()
          if (dbFullName !== studentName.toLowerCase()) {
            warnings.push(
              `Student name in CSV ("${studentName}") differs from authoritative DB record ("${targetStudent.firstName} ${targetStudent.lastName || ''}"). DB data will not be overwritten.`
            )
          }
        }

        if (studentDateOfBirth && targetStudent.dob) {
          try {
            const csvDob = new Date(studentDateOfBirth).toISOString().slice(0, 10)
            const dbDob = new Date(targetStudent.dob).toISOString().slice(0, 10)
            if (csvDob !== dbDob) {
              warnings.push(
                `Student DOB in CSV ("${csvDob}") differs from existing record ("${dbDob}"). Existing student data will not be overwritten.`
              )
            }
          } catch (e) {
            // invalid date in CSV
          }
        }

        // Check if caregiver is already linked to this student
        if (userInDb) {
          const existingLink = await db.studentGuardian.findFirst({
            where: {
              studentId: targetStudent.id,
              guardian: { userId: userInDb.id },
            },
          })
          if (existingLink) {
            isAlreadyLinked = true
            warnings.push(`Caregiver is already linked to this student. Link will be preserved.`)
          }
        }

        // Enforce Max 2 PARENT rule dynamically combining DB count + previous CSV rows
        if (role === 'PARENT' && !isAlreadyLinked) {
          if (!studentDbParentCount.has(targetStudent.id)) {
            const dbCount = await FamilyUserService.countActiveParentsForStudent(tenantId, targetStudent.id, userInDb?.id)
            studentDbParentCount.set(targetStudent.id, dbCount)
          }

          const existingCount = studentDbParentCount.get(targetStudent.id)!
          const incomingCount = studentIncomingParents.get(targetStudent.id) || 0

          if (existingCount + incomingCount >= 2) {
            errors.push(
              `Maximum 2 Parent accounts allowed for this student (Admission No: ${targetStudent.admissionNo}). Please use GUARDIAN role for additional caregivers.`
            )
          } else {
            studentIncomingParents.set(targetStudent.id, incomingCount + 1)
          }
        }
      } else {
        // Mode 2: Enroll New Student
        if (!studentName && !admissionNo) {
          errors.push('Student admission number or new student name is required')
        } else if (!studentName) {
          errors.push(`Student with Admission No. "${admissionNo}" not found in this school (or provide studentName to enroll new child)`)
        }

        if (!studentDateOfBirth) {
          errors.push('New student date of birth is required (YYYY-MM-DD)')
        }

        if (branchInput && !branchMap.has(branchInput)) {
          errors.push(`Student branch "${branchInput}" not found in this school`)
        }
        if (classInput && !classroomMap.has(classInput)) {
          errors.push(`Student class "${classInput}" not found in this school`)
        }
      }

      const branchId = branchInput ? branchMap.get(branchInput) || null : null
      const classroom = classInput ? classroomMap.get(classInput) || null : null

      const isBlocked = errors.length > 0
      const isLinkAction = isMultiChildLink || Boolean(userInDb)

      let rowAction: 'CREATE' | 'LINK' | 'SKIP' | 'BLOCK' = 'CREATE'
      let actionDetail = ''

      if (isBlocked) {
        rowAction = 'BLOCK'
        actionDetail = `${fullName} (${role}) - Blocked: ${errors[0]}`
      } else if (isAlreadyLinked) {
        rowAction = 'SKIP'
        actionDetail = `SKIP_ALREADY_LINKED: ${fullName} already linked to ${targetStudent.admissionNo}`
      } else if (isExistingChild) {
        if (isLinkAction) {
          rowAction = 'LINK'
          actionDetail = `LINK_EXISTING_USER: Link ${fullName} to ${targetStudent.admissionNo}`
        } else {
          rowAction = 'CREATE'
          actionDetail = `CREATE_RELATIONSHIP: Link new ${role} ${fullName} to ${targetStudent.admissionNo}`
        }
      } else {
        rowAction = 'CREATE'
        actionDetail = `CREATE_STUDENT_AND_FAMILY: Enroll new student "${studentName}" and register ${role}`
      }

      // Name splitting for new child
      const nameParts = studentName.trim().split(/\s+/)
      const childFirstName = nameParts[0] || 'Child'
      const childLastName = nameParts.slice(1).join(' ') || undefined

      const canPickup = r.canPickup?.toLowerCase() !== 'false'
      const receivesComm = r.receivesComm?.toLowerCase() !== 'false' && r.receivesCommunication?.toLowerCase() !== 'false'
      const isFeePayer = role === 'PARENT' ? true : feePayerInput?.toLowerCase() === 'true'

      previewRows.push({
        rowNumber: rowNum,
        status: isBlocked ? 'BLOCKED' : isAlreadyLinked ? 'VALID' : warnings.length > 0 ? 'WARNING' : 'VALID',
        action: rowAction,
        identifier: username || email || `Row ${rowNum}`,
        name: fullName,
        role,
        details: actionDetail,
        errors,
        warnings,
        data: {
          photo: photo || undefined,
          avatarUrl: photo || undefined,
          username: username || undefined,
          fullName,
          gender,
          email,
          phone,
          role,
          relationship,
          status,
          isPrimaryContact: r.isPrimaryContact?.toLowerCase() === 'true',
          childMode: isExistingChild ? 'EXISTING' : 'CREATE',
          existingChild: isExistingChild ? { admissionNo: targetStudent.admissionNo, studentId: targetStudent.id } : undefined,
          newChild: !isExistingChild
            ? {
                admissionNo: admissionNo || undefined,
                username: studentUsername || undefined,
                firstName: childFirstName,
                lastName: childLastName,
                dob: studentDateOfBirth,
                gender: studentGender,
                bloodGroup: studentBloodGroup,
                programType: classroom?.programType || 'NURSERY',
                branchId: branchId || undefined,
                classroomId: classroom?.id || undefined,
                seatNumber: seatNumber || undefined,
              }
            : undefined,
          permissions: {
            canPickup,
            receivesCommunication: receivesComm,
            isFeePayer,
            pickupPin: pickupPin || null,
          },
        },
      })
    }

    const blockedCount = previewRows.filter((r) => r.status === 'BLOCKED').length
    const warningCount = previewRows.filter((r) => r.status === 'WARNING').length
    const validCount = previewRows.filter((r) => r.status === 'VALID').length

    return {
      templateType: 'FAMILY',
      totalRows: previewRows.length,
      validRows: validCount,
      warningRows: warningCount,
      blockedRows: blockedCount,
      rows: previewRows,
    }
  }

  /**
   * Executes validated Staff CSV rows
   */
  static async executeStaffImport(
    ctx: { tenantId: string; actorId?: string; actorName?: string; actorRole?: string },
    rows: CsvPreviewRow[]
  ) {
    let createdCount = 0
    let updatedCount = 0
    let blockedCount = 0
    const errors: Array<{ rowNumber: number; message: string }> = []

    for (const row of rows) {
      if (row.status === 'BLOCKED') {
        blockedCount++
        errors.push({ rowNumber: row.rowNumber, message: row.errors.join('; ') })
        continue
      }

      try {
        await StaffUserService.createStaff(
          {
            tenantId: ctx.tenantId,
            actorId: ctx.actorId,
            actorName: ctx.actorName,
            actorRole: ctx.actorRole,
          },
          row.data as any
        )
        if (row.action === 'CREATE') createdCount++
        else updatedCount++
      } catch (err: any) {
        blockedCount++
        errors.push({ rowNumber: row.rowNumber, message: err.message })
      }
    }

    return {
      total: rows.length,
      createdCount,
      updatedCount,
      blockedCount,
      skippedCount: blockedCount,
      errors,
    }
  }

  /**
   * Executes validated Family CSV rows
   */
  static async executeFamilyImport(
    ctx: { tenantId: string; actorId?: string; actorName?: string; actorRole?: string },
    rows: CsvPreviewRow[]
  ) {
    let createdCount = 0
    let linkedCount = 0
    let skippedCount = 0
    let blockedCount = 0
    const errors: Array<{ rowNumber: number; message: string }> = []

    for (const row of rows) {
      if (row.status === 'BLOCKED' || row.action === 'BLOCK') {
        blockedCount++
        errors.push({ rowNumber: row.rowNumber, message: row.errors.join('; ') })
        continue
      }

      if (row.action === 'SKIP') {
        skippedCount++
        continue
      }

      try {
        const res = await FamilyUserService.createFamilyUser(
          {
            tenantId: ctx.tenantId,
            actorId: ctx.actorId,
            actorName: ctx.actorName,
            actorRole: ctx.actorRole,
          },
          row.data as any
        )
        if ((res as any).isAlreadyLinked) {
          skippedCount++
        } else if (res.isNewStudent) {
          createdCount++
        } else {
          linkedCount++
        }
      } catch (err: any) {
        blockedCount++
        errors.push({ rowNumber: row.rowNumber, message: err.message })
      }
    }

    return {
      total: rows.length,
      createdCount,
      linkedCount,
      skippedCount,
      blockedCount,
      errors,
    }
  }
}
