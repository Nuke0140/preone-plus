import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

const BASE_URL = 'http://localhost:3000'

let allPassed = true

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ ${msg}`)
  } else {
    console.error(`  ✗ FAIL: ${msg}`)
    allPassed = false
  }
}

async function main() {
  console.log('===============================================================')
  console.log('PREONE — UAM FINDING-A LIVE SECURITY PROBE (PATH A & PATH B)')
  console.log('===============================================================\n')

  const tenant = await db.tenant.findFirst()
  if (!tenant) throw new Error('No tenant found')

  // 1. Authenticate as Owner
  console.log('[Setup] Logging in as School Owner...')
  const ownerLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'owner@sunshine.demo', password: 'Preone@123' }),
  })
  assert(ownerLoginRes.status === 200, `Owner login returns HTTP 200 (got ${ownerLoginRes.status})`)
  const ownerCookie = ownerLoginRes.headers.get('set-cookie')?.split(';')[0] || ''
  const ownerData = await ownerLoginRes.json()

  // 2. Setup Test User
  const testEmail = `probe.finding_a.${Date.now()}@sunshine.demo`
  const testUsername = `probe_usr_${Date.now()}`
  const testPassword = 'Password@123'
  const passwordHash = await bcrypt.hash(testPassword, 10)

  console.log(`[Setup] Creating test user: ${testEmail}`)
  const testUser = await db.user.create({
    data: {
      email: testEmail,
      username: testUsername,
      fullName: 'Finding-A Probe User',
      passwordHash,
      status: 'ACTIVE',
    },
  })
  const testMember = await db.tenantUser.create({
    data: {
      tenantId: tenant.id,
      userId: testUser.id,
      role: 'TEACHER',
      roles: ['TEACHER'],
      status: 'ACTIVE',
    },
  })

  // -------------------------------------------------------------------------
  // PATH B: GENERIC PATCH /api/v1/users/[id] { status: "SUSPENDED" }
  // -------------------------------------------------------------------------
  console.log('\n--- PATH B: Generic PATCH Status Mutation ---')

  // Step 1: Login as test user and obtain access token
  console.log('[Step 1] Logging in as test user...')
  const loginRes1 = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: testEmail, password: testPassword }),
  })
  assert(loginRes1.status === 200, `Step 1: Test user login returns HTTP 200 (got ${loginRes1.status})`)
  const testCookie1 = loginRes1.headers.get('set-cookie')?.split(';')[0] || ''
  const token1 = testCookie1.replace('preone_session=', '')

  // Authenticated request with old token -> 200
  const authCheck1 = await fetch(`${BASE_URL}/api/v1/me`, {
    headers: {
      Cookie: testCookie1,
      Authorization: `Bearer ${token1}`,
    },
  })
  assert(authCheck1.status === 200, `Step 1: Authenticated request returns HTTP 200 before suspend (got ${authCheck1.status})`)

  // Step 2: Call generic PATCH with status: "SUSPENDED"
  console.log('[Step 2] Executing PATCH /api/v1/users/[id] { status: "SUSPENDED" }...')
  const patchRes = await fetch(`${BASE_URL}/api/v1/users/${testMember.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: ownerCookie,
    },
    body: JSON.stringify({ status: 'SUSPENDED' }),
  })
  assert(patchRes.status === 200, `Step 2: Generic PATCH returns HTTP 200 (got ${patchRes.status})`)

  // Step 3: Immediately reuse OLD access token
  console.log('[Step 3] Immediately reusing OLD access token on authenticated endpoint...')
  const oldTokenReuse1 = await fetch(`${BASE_URL}/api/v1/me`, {
    headers: {
      Cookie: testCookie1,
      Authorization: `Bearer ${token1}`,
    },
  })
  assert(oldTokenReuse1.status === 401, `Step 3: Reused OLD access token rejected with HTTP 401 (got ${oldTokenReuse1.status})`)

  // Step 4: Attempt login with same valid credentials
  console.log('[Step 4] Attempting login with valid credentials for suspended user...')
  const reloginRes1 = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: testEmail, password: testPassword }),
  })
  assert(reloginRes1.status === 403, `Step 4: Suspended user login rejected with HTTP 403 (got ${reloginRes1.status})`)
  const reloginBody1 = await reloginRes1.json()
  assert(
    reloginBody1.error?.code === 'ACCOUNT_SUSPENDED',
    `Step 4: Canonical error code ACCOUNT_SUSPENDED returned (got ${reloginBody1.error?.code})`
  )

  // Step 5: Reactivate through canonical lifecycle endpoint
  console.log('[Step 5] Reactivating user through canonical lifecycle POST /users/[id]/status { action: "reactivate" }...')
  const reactivateRes1 = await fetch(`${BASE_URL}/api/v1/users/${testMember.id}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: ownerCookie,
    },
    body: JSON.stringify({ action: 'reactivate' }),
  })
  assert(reactivateRes1.status === 200, `Step 5: Canonical reactivate returns HTTP 200 (got ${reactivateRes1.status})`)

  // Login allowed after reactivation
  console.log('[Step 5] Attempting login after reactivation...')
  const postReactivateLogin1 = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: testEmail, password: testPassword }),
  })
  assert(postReactivateLogin1.status === 200, `Step 5: Reactivated user login allowed with HTTP 200 (got ${postReactivateLogin1.status})`)

  // -------------------------------------------------------------------------
  // PATH A: CANONICAL LIFECYCLE POST /api/v1/users/[id]/status
  // -------------------------------------------------------------------------
  console.log('\n--- PATH A: Canonical Lifecycle Endpoint ---')

  // Step 1: Login and obtain new token
  const testCookie2 = postReactivateLogin1.headers.get('set-cookie')?.split(';')[0] || ''
  const token2 = testCookie2.replace('preone_session=', '')

  const authCheck2 = await fetch(`${BASE_URL}/api/v1/me`, {
    headers: {
      Cookie: testCookie2,
      Authorization: `Bearer ${token2}`,
    },
  })
  assert(authCheck2.status === 200, `Path A: Authenticated request returns HTTP 200 before suspend (got ${authCheck2.status})`)

  // Step 2: Suspend via canonical lifecycle endpoint
  console.log('Executing POST /api/v1/users/[id]/status { action: "suspend" }...')
  const lifecycleSuspendRes = await fetch(`${BASE_URL}/api/v1/users/${testMember.id}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: ownerCookie,
    },
    body: JSON.stringify({ action: 'suspend' }),
  })
  assert(lifecycleSuspendRes.status === 200, `Path A: Canonical suspend returns HTTP 200 (got ${lifecycleSuspendRes.status})`)

  // Step 3: Immediately reuse OLD token
  console.log('Reusing OLD access token after canonical suspend...')
  const oldTokenReuse2 = await fetch(`${BASE_URL}/api/v1/me`, {
    headers: {
      Cookie: testCookie2,
      Authorization: `Bearer ${token2}`,
    },
  })
  assert(oldTokenReuse2.status === 401, `Path A: Reused OLD token rejected with HTTP 401 (got ${oldTokenReuse2.status})`)

  // Step 4: Attempt login with same credentials
  console.log('Attempting login with valid credentials after canonical suspend...')
  const reloginRes2 = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: testEmail, password: testPassword }),
  })
  assert(reloginRes2.status === 403, `Path A: Canonical suspend login rejected with HTTP 403 (got ${reloginRes2.status})`)

  // Step 5: Reactivate via generic PATCH
  console.log('Reactivating user via generic PATCH /api/v1/users/[id] { status: "ACTIVE" }...')
  const patchReactivateRes = await fetch(`${BASE_URL}/api/v1/users/${testMember.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: ownerCookie,
    },
    body: JSON.stringify({ status: 'ACTIVE' }),
  })
  assert(patchReactivateRes.status === 200, `Path A: Generic PATCH reactivate returns HTTP 200 (got ${patchReactivateRes.status})`)

  const postReactivateLogin2 = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: testEmail, password: testPassword }),
  })
  assert(postReactivateLogin2.status === 200, `Path A: User login allowed after generic PATCH reactivate with HTTP 200 (got ${postReactivateLogin2.status})`)

  // Cleanup
  console.log('\n[Cleanup] Cleaning up test records...')
  await db.userSession.deleteMany({ where: { userId: testUser.id } })
  await db.auditLog.deleteMany({ where: { entityId: testUser.id } })
  await db.tenantUser.deleteMany({ where: { id: testMember.id } })
  await db.user.deleteMany({ where: { id: testUser.id } })
  console.log('✓ Cleaned up test user.')

  console.log('\n===============================================================')
  if (allPassed) {
    console.log('FINDING-A LIVE PROBE RESULT: ALL CHECKS PASSED (100% SUCCESS)')
  } else {
    console.error('FINDING-A LIVE PROBE RESULT: FAILED')
    process.exit(1)
  }
  console.log('===============================================================')
}

main().catch((err) => {
  console.error('Unhandled probe error:', err)
  process.exit(1)
})
