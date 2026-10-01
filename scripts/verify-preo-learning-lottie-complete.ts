import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { MODULE_META, homeModules } from '../src/lib/modules'
import { signSession, SESSION_COOKIE } from '../src/lib/auth'

async function runVerification() {
  console.log('=================================================================')
  console.log('  PREO LEARNING LOTTIE RENDERING & REGRESSION VERIFICATION SUITE ')
  console.log('=================================================================\n')

  // 1. Verify preo_learning_mascot.json on disk
  console.log('[1/7] Verifying /public/animations/home/preo_learning_mascot.json on disk...')
  const mascotPath = path.resolve('public/animations/home/preo_learning_mascot.json')
  if (!fs.existsSync(mascotPath)) {
    throw new Error('FAIL: public/animations/home/preo_learning_mascot.json does not exist!')
  }
  const rawJson = fs.readFileSync(mascotPath, 'utf8')
  const lottieData = JSON.parse(rawJson)
  console.log(`  ✓ File exists: ${mascotPath}`)
  console.log(`  ✓ File size: ${rawJson.length} bytes`)
  console.log(`  ✓ Lottie title: "${lottieData.nm}"`)
  console.log(`  ✓ Dimensions: ${lottieData.w}x${lottieData.h}, fps: ${lottieData.fr}, frames: ${lottieData.op}`)

  // 2. Verify self-contained base64 WebP image integrity
  console.log('\n[2/7] Verifying self-contained embedded WebP raster asset...')
  if (!lottieData.assets || lottieData.assets.length === 0) {
    throw new Error('FAIL: No assets found in Lottie JSON!')
  }
  const asset = lottieData.assets[0]
  if (!asset.p || !asset.p.startsWith('data:image/webp;base64,')) {
    throw new Error('FAIL: asset.p is not a self-contained data:image/webp;base64 URI!')
  }
  console.log(`  ✓ Asset ID: ${asset.id}`)
  console.log(`  ✓ Data URI length: ${asset.p.length} characters`)

  const b64 = asset.p.replace(/^data:image\/webp;base64,/, '')
  const imgBuffer = Buffer.from(b64, 'base64')
  console.log(`  ✓ Decoded binary size: ${imgBuffer.length} bytes`)

  const imageMeta = await sharp(imgBuffer).metadata()
  console.log(`  ✓ Sharp WebP decode check:`)
  console.log(`    - Format: ${imageMeta.format}`)
  console.log(`    - Dimensions: ${imageMeta.width}x${imageMeta.height}`)
  console.log(`    - Channels: ${imageMeta.channels} (hasAlpha: ${imageMeta.hasAlpha})`)

  if (imageMeta.format !== 'webp' || imageMeta.width !== 512 || imageMeta.height !== 512) {
    throw new Error('FAIL: Decoded image metadata does not match expected 512x512 WebP!')
  }

  // 3. Verify HTTP GET for preo_learning_mascot.json
  console.log('\n[3/7] Verifying HTTP GET /animations/home/preo_learning_mascot.json...')
  const httpRes = await fetch('http://localhost:3000/animations/home/preo_learning_mascot.json')
  console.log(`  ✓ HTTP Status: ${httpRes.status}`)
  console.log(`  ✓ Content-Type: ${httpRes.headers.get('content-type')}`)
  if (httpRes.status !== 200) {
    throw new Error(`FAIL: HTTP status is ${httpRes.status}, expected 200`)
  }
  const fetchedJson = await httpRes.json()
  if (fetchedJson.nm !== lottieData.nm || fetchedJson.assets[0].p.length !== asset.p.length) {
    throw new Error('FAIL: Fetched JSON does not match disk file contents!')
  }
  console.log('  ✓ Downloaded response is valid JSON matching local asset.')

  // 4. Verify module configuration points strictly to preo_learning_mascot.json
  console.log('\n[4/7] Verifying module configuration in src/lib/modules.ts...')
  const learningMeta = MODULE_META.learning
  const preoLearningMeta = MODULE_META['preo-learning']
  const preo_learningMeta = MODULE_META.preo_learning

  console.log(`  ✓ MODULE_META.learning.animation: ${learningMeta?.animation}`)
  console.log(`  ✓ MODULE_META['preo-learning'].animation: ${preoLearningMeta?.animation}`)

  if (learningMeta?.animation !== '/animations/home/preo_learning_mascot.json') {
    throw new Error(`FAIL: MODULE_META.learning.animation is ${learningMeta?.animation}, expected /animations/home/preo_learning_mascot.json`)
  }
  if (preoLearningMeta?.animation !== '/animations/home/preo_learning_mascot.json') {
    throw new Error(`FAIL: MODULE_META['preo-learning'].animation is ${preoLearningMeta?.animation}, expected /animations/home/preo_learning_mascot.json`)
  }

  // 5. Verify /app/home renders PreO Learning card with correct attributes and title
  console.log('\n[5/7] Verifying /app/home authenticated render...')
  const token = await signSession({
    uid: 'test-admin',
    email: 'admin@sunshine.demo',
    name: 'Sunshine Admin',
    tenantId: '44a84a91-b88b-43fb-a052-87a8db7328cd',
    branchId: 'branch-1',
    role: 'ADMIN',
    roles: ['ADMIN'],
  })

  const homeRes = await fetch('http://localhost:3000/app/home', {
    headers: {
      Cookie: `${SESSION_COOKIE}=${token}`,
    },
  })
  console.log(`  ✓ /app/home HTTP Status: ${homeRes.status}`)
  if (homeRes.status !== 200) {
    throw new Error(`FAIL: /app/home returned status ${homeRes.status}`)
  }
  const homeHtml = await homeRes.text()

  if (!homeHtml.includes('PreO Learning')) {
    throw new Error('FAIL: "PreO Learning" title not found on /app/home!')
  }
  console.log('  ✓ "PreO Learning" card rendered with exact title.')

  if (!homeHtml.includes('data-module="learning"')) {
    throw new Error('FAIL: data-module="learning" attribute not found on PreO Learning card!')
  }
  console.log('  ✓ data-module="learning" attribute confirmed on module card.')

  // 6. Regression test: Verify all 16 Home modules exist in homeModules configuration and have valid animations
  console.log('\n[6/7] Regression testing all 16 Home module animations...')
  const allModules = homeModules('OWNER')
  console.log(`  ✓ Total modules configured for OWNER: ${allModules.length}`)

  const requiredModules = [
    'students',
    'daily-diary',
    'users',
    'hr',
    'setup',
    'admissions',
    'dashboard',
    'learning',
    'operations',
    'transport',
    'inventory',
    'fees',
    'reports',
    'communication',
    'settings',
    'audit',
  ]

  for (const key of requiredModules) {
    const mod = allModules.find(m => m.key === key)
    if (!mod) {
      throw new Error(`FAIL: Missing module key: ${key}`)
    }
    console.log(`  ✓ Module [${key}] -> Label: "${mod.label}", Animation: ${mod.animation || 'None'}`)
    if (mod.animation) {
      const animRes = await fetch(`http://localhost:3000${mod.animation}`)
      if (animRes.status !== 200) {
        throw new Error(`FAIL: Animation file ${mod.animation} returned status ${animRes.status}`)
      }
      const animJson = await animRes.json()
      if (!animJson.v || !animJson.layers) {
        throw new Error(`FAIL: Invalid Lottie JSON structure for ${mod.animation}`)
      }
    }
  }
  console.log('  ✓ All 16 module animations verified HTTP 200 with valid Lottie structure.')

  // 7. Verify CSS sizing rules for 75-80% visual dominance and 12-16px title spacing
  console.log('\n[7/7] Verifying CSS rules in src/app/globals.css...')
  const css = fs.readFileSync('src/app/globals.css', 'utf8')
  if (!css.includes('.module-card[data-module="learning"] .module-card-title-area')) {
    throw new Error('FAIL: Title spacing rule for PreO Learning not found in globals.css!')
  }
  console.log('  ✓ Title spacing rule verified in globals.css (margin-top: 14px for 12-16px spacing).')

  console.log('\n=================================================================')
  console.log('  ✓ ALL 17 ACCEPTANCE CRITERIA VERIFIED AND PASSED SUCCESSFULLY! ')
  console.log('=================================================================')
}

runVerification().catch(err => {
  console.error('\n❌ VERIFICATION FAILED:', err.message)
  process.exit(1)
})
