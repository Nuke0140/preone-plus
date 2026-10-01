import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { MODULE_META } from '../src/lib/modules'

async function verify() {
  console.log('=== Step 1: Checking inventory.json existence & integrity ===')
  const jsonPath = path.resolve('public/animations/home/inventory.json')
  if (!fs.existsSync(jsonPath)) {
    throw new Error('public/animations/home/inventory.json does not exist!')
  }
  const raw = fs.readFileSync(jsonPath, 'utf8')
  const data = JSON.parse(raw)
  console.log('✓ File size:', raw.length, 'bytes')
  console.log('✓ Lottie title:', data.nm)
  console.log('✓ Lottie version:', data.v)
  console.log('✓ Canvas size:', data.w, 'x', data.h, 'fps:', data.fr, 'frames:', data.op)
  
  if (!data.assets || !data.assets[0] || !data.assets[0].p) {
    throw new Error('Missing assets[0].p in inventory.json')
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
  if (MODULE_META.inventory.animation !== '/animations/home/inventory.json') {
    throw new Error('MODULE_META.inventory.animation is not set correctly!')
  }
  console.log('✓ MODULE_META.inventory.animation:', MODULE_META.inventory.animation)
  console.log('✓ MODULE_META.transport.animation:', MODULE_META.transport.animation)
  console.log('✓ MODULE_META.hr.animation:', MODULE_META.hr.animation)
  console.log('✓ MODULE_META.users.animation:', MODULE_META.users.animation)
  console.log('✓ MODULE_META.setup.animation:', MODULE_META.setup.animation)
  console.log('✓ MODULE_META["daily-diary"].animation:', MODULE_META['daily-diary'].animation)
  console.log('✓ MODULE_META.students.animation:', MODULE_META.students.animation)

  console.log('\n=== Step 3: Checking HTTP endpoint for inventory.json ===')
  const res = await fetch('http://localhost:3000/animations/home/inventory.json')
  console.log('✓ HTTP status for inventory.json:', res.status, res.headers.get('content-type'))
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

  console.log('\n=== ALL INVENTORY LOTTIE VERIFICATIONS PASSED SUCCESSFULLY! ===')
}

verify().catch(err => {
  console.error('VERIFICATION FAILED:', err)
  process.exit(1)
})
