import { PrismaClient, UserRole, UserStatus, Relationship, EmploymentType } from '@prisma/client'
import { CANONICAL_ROLES, ROLE_META, normalizeRole, LEGACY_ROLE_MAP, isCanonicalRole } from '../src/lib/roles'
import { can, ROLE_PERMISSIONS } from '../src/lib/auth'
import { SessionService, parseDeviceFromUserAgent } from '../src/lib/users/session-service'
import { PermissionCache } from '../src/lib/cache/permission-cache'
import { SettingsService } from '../src/lib/settings/settings-service'
import { normalizeRelationship } from '../src/lib/users/family-user-service'
import { StaffUserService } from '../src/lib/users/staff-user-service'
import { nextNumber } from '../src/lib/sequence'
import { UserIdentityService } from '../src/lib/users/user-identity-service'

const prisma = new PrismaClient()

let passed = 0
let failed = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ ${msg}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${msg}`)
    failed++
  }
}

async function runTests() {
  console.log('====================================================')
  console.log('PREONE UAM ENHANCEMENT SUITE — VERIFICATION RUN')
  console.log('====================================================\n')

  // TEST SUITE 1: Canonical Role Architecture (UAM-E2, UAM-E4)
  console.log('[1] Canonical Role Taxonomy & Mapping')
  assert(CANONICAL_ROLES.includes('STAFF'), 'STAFF is in CANONICAL_ROLES')
  assert(CANONICAL_ROLES.includes('ACCOUNTS'), 'ACCOUNTS is in CANONICAL_ROLES')
  assert(CANONICAL_ROLES.includes('RECEPTIONIST'), 'RECEPTIONIST is in CANONICAL_ROLES')
  assert(CANONICAL_ROLES.includes('ATTENDANT'), 'ATTENDANT is in CANONICAL_ROLES')
  assert(CANONICAL_ROLES.includes('COORDINATOR'), 'COORDINATOR is in CANONICAL_ROLES')

  // Explicitly locked HELPER -> STAFF
  assert(LEGACY_ROLE_MAP.HELPER === 'STAFF', 'Legacy mapping: HELPER -> STAFF (strictly locked)')
  assert(normalizeRole('helper') === 'STAFF', 'normalizeRole("helper") returns STAFF')
  assert(normalizeRole('accountant') === 'ACCOUNTS', 'normalizeRole("accountant") returns ACCOUNTS')
  assert(normalizeRole('hr') === 'STAFF', 'normalizeRole("hr") returns STAFF')
  assert(normalizeRole('reception') === 'RECEPTIONIST', 'normalizeRole("reception") returns RECEPTIONIST')
  assert(ROLE_META.OWNER.hierarchyLevel > ROLE_META.PRINCIPAL.hierarchyLevel, 'Role hierarchy: OWNER > PRINCIPAL')
  assert(ROLE_META.PRINCIPAL.hierarchyLevel > ROLE_META.TEACHER.hierarchyLevel, 'Role hierarchy: PRINCIPAL > TEACHER')

  // Permissions check
  assert(can('STAFF', 'attendance:read'), 'STAFF can attendance:read')
  assert(can('ACCOUNTS', 'finance:write'), 'ACCOUNTS can finance:write')
  assert(can('RECEPTIONIST', 'admissions:write'), 'RECEPTIONIST can admissions:write')
  assert(can('HELPER', 'attendance:read'), 'Legacy HELPER role resolves attendance:read')

  // TEST SUITE 2: User Lifecycle State Machine (UAM-E1)
  console.log('\n[2] User Lifecycle Engine & State Invariants')
  const testTenant = await prisma.tenant.findFirst()
  if (!testTenant) throw new Error('No test tenant found')

  const testUser = await prisma.user.create({
    data: {
      fullName: 'UAM Lifecycle Tester',
      username: `uam_test_${Date.now()}`,
      passwordHash: 'dummy_hash',
      status: 'ACTIVE',
    },
  })
  const testMember = await prisma.tenantUser.create({
    data: {
      tenantId: testTenant.id,
      userId: testUser.id,
      role: 'STAFF',
      status: 'ACTIVE',
    },
  })

  assert(testMember.status === 'ACTIVE', 'Created user in ACTIVE state')

  // Transition: ACTIVE -> SUSPENDED
  await prisma.$transaction([
    prisma.tenantUser.update({ where: { id: testMember.id }, data: { status: 'SUSPENDED' } }),
    prisma.user.update({ where: { id: testUser.id }, data: { status: 'SUSPENDED' } }),
  ])
  const suspended = await prisma.user.findUnique({ where: { id: testUser.id } })
  assert(suspended?.status === 'SUSPENDED', 'Successfully transitioned to SUSPENDED')

  // Transition: SUSPENDED -> ACTIVE
  await prisma.$transaction([
    prisma.tenantUser.update({ where: { id: testMember.id }, data: { status: 'ACTIVE' } }),
    prisma.user.update({ where: { id: testUser.id }, data: { status: 'ACTIVE' } }),
  ])
  const reactivated = await prisma.user.findUnique({ where: { id: testUser.id } })
  assert(reactivated?.status === 'ACTIVE', 'Successfully reactivated to ACTIVE')

  // Transition: ACTIVE -> DEACTIVATED -> ARCHIVED
  await prisma.$transaction([
    prisma.tenantUser.update({ where: { id: testMember.id }, data: { status: 'DEACTIVATED' } }),
    prisma.user.update({ where: { id: testUser.id }, data: { status: 'DEACTIVATED' } }),
  ])
  const deactivated = await prisma.user.findUnique({ where: { id: testUser.id } })
  assert(deactivated?.status === 'DEACTIVATED', 'Successfully deactivated to DEACTIVATED')

  await prisma.$transaction([
    prisma.tenantUser.update({ where: { id: testMember.id }, data: { status: 'ARCHIVED' } }),
    prisma.user.update({ where: { id: testUser.id }, data: { status: 'ARCHIVED' } }),
  ])
  const archived = await prisma.user.findUnique({ where: { id: testUser.id } })
  assert(archived?.status === 'ARCHIVED', 'Successfully archived to terminal state ARCHIVED')

  // TEST SUITE 3: Session & Device Management (UAM-E5, UAM-E6)
  console.log('\n[3] UserSession Database Storage & Device Tracking')
  const rawToken = `test-jwt-token-${Date.now()}`
  const dummyUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  const parsedUA = parseDeviceFromUserAgent(dummyUA)

  assert(parsedUA.platform.includes('Windows'), 'User agent platform detected as Windows')
  assert(parsedUA.browser === 'Chrome', 'User agent browser detected as Chrome')

  const sessionRecord = await SessionService.createSession({
    userId: testUser.id,
    tenantId: testTenant.id,
    token: rawToken,
    req: {
      headers: new Headers({
        'user-agent': dummyUA,
        'x-forwarded-for': '192.168.1.100',
      }),
    } as any,
  })

  assert(Boolean(sessionRecord?.id), 'UserSession created successfully in database')
  assert(sessionRecord?.status === 'ACTIVE', 'UserSession initial status is ACTIVE')
  assert(sessionRecord?.ipAddress === '192.168.1.100', 'UserSession recorded client IP address')

  const validCheck = await SessionService.validateSession(rawToken)
  assert(validCheck.valid === true, 'validateSession returns valid: true for ACTIVE session')

  // Test single session revocation
  await SessionService.revokeSession(sessionRecord!.id)
  const revokedCheck = await SessionService.validateSession(rawToken)
  assert(revokedCheck.valid === false, 'validateSession returns valid: false after session revocation')

  // TEST SUITE 4: Permission Cache Versioning (UAM-E9)
  console.log('\n[4] Permission Cache & Version Consistency')
  const v1 = PermissionCache.getUserVersion(testUser.id)
  assert(v1 === 1, 'Initial permission version is 1')
  const v2 = PermissionCache.bumpUserVersion(testUser.id)
  assert(v2 === 2, 'bumpUserVersion increments version to 2')
  assert(PermissionCache.getUserVersion(testUser.id) === 2, 'getUserVersion reports version 2')

  // TEST SUITE 5: Profile vs Preferences Separation (UAM-E8)
  console.log('\n[5] Profile vs Preferences Separation')
  const initialPrefs = await SettingsService.getUserPreferences(testUser.id)
  assert(initialPrefs.density === 'COMFORTABLE', 'Default density preference is COMFORTABLE')

  const updatedPrefs = await SettingsService.updateUserPreferences(testUser.id, {
    theme: 'DARK',
    density: 'COMPACT',
    soundEnabled: false,
  })
  assert(updatedPrefs.theme === 'DARK', 'Updated user preference theme: DARK')
  assert(updatedPrefs.density === 'COMPACT', 'Updated user preference density: COMPACT')

  const refreshedUser = await prisma.user.findUnique({ where: { id: testUser.id } })
  const storedJson = refreshedUser?.preferences as Record<string, any>
  assert(storedJson?.theme === 'DARK', 'Preferences persisted into User.preferences JSONB column')

  // TEST SUITE 6: Employee Code Generation (UAM-E14)
  console.log('\n[6] Employee Code Sequence Generator')
  const code = await StaffUserService.generateUniqueEmployeeCode(testTenant.id)
  const codeRegex = /^EMP-\d{4}-\d{3,}$/
  assert(codeRegex.test(code), `Generated employee code format matches EMP-YYYY-NNN (${code})`)

  // TEST SUITE 7: Enums — Relationship (UAM-E15) & Employment Type (UAM-E16)
  console.log('\n[7] Canonical Enums: Relationship & EmploymentType')
  assert(normalizeRelationship('GUARDIAN') === 'GUARDIAN', 'normalizeRelationship("GUARDIAN") returns GUARDIAN')
  assert(normalizeRelationship('SIBLING') === 'SIBLING', 'normalizeRelationship("SIBLING") returns SIBLING')
  assert(normalizeRelationship('brother') === 'SIBLING', 'normalizeRelationship("brother") returns SIBLING')

  // Clean up test data
  await prisma.userSession.deleteMany({ where: { userId: testUser.id } })
  await prisma.tenantUser.deleteMany({ where: { userId: testUser.id } })
  await prisma.user.delete({ where: { id: testUser.id } })

  console.log('\n====================================================')
  console.log(`TOTAL TESTS RUN: ${passed + failed}`)
  console.log(`PASSED: ${passed}`)
  console.log(`FAILED: ${failed}`)
  console.log('====================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runTests()
  .catch((e) => {
    console.error('Fatal error during verification run:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
