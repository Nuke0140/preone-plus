import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { MODULE_META } from '../src/lib/modules'

async function verify() {
  console.log('=== Step 1: Checking audit_logs.json existence & integrity ===')
  const jsonPath = path.resolve('public/animations/home/audit_logs.json')
  if (!fs.existsSync(jsonPath)) {
    throw new Error('public/animations/home/audit_logs.json does not exist!')
  }
  const raw = fs.readFileSync(jsonPath, 'utf8')
  const data = JSON.parse(raw)
  console.log('✓ File size:', raw.length, 'bytes')
  console.log('✓ Lottie title:', data.nm)
  console.log('✓ Lottie version:', data.v)
  console.log('✓ Canvas size:', data.w, 'x', data.h, 'fps:', data.fr, 'frames:', data.op)
  
  if (!data.assets || !data.assets[0] || !data.assets[0].p) {
    throw new Error('Missing assets[0].p in audit_logs.json')
  }
  const asset = data.assets[0]
  if (!asset.p.startsWith('data:image/webp;base64,')) {
    throw new Error('Asset is not self-contained base64 webp data URI!')
  }
  console.log('✓ Embedded data URI length:', asset.p.length)
  
  const b64 = asset.p.replace(/^data:image\/webp;base64,/, '')
  const buffer = Buffer.from(b64, 'base64')
  const meta = await sharp(buffer).metadata()
  console.log('✓ Decoded WebP image successfully via sharp:')
  console.log('  Format:', meta.format, 'Size:', meta.width, 'x', meta.height, 'Channels:', meta.channels, 'Alpha:', meta.hasAlpha)

  console.log('\n=== Step 2: Checking module metadata ===')
  if (MODULE_META.audit?.animation !== '/animations/home/audit_logs.json') {
    throw new Error('MODULE_META.audit.animation is not set correctly!')
  }
  if (MODULE_META.audit_logs?.animation !== '/animations/home/audit_logs.json') {
    throw new Error('MODULE_META.audit_logs.animation is not set correctly!')
  }
  console.log('✓ MODULE_META.audit.animation:', MODULE_META.audit.animation)
  console.log('✓ MODULE_META.audit_logs.animation:', MODULE_META.audit_logs.animation)
  console.log('✓ MODULE_META.settings.animation:', MODULE_META.settings.animation)
  console.log('✓ MODULE_META.announcements.animation:', MODULE_META.announcements.animation)
  console.log('✓ MODULE_META.communication.animation:', MODULE_META.communication.animation)
  console.log('✓ MODULE_META.dashboard.animation:', MODULE_META.dashboard.animation)
  console.log('✓ MODULE_META.reports.animation:', MODULE_META.reports.animation)
  console.log('✓ MODULE_META.reports_analytics.animation:', MODULE_META.reports_analytics.animation)
  console.log('✓ MODULE_META.admissions.animation:', MODULE_META.admissions.animation)
  console.log('✓ MODULE_META.fees.animation:', MODULE_META.fees.animation)
  console.log('✓ MODULE_META.finance.animation:', MODULE_META.finance.animation)
  console.log('✓ MODULE_META.inventory.animation:', MODULE_META.inventory.animation)
  console.log('✓ MODULE_META.transport.animation:', MODULE_META.transport.animation)
  console.log('✓ MODULE_META.hr.animation:', MODULE_META.hr.animation)
  console.log('✓ MODULE_META.users.animation:', MODULE_META.users.animation)
  console.log('✓ MODULE_META.setup.animation:', MODULE_META.setup.animation)
  console.log('✓ MODULE_META["daily-diary"].animation:', MODULE_META['daily-diary'].animation)
  console.log('✓ MODULE_META.students.animation:', MODULE_META.students.animation)

  console.log('\n=== Step 3: Checking HTTP endpoint for audit_logs.json ===')
  const res = await fetch('http://localhost:3000/animations/home/audit_logs.json')
  console.log('✓ HTTP status for audit_logs.json:', res.status, res.headers.get('content-type'))
  if (res.status !== 200) {
    throw new Error('HTTP status is not 200: ' + res.status)
  }
  const fetchedJson = await res.json()
  if (fetchedJson.assets[0].p.length !== asset.p.length) {
    throw new Error('Fetched JSON asset length mismatch!')
  }
  console.log('✓ HTTP fetch verified and identical to disk asset')

  console.log('\n=== Step 4: Checking HTTP endpoints for all other modules (regression tests) ===')
  const modulesToTest = [
    { name: 'settings.json', file: 'settings.json' },
    { name: 'announcements.json', file: 'announcements.json' },
    { name: 'dashboard.json', file: 'dashboard.json' },
    { name: 'reports_analytics.json', file: 'reports_analytics.json' },
    { name: 'admissions.json', file: 'admissions.json' },
    { name: 'fees.json', file: 'fees.json' },
    { name: 'inventory.json', file: 'inventory.json' },
    { name: 'transport.json', file: 'transport.json' },
    { name: 'hr_workforce.json', file: 'hr_workforce.json' },
    { name: 'users.json', file: 'users.json' },
    { name: 'setup.json', file: 'setup.json' },
    { name: 'students.json', file: 'students.json' },
    { name: 'daily_diary.json', file: 'daily_diary.json' }
  ]

  for (const m of modulesToTest) {
    const r = await fetch(`http://localhost:3000/animations/home/${m.file}`)
    console.log(`✓ HTTP status for ${m.file}:`, r.status, r.headers.get('content-type'))
    if (r.status !== 200) {
      throw new Error(`HTTP status is not 200 for ${m.file}: ` + r.status)
    }
  }

  console.log('\n=== Step 5: Checking Authenticated /app/home page ===')
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
  const homeHtml = await homeRes.text()
  
  if (!homeHtml.includes('Audit Logs') || !homeHtml.includes('/app/audit')) {
    throw new Error('Home page does not contain Audit Logs module link!')
  }
  console.log('✓ /app/home contains Audit Logs card pointing to /app/audit')

  if (!homeHtml.includes('PreO Learning') || !homeHtml.includes('/app/learning')) {
    throw new Error('Home page does not contain PreO Learning module link!')
  }
  console.log('✓ /app/home contains PreO Learning card pointing to /app/learning')

  if (!homeHtml.includes('Settings') || !homeHtml.includes('/app/settings')) {
    throw new Error('Home page does not contain Settings module link!')
  }
  console.log('✓ /app/home contains Settings card pointing to /app/settings')

  if (!homeHtml.includes('Announcements') || !homeHtml.includes('/app/communication')) {
    throw new Error('Home page does not contain Announcements module link!')
  }
  console.log('✓ /app/home contains Announcements card pointing to /app/communication')

  if (!homeHtml.includes('Dashboard') || !homeHtml.includes('/app/dashboard')) {
    throw new Error('Home page does not contain Dashboard module link!')
  }
  console.log('✓ /app/home contains Dashboard card pointing to /app/dashboard')

  if ((!homeHtml.includes('Reports &amp; Analytics') && !homeHtml.includes('Reports & Analytics')) || !homeHtml.includes('/app/reports')) {
    throw new Error('Home page does not contain Reports & Analytics module link!')
  }
  console.log('✓ /app/home contains Reports & Analytics card pointing to /app/reports')

  if (!homeHtml.includes('Admissions') || !homeHtml.includes('/app/admissions')) {
    throw new Error('Home page does not contain Admissions module link!')
  }
  console.log('✓ /app/home contains Admissions card pointing to /app/admissions')

  if (!homeHtml.includes('Fees') || !homeHtml.includes('/app/finance')) {
    throw new Error('Home page does not contain Fees module link!')
  }
  console.log('✓ /app/home contains Fees card pointing to /app/finance')

  if (!homeHtml.includes('Inventory') || !homeHtml.includes('/app/inventory')) {
    throw new Error('Home page does not contain Inventory module link!')
  }
  console.log('✓ /app/home contains Inventory card pointing to /app/inventory')

  if (!homeHtml.includes('Transport') || !homeHtml.includes('/app/transport')) {
    throw new Error('Home page does not contain Transport module link!')
  }
  console.log('✓ /app/home contains Transport card pointing to /app/transport')

  if ((!homeHtml.includes('HR &amp; Workforce') && !homeHtml.includes('HR & Workforce')) || !homeHtml.includes('/app/hr')) {
    throw new Error('Home page does not contain HR & Workforce module link!')
  }
  console.log('✓ /app/home contains HR & Workforce card pointing to /app/hr')

  if (!homeHtml.includes('Users') || !homeHtml.includes('/app/users')) {
    throw new Error('Home page does not contain Users module link!')
  }
  console.log('✓ /app/home contains Users card pointing to /app/users')

  if (!homeHtml.includes('Setup') || !homeHtml.includes('/app/setup')) {
    throw new Error('Home page does not contain Setup module link!')
  }
  console.log('✓ /app/home contains Setup card pointing to /app/setup')

  if (!homeHtml.includes('Daily Diary') || !homeHtml.includes('/app/daily-diary')) {
    throw new Error('Home page does not contain Daily Diary module link!')
  }
  console.log('✓ /app/home contains Daily Diary card pointing to /app/daily-diary')

  if (!homeHtml.includes('Students') || !homeHtml.includes('/app/students')) {
    throw new Error('Home page does not contain Students module link!')
  }
  console.log('✓ /app/home contains Students card pointing to /app/students')

  console.log('\n=== ALL AUDIT LOGS LOTTIE VERIFICATIONS PASSED SUCCESSFULLY! ===')
}

verify().catch(err => {
  console.error('VERIFICATION FAILED:', err)
  process.exit(1)
})
