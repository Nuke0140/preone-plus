import fs from 'fs'
import path from 'path'
import { homeModules } from '../src/lib/modules'
import { signSession, SESSION_COOKIE } from '../src/lib/auth'

async function verify() {
  console.log('--- Verifying PreO Learning Mascot Lottie Integration ---')

  // 1. Check file on disk
  const filePath = path.join(process.cwd(), 'public/animations/home/preo_learning_mascot.json')
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`)
  }

  const rawJson = fs.readFileSync(filePath, 'utf8')
  const lottieData = JSON.parse(rawJson)
  console.log(`Lottie animation: ${lottieData.nm}`)
  console.log(`Dimensions: ${lottieData.w}x${lottieData.h}, Frame rate: ${lottieData.fr}fps, Duration: ${lottieData.op - lottieData.ip} frames`)
  console.log(`Assets count: ${lottieData.assets?.length || 0}`)
  if (!lottieData.assets?.[0]?.p?.startsWith('data:image/webp')) {
    throw new Error('Asset does not contain embedded WebP base64 artwork!')
  }
  console.log('Self-contained WebP asset verified.')

  // 2. Test HTTP GET for public asset
  const assetRes = await fetch('http://localhost:3000/animations/home/preo_learning_mascot.json')
  console.log(`HTTP GET /animations/home/preo_learning_mascot.json: ${assetRes.status}`)
  if (assetRes.status !== 200) {
    throw new Error(`Asset returned status ${assetRes.status}`)
  }

  // 3. Test modules config
  const modules = homeModules('OWNER')
  const preoModule = modules.find(m => m.key === 'learning' || m.key === 'preo-learning' || m.key === 'preo_learning')
  if (!preoModule) {
    throw new Error('PreO Learning module not found in homeModules!')
  }
  console.log(`PreO Learning module key: ${preoModule.key}, label: ${preoModule.label}`)
  console.log(`PreO Learning animation configured: ${preoModule.animation}`)
  if (preoModule.animation !== '/animations/home/preo_learning_mascot.json') {
    throw new Error(`Expected animation '/animations/home/preo_learning_mascot.json' but got '${preoModule.animation}'`)
  }

  // 4. Test Home page SSR
  const token = await signSession({
    uid: 'test-owner',
    email: 'owner@example.com',
    name: 'School Owner',
    tenantId: 'tenant-1',
    branchId: 'branch-1',
    role: 'OWNER',
    roles: ['OWNER'],
  })

  const homeRes = await fetch('http://localhost:3000/app/home', {
    headers: {
      Cookie: `${SESSION_COOKIE}=${token}`,
    },
  })
  console.log(`HTTP GET /app/home: ${homeRes.status}`)
  if (homeRes.status !== 200) {
    throw new Error(`/app/home returned status ${homeRes.status}`)
  }

  const html = await homeRes.text()
  if (!html.includes('PreO Learning')) {
    throw new Error('PreO Learning title not found on /app/home!')
  }
  console.log('PreO Learning card rendered with title.')

  console.log('--- ALL CHECKS PASSED SUCCESSFULLY ---')
}

verify().catch(err => {
  console.error('Verification failed:', err)
  process.exit(1)
})
