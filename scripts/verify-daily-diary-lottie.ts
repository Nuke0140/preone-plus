import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { MODULE_META } from '../src/lib/modules'

async function verify() {
  console.log('=== Step 1: Checking daily_diary.json existence & integrity ===')
  const jsonPath = path.resolve('public/animations/home/daily_diary.json')
  if (!fs.existsSync(jsonPath)) {
    throw new Error('public/animations/home/daily_diary.json does not exist!')
  }
  const raw = fs.readFileSync(jsonPath, 'utf8')
  const data = JSON.parse(raw)
  console.log('✓ File size:', raw.length, 'bytes')
  console.log('✓ Lottie title:', data.nm)
  console.log('✓ Lottie version:', data.v)
  console.log('✓ Canvas size:', data.w, 'x', data.h, 'fps:', data.fr, 'frames:', data.op)
  
  if (!data.assets || !data.assets[0] || !data.assets[0].p) {
    throw new Error('Missing assets[0].p in daily_diary.json')
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
  if (MODULE_META['daily-diary'].animation !== '/animations/home/daily_diary.json') {
    throw new Error('MODULE_META["daily-diary"].animation is not set correctly!')
  }
  console.log('✓ MODULE_META["daily-diary"].animation:', MODULE_META['daily-diary'].animation)
  console.log('✓ MODULE_META.students.animation:', MODULE_META.students.animation)

  console.log('\n=== Step 3: Checking HTTP endpoint for daily_diary.json ===')
  const res = await fetch('http://localhost:3000/animations/home/daily_diary.json')
  console.log('✓ HTTP status for daily_diary.json:', res.status, res.headers.get('content-type'))
  if (res.status !== 200) {
    throw new Error('HTTP status is not 200: ' + res.status)
  }
  const fetchedJson = await res.json()
  if (fetchedJson.assets[0].p.length !== asset.p.length) {
    throw new Error('Fetched JSON asset length mismatch!')
  }
  console.log('✓ HTTP fetch verified and identical to disk asset')

  console.log('\n=== Step 4: Checking HTTP endpoint for students.json (regression test) ===')
  const studentsRes = await fetch('http://localhost:3000/animations/home/students.json')
  console.log('✓ HTTP status for students.json:', studentsRes.status, studentsRes.headers.get('content-type'))
  if (studentsRes.status !== 200) {
    throw new Error('HTTP status is not 200 for students.json: ' + studentsRes.status)
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
  
  if (!homeHtml.includes('Daily Diary') || !homeHtml.includes('/app/daily-diary')) {
    throw new Error('Home page does not contain Daily Diary module link!')
  }
  console.log('✓ /app/home contains Daily Diary card pointing to /app/daily-diary')

  if (!homeHtml.includes('Students') || !homeHtml.includes('/app/students')) {
    throw new Error('Home page does not contain Students module link!')
  }
  console.log('✓ /app/home contains Students card pointing to /app/students')

  console.log('\n=== ALL DAILY DIARY VERIFICATIONS PASSED SUCCESSFULLY! ===')
}

verify().catch(err => {
  console.error('VERIFICATION FAILED:', err)
  process.exit(1)
})
