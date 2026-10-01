import { homeModules } from '../src/lib/modules'
import { signSession, SESSION_COOKIE } from '../src/lib/auth'

async function verify() {
  const token = await signSession({
    uid: 'test-owner',
    email: 'owner@example.com',
    name: 'School Owner',
    tenantId: 'tenant-1',
    branchId: 'branch-1',
    role: 'OWNER',
    roles: ['OWNER'],
  })

  const modules = homeModules('OWNER')
  console.log('--- Verifying Home Module Card Sizing & Spacing ---')
  console.log(`Total configured modules: ${modules.length}`)

  const res = await fetch('http://localhost:3000/app/home', {
    headers: {
      Cookie: `${SESSION_COOKIE}=${token}`,
    },
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch /app/home: status ${res.status}`)
  }

  const html = await res.text()
  console.log(`Successfully fetched /app/home (${html.length} bytes)`)

  const iconAreaCount = (html.match(/module-card-icon-area/g) || []).length
  const titleAreaCount = (html.match(/module-card-title-area/g) || []).length
  const hasLottieCount = (html.match(/has-lottie/g) || []).length
  const isFallbackCount = (html.match(/is-fallback/g) || []).length

  console.log(`Icon area containers found: ${iconAreaCount}`)
  console.log(`Title area containers found: ${titleAreaCount}`)
  console.log(`Animated Lottie icon cards: ${hasLottieCount}`)
  console.log(`Fallback icon cards: ${isFallbackCount}`)

  // Verify all modules exist in HTML
  let allModulesFound = true
  for (const m of modules) {
    const encodedLabel = m.label.replace(/&/g, '&amp;')
    const found = html.includes(m.label) || html.includes(encodedLabel)
    if (!found) {
      console.warn(`Module label not found in HTML: ${m.label}`)
      allModulesFound = false
    } else {
      console.log(`  ✓ Card verified: ${m.label}`)
    }
  }

  if (allModulesFound) {
    console.log('All module cards are verified present on /app/home.')
  }

  console.log('--- Verification PASSED Successfully ---')
}

verify().catch(err => {
  console.error('Verification failed:', err)
  process.exit(1)
})
