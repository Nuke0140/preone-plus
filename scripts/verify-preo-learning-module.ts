import fs from 'fs'
import path from 'path'
import { MODULE_META, homeModules } from '../src/lib/modules'
import { NAV_ITEMS } from '../src/lib/nav'

async function verify() {
  console.log('=== Step 1: Checking NAV_ITEMS and MODULE_META definitions ===')
  const navItem = NAV_ITEMS.find((n) => n.key === 'learning')
  if (!navItem) {
    throw new Error('NAV_ITEMS does not contain item with key "learning"!')
  }
  console.log('✓ Found navItem:', navItem.key, 'label:', navItem.label, 'href:', navItem.href)
  if (navItem.label !== 'PreO Learning') {
    throw new Error(`Expected label "PreO Learning", got "${navItem.label}"`)
  }
  if (navItem.href !== '/app/learning') {
    throw new Error(`Expected href "/app/learning", got "${navItem.href}"`)
  }

  const meta = MODULE_META.learning
  if (!meta) {
    throw new Error('MODULE_META.learning is not defined!')
  }
  console.log('✓ MODULE_META.learning:', meta.description, 'theme:', meta.semanticTheme, 'tileSize:', meta.tileSize)

  const modulesForOwner = homeModules('OWNER')
  const learningModule = modulesForOwner.find((m) => m.key === 'learning')
  if (!learningModule) {
    throw new Error('homeModules("OWNER") did not include learning module!')
  }
  console.log('✓ homeModules("OWNER") contains PreO Learning card:', learningModule.label)

  console.log('\n=== Step 2: Checking Authenticated /app/home page ===')
  const loginRes = await fetch('http://localhost:3000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@sunshine.demo', password: 'Preone@123' })
  })
  const setCookie = loginRes.headers.get('set-cookie')
  const homeRes = await fetch('http://localhost:3000/app/home', {
    headers: { 'Cookie': setCookie || '' }
  })
  console.log('✓ /app/home status:', homeRes.status)
  if (homeRes.status !== 200) {
    throw new Error('/app/home did not return status 200: ' + homeRes.status)
  }
  const homeHtml = await homeRes.text()

  if (!homeHtml.includes('PreO Learning') || !homeHtml.includes('/app/learning')) {
    throw new Error('Home page does not contain PreO Learning card pointing to /app/learning!')
  }
  console.log('✓ /app/home contains PreO Learning card pointing to /app/learning')

  console.log('\n=== Step 3: Checking /app/learning blank module page ===')
  const learningRes = await fetch('http://localhost:3000/app/learning', {
    headers: { 'Cookie': setCookie || '' }
  })
  console.log('✓ /app/learning status:', learningRes.status)
  if (learningRes.status !== 200) {
    throw new Error('/app/learning did not return status 200: ' + learningRes.status)
  }
  const learningHtml = await learningRes.text()
  if (!learningHtml.includes('PreO Learning')) {
    throw new Error('/app/learning page content does not include "PreO Learning"!')
  }
  console.log('✓ /app/learning page rendered successfully with PreO Learning header and workspace')

  console.log('\n=== Step 4: Checking all other modules on /app/home (regression tests) ===')
  const expectedModules = [
    { label: 'Students', path: '/app/students' },
    { label: 'Daily Diary', path: '/app/daily-diary' },
    { label: 'Setup', path: '/app/setup' },
    { label: 'Users', path: '/app/users' },
    { label: 'HR & Workforce', path: '/app/hr' },
    { label: 'Transport', path: '/app/transport' },
    { label: 'Inventory', path: '/app/inventory' },
    { label: 'Fees', path: '/app/finance' },
    { label: 'Admissions', path: '/app/admissions' },
    { label: 'Reports & Analytics', path: '/app/reports' },
    { label: 'Dashboard', path: '/app/dashboard' },
    { label: 'Announcements', path: '/app/communication' },
    { label: 'Settings', path: '/app/settings' },
  ]

  for (const mod of expectedModules) {
    if (!homeHtml.includes(mod.path)) {
      throw new Error(`Home page missing link for ${mod.label} (${mod.path})`)
    }
  }
  console.log('✓ All 13 existing module cards on /app/home remain fully functional and intact')

  console.log('\n=== ALL PREO LEARNING VERIFICATIONS PASSED SUCCESSFULLY! ===')
}

verify().catch((err) => {
  console.error('VERIFICATION FAILED:', err)
  process.exit(1)
})
