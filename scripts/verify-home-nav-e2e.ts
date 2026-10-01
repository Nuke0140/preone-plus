/**
 * PreOne — Home Navigation Visibility E2E Test Suite
 *
 * Verifies:
 * 1.  Centralized Navigation (nav.ts):
 *     - Home item exists in NAV_ITEMS with key 'home', href '/app/home', label 'Home', grad 'g-blue', icon Home.
 *     - Position: First item in NAV_ITEMS.
 *     - Zero permissions required (perm is undefined).
 * 2.  Role-Based Navigation (navForRole):
 *     - Home is returned for every authenticated role:
 *       PLATFORM_ADMIN, OWNER, PRINCIPAL, COORDINATOR, TEACHER, ACCOUNTS, RECEPTION, PARENT.
 *     - For all roles, Home is the first item (index 0).
 * 3.  Home Modules Metadata (modules.ts):
 *     - MODULE_META includes 'home' with description and tileSize.
 *     - homeModules(role) yields Home with valid description, tileSize, and quickActions array.
 * 4.  Taskbar Pins:
 *     - Top 5 taskbar items (nav.slice(0, 5)) include Home for all roles.
 * 5.  Route Invariants:
 *     - App root route /app redirects to /app/home.
 */

import { NAV_ITEMS, navForRole } from '../src/lib/nav'
import { homeModules } from '../src/lib/modules'
import type { Role } from '../src/lib/auth'
import fs from 'fs'
import path from 'path'

let passed = 0
let failed = 0

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✓ ${desc}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${desc}`)
    failed++
  }
}

async function runHomeNavTests() {
  console.log('====================================================================')
  console.log('PREONE HOME NAVIGATION VISIBILITY: E2E VERIFICATION SUITE')
  console.log('====================================================================\n')

  try {
    // -------------------------------------------------------------------------
    // 1. CENTRALIZED NAVIGATION DEFINITION (NAV_ITEMS)
    // -------------------------------------------------------------------------
    console.log('>>> 1. Inspect Centralized Navigation (NAV_ITEMS)')
    const firstNav = NAV_ITEMS[0]
    assert(firstNav !== undefined, 'NAV_ITEMS is non-empty')
    assert(firstNav.key === 'home', `First NAV_ITEMS item has key 'home' (got: ${firstNav?.key})`)
    assert(firstNav.label === 'Home', `First NAV_ITEMS item has label 'Home' (got: ${firstNav?.label})`)
    assert(firstNav.href === '/app/home', `First NAV_ITEMS item has href '/app/home' (got: ${firstNav?.href})`)
    assert(!firstNav.perm, 'Home requires no perm (role-agnostic for all authenticated users)')
    assert(!firstNav.roles, 'Home has no role restrictions (accessible to all authenticated roles)')
    assert(firstNav.grad === 'g-blue', `Home uses 'g-blue' gradient (got: ${firstNav.grad})`)
    assert(typeof firstNav.icon === 'function' || typeof firstNav.icon === 'object', 'Home icon is a valid React component')

    // -------------------------------------------------------------------------
    // 2. ROLE-BASED NAVIGATION RESOLUTION (navForRole)
    // -------------------------------------------------------------------------
    console.log('\n>>> 2. Role-Based Navigation Resolution Across All Roles')
    const roles: Role[] = [
      'PLATFORM_ADMIN',
      'OWNER',
      'PRINCIPAL',
      'COORDINATOR',
      'TEACHER',
      'ACCOUNTS',
      'RECEPTION',
      'PARENT',
    ]

    for (const role of roles) {
      const roleNav = navForRole(role)
      const homeItem = roleNav.find((n) => n.key === 'home')
      assert(!!homeItem, `Role '${role}' receives Home in navForRole`)
      assert(roleNav[0]?.key === 'home', `Role '${role}' has Home as the first navigation item (index 0)`)
      assert(homeItem?.href === '/app/home', `Role '${role}' Home item links to '/app/home'`)
      
      // Taskbar top 5 pins check
      const taskbarPins = roleNav.slice(0, 5)
      assert(taskbarPins.some((p) => p.key === 'home'), `Role '${role}' taskbar top 5 pins include Home`)
    }

    // -------------------------------------------------------------------------
    // 3. HOME MODULE METADATA & QUICK LAUNCHER TILES
    // -------------------------------------------------------------------------
    console.log('\n>>> 3. Home Module Metadata & Quick Launcher Tiles')
    for (const role of roles) {
      const mods = homeModules(role)
      const homeMod = mods.find((m) => m.key === 'home')
      assert(!!homeMod, `Role '${role}' homeModules contains Home tile`)
      assert(typeof homeMod?.description === 'string' && homeMod.description.length > 0, `Role '${role}' Home tile has non-empty description`)
      assert(homeMod?.tileSize === 'md', `Role '${role}' Home tile tileSize is 'md'`)
      assert(Array.isArray(homeMod?.quickActions), `Role '${role}' Home tile quickActions is an array`)
    }

    // -------------------------------------------------------------------------
    // 4. ROUTE INVARIANTS & SHELL INTEGRATION
    // -------------------------------------------------------------------------
    console.log('\n>>> 4. Route Invariants & Shell Integration')
    const appIndexFile = path.join(process.cwd(), 'src/app/app/page.tsx')
    const appIndexContent = fs.readFileSync(appIndexFile, 'utf-8')
    assert(appIndexContent.includes("redirect('/app/home')"), 'App root /app redirects to /app/home')

    const appShellFile = path.join(process.cwd(), 'src/components/shell/AppShell.tsx')
    const appShellContent = fs.readFileSync(appShellFile, 'utf-8')
    assert(appShellContent.includes("n.href === '/app/home' ? pathname === '/app/home'"), 'AppShell uses exact matching for /app/home active state')
    assert(appShellContent.includes('filteredTiles.map'), 'Start menu renders filteredTiles from nav (which starts with Home)')
    assert(appShellContent.includes('nav.slice(0, 5)'), 'Taskbar pins first 5 items from nav (which starts with Home)')

    console.log('\n====================================================================')
    console.log(`HOME NAVIGATION SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`)
    console.log('====================================================================')

    if (failed > 0) {
      process.exit(1)
    }
  } catch (err) {
    console.error('Test suite runtime error:', err)
    process.exit(1)
  }
}

runHomeNavTests()
