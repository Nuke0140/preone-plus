/**
 * PreOne — /app/setup/branding
 * School Brand Identity Center: Architectural Certification & Comprehensive E2E Verification
 *
 * Validates:
 * 1. Architecture: Tenant.logoUrl + SchoolConfig(domain = "BRANDING") without shadow tables
 * 2. Defaults: Fresh tenant resolves to canonical PreOne defaults (#7C3AED, #3B82F6, WINDOWS_SHELL, null banner, null logo)
 * 3. Validation: HEX color regex checks and WCAG relative luminance contrast calculations
 * 4. Customization: Updates persist correctly (logo to Tenant, theme to SchoolConfig)
 * 5. Reset Theme: Resets colors/layout/banner to PreOne defaults while PRESERVING school logo, with audit log
 * 6. Explicit Logo Removal: Operates independently of theme reset
 * 7. Multi-Tenant Isolation: Tenant A's visual identity never leaks to Tenant B
 * 8. Setup Readiness: Pure predicate evaluation, RECOMMENDED status, non-blocking behavior
 */

import { db } from '../src/lib/db'
import {
  PREONE_BRANDING_DEFAULTS,
  isValidHexColor,
  evaluateColorContrast,
} from '../src/lib/branding'
import {
  getEffectiveBranding,
  resetThemeSettings,
} from '../src/lib/branding-service'
import { evaluateStep, loadContext } from '../src/lib/setup/engine'
import { STEP_MAP } from '../src/lib/setup/steps'
import { ConfigDomain } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { isDurableAssetUrl, saveBrandingAsset, deleteBrandingAsset } from '../src/lib/storage'

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

async function runTests() {
  console.log('===============================================================')
  console.log('PREONE: SCHOOL BRAND IDENTITY CENTER (/app/setup/branding) E2E')
  console.log('===============================================================\n')

  const testSuffix = Date.now().toString().slice(-6)
  const tenantSlugA = `brand-test-a-${testSuffix}`
  const tenantSlugB = `brand-test-b-${testSuffix}`

  let tenantA: any = null
  let tenantB: any = null

  try {
    // -------------------------------------------------------------------------
    // TEST 1: CANONICAL ARCHITECTURE & ZERO SHADOW TABLES
    // -------------------------------------------------------------------------
    console.log('[1] Canonical Architecture & Entity Boundaries')

    // Create 2 test tenants
    tenantA = await db.tenant.create({
      data: {
        name: `Sunrise Academy ${testSuffix}`,
        code: `SA${testSuffix.slice(0, 4)}`,
        status: 'ACTIVE',
      },
    })

    tenantB = await db.tenant.create({
      data: {
        name: `Bloom Kids ${testSuffix}`,
        code: `BK${testSuffix.slice(0, 4)}`,
        status: 'ACTIVE',
      },
    })

    assert(Boolean(tenantA.id), 'Tenant A created successfully')
    assert(Boolean(tenantB.id), 'Tenant B created successfully')

    // Verify Tenant model has logoUrl field
    assert('logoUrl' in tenantA, 'Tenant model contains canonical logoUrl column')

    // Verify ConfigDomain enum includes BRANDING
    assert(ConfigDomain.BRANDING === 'BRANDING', 'ConfigDomain.BRANDING enum value exists')

    // Verify step registry defines branding as RECOMMENDED
    const brandingStep = STEP_MAP['branding']
    assert(brandingStep !== undefined, 'branding step is defined in STEP_MAP')
    assert(brandingStep?.applicability === 'RECOMMENDED', 'branding step is marked RECOMMENDED')
    assert(brandingStep?.phase === 'FOUNDATION', 'branding step belongs to FOUNDATION phase')

    // -------------------------------------------------------------------------
    // TEST 2: FRESH TENANT DEFAULT BRANDING RESOLUTION
    // -------------------------------------------------------------------------
    console.log('\n[2] Fresh Tenant Default Branding Resolution')

    const defaultsA = await getEffectiveBranding(tenantA.id)

    assert(defaultsA.schoolName === `Sunrise Academy ${testSuffix}`, 'schoolName matches Tenant.name')
    assert(defaultsA.schoolCode === `SA${testSuffix.slice(0, 4)}`, 'schoolCode matches Tenant.code')
    assert(defaultsA.logoUrl === null, 'logoUrl defaults to null')
    assert(defaultsA.primaryColor === PREONE_BRANDING_DEFAULTS.primaryColor, `primaryColor defaults to ${PREONE_BRANDING_DEFAULTS.primaryColor}`)
    assert(defaultsA.accentColor === PREONE_BRANDING_DEFAULTS.accentColor, `accentColor defaults to ${PREONE_BRANDING_DEFAULTS.accentColor}`)
    assert(defaultsA.layout === PREONE_BRANDING_DEFAULTS.layout, `layout defaults to ${PREONE_BRANDING_DEFAULTS.layout}`)
    assert(defaultsA.bannerUrl === PREONE_BRANDING_DEFAULTS.bannerUrl, 'bannerUrl defaults to null')

    // -------------------------------------------------------------------------
    // TEST 3: HEX COLOR VALIDATION & CONTRAST CALCULATION
    // -------------------------------------------------------------------------
    console.log('\n[3] HEX Color Validation & WCAG Contrast Evaluation')

    // Valid colors
    assert(isValidHexColor('#7C3AED'), '#7C3AED is recognized as valid HEX')
    assert(isValidHexColor('#3B82F6'), '#3B82F6 is recognized as valid HEX')
    assert(isValidHexColor('#fff'), '#fff (3-char) is recognized as valid HEX')
    assert(isValidHexColor('#FFFFFF'), '#FFFFFF is recognized as valid HEX')
    assert(isValidHexColor('#000000'), '#000000 is recognized as valid HEX')

    // Invalid colors
    assert(!isValidHexColor('purple'), 'Named color "purple" is rejected')
    assert(!isValidHexColor('7C3AED'), 'Hex without leading hash is rejected')
    assert(!isValidHexColor('#12'), '2-char hex is rejected')
    assert(!isValidHexColor('#12345'), '5-char hex is rejected')
    assert(!isValidHexColor('#ZZZZZZ'), 'Non-hex characters are rejected')
    assert(!isValidHexColor(null), 'Null is rejected')

    // Contrast evaluations
    const standardContrast = evaluateColorContrast('#7C3AED', '#3B82F6')
    assert(
      !standardContrast.isWeakContrast,
      `Standard purple #7C3AED has good contrast against white text (ratio: ${standardContrast.primaryOnWhiteRatio}:1)`
    )

    const darkContrast = evaluateColorContrast('#1E293B', '#3B82F6')
    assert(
      !darkContrast.isWeakContrast,
      `Dark navy #1E293B has good contrast against white text (ratio: ${darkContrast.primaryOnWhiteRatio}:1)`
    )

    // Very light primary color (e.g. bright yellow #FFFF00 or white #FFFFFF)
    const weakContrast = evaluateColorContrast('#FFFF00', '#3B82F6')
    assert(
      weakContrast.isWeakContrast,
      `Bright yellow #FFFF00 is flagged for weak contrast against white text (ratio: ${weakContrast.primaryOnWhiteRatio}:1)`
    )
    assert(
      Boolean(weakContrast.warningMessage && weakContrast.warningMessage.includes('hard to read')),
      'Weak contrast generates informative warning message'
    )

    // -------------------------------------------------------------------------
    // TEST 4: CUSTOM BRANDING PERSISTENCE (LOGO + THEME)
    // -------------------------------------------------------------------------
    console.log('\n[4] Custom Branding Persistence')

    const customLogo = 'https://cdn.sunrise-academy.edu/logo.png'
    const customBanner = 'https://cdn.sunrise-academy.edu/campus-banner.jpg'
    const customPrimary = '#059669' // Emerald Green
    const customAccent = '#F59E0B' // Amber
    const customLayout = 'CLASSIC_SIDEBAR'

    // 1. Update logo on Tenant directly
    await db.tenant.update({
      where: { id: tenantA.id },
      data: { logoUrl: customLogo },
    })

    // 2. Update SchoolConfig(BRANDING)
    await db.schoolConfig.upsert({
      where: {
        tenantId_domain: {
          tenantId: tenantA.id,
          domain: 'BRANDING',
        },
      },
      update: {
        data: {
          primaryColor: customPrimary,
          accentColor: customAccent,
          layout: customLayout,
          bannerUrl: customBanner,
        },
      },
      create: {
        tenantId: tenantA.id,
        domain: 'BRANDING',
        data: {
          primaryColor: customPrimary,
          accentColor: customAccent,
          layout: customLayout,
          bannerUrl: customBanner,
        },
      },
    })

    // Verify resolved branding
    const effectiveA = await getEffectiveBranding(tenantA.id)

    assert(effectiveA.logoUrl === customLogo, 'Custom logo correctly resolved from Tenant.logoUrl')
    assert(effectiveA.primaryColor === customPrimary, 'Custom primary color resolved from SchoolConfig')
    assert(effectiveA.accentColor === customAccent, 'Custom accent color resolved from SchoolConfig')
    assert(effectiveA.layout === customLayout, 'Custom layout resolved from SchoolConfig')
    assert(effectiveA.bannerUrl === customBanner, 'Custom banner resolved from SchoolConfig')

    // Verify no logo duplication inside SchoolConfig.data
    const configRecord = await db.schoolConfig.findUnique({
      where: {
        tenantId_domain: {
          tenantId: tenantA.id,
          domain: 'BRANDING',
        },
      },
    })
    const configData = configRecord?.data as Record<string, unknown>
    assert(configData.logoUrl === undefined, 'SchoolConfig.data does NOT duplicate logoUrl')

    // -------------------------------------------------------------------------
    // TEST 5: RESET THEME PRESERVES SCHOOL LOGO
    // -------------------------------------------------------------------------
    console.log('\n[5] Reset Theme Behavior (Preserves School Logo)')

    const resetResult = await resetThemeSettings(tenantA.id, {
      id: 'admin-user-1',
      name: 'System Admin',
    })

    assert(resetResult.primaryColor === PREONE_BRANDING_DEFAULTS.primaryColor, 'Theme reset restored default primaryColor')
    assert(resetResult.accentColor === PREONE_BRANDING_DEFAULTS.accentColor, 'Theme reset restored default accentColor')
    assert(resetResult.layout === PREONE_BRANDING_DEFAULTS.layout, 'Theme reset restored default layout')
    assert(resetResult.bannerUrl === null, 'Theme reset removed bannerUrl')

    // CRITICAL CHECK: School logo MUST be preserved!
    assert(resetResult.logoUrl === customLogo, 'CRITICAL: School logo was PRESERVED after theme reset')

    const tenantAfterReset = await db.tenant.findUnique({
      where: { id: tenantA.id },
      select: { logoUrl: true },
    })
    assert(tenantAfterReset?.logoUrl === customLogo, 'Tenant.logoUrl is still intact in the database')

    // Verify AuditLog was emitted
    const auditLogs = await db.auditLog.findMany({
      where: {
        tenantId: tenantA.id,
        action: 'BRANDING_THEME_RESET',
      },
    })
    assert(auditLogs.length > 0, 'Audit log emitted with action BRANDING_THEME_RESET')
    const oldVals = JSON.parse(auditLogs[0]?.oldValues || '{}')
    const newVals = JSON.parse(auditLogs[0]?.newValues || '{}')
    assert(oldVals?.previousPrimary === customPrimary, 'Audit log captured previous custom primary color')
    assert(newVals?.logoPreserved === true, 'Audit log confirmed logoPreserved: true')

    // -------------------------------------------------------------------------
    // TEST 6: EXPLICIT LOGO REMOVAL
    // -------------------------------------------------------------------------
    console.log('\n[6] Explicit Logo Removal (Separate Action)')

    await db.tenant.update({
      where: { id: tenantA.id },
      data: { logoUrl: null },
    })

    const brandingAfterLogoRemoval = await getEffectiveBranding(tenantA.id)
    assert(brandingAfterLogoRemoval.logoUrl === null, 'Explicit logo removal sets logoUrl to null')
    assert(
      brandingAfterLogoRemoval.primaryColor === PREONE_BRANDING_DEFAULTS.primaryColor,
      'Theme colors remain untouched when logo is removed'
    )

    // -------------------------------------------------------------------------
    // TEST 7: MULTI-TENANT ISOLATION
    // -------------------------------------------------------------------------
    console.log('\n[7] Multi-Tenant Isolation')

    // Tenant B customizes theme
    await db.schoolConfig.create({
      data: {
        tenantId: tenantB.id,
        domain: 'BRANDING',
        data: {
          primaryColor: '#DC2626', // Crimson Red
          accentColor: '#9333EA', // Violet
          layout: 'CLASSIC_SIDEBAR',
          bannerUrl: 'https://cdn.bloom-kids.edu/banner.png',
        },
      },
    })
    await db.tenant.update({
      where: { id: tenantB.id },
      data: { logoUrl: 'https://cdn.bloom-kids.edu/logo.png' },
    })

    const brandingTenantB = await getEffectiveBranding(tenantB.id)
    const brandingTenantA = await getEffectiveBranding(tenantA.id)

    assert(brandingTenantB.primaryColor === '#DC2626', 'Tenant B has crimson red')
    assert(brandingTenantA.primaryColor === PREONE_BRANDING_DEFAULTS.primaryColor, 'Tenant A still has default purple')
    assert(brandingTenantB.logoUrl === 'https://cdn.bloom-kids.edu/logo.png', 'Tenant B has its own logo')
    assert(brandingTenantA.logoUrl === null, 'Tenant A has null logo')

    // -------------------------------------------------------------------------
    // TEST 8: SETUP READINESS & PURE PREDICATE EVALUATION
    // -------------------------------------------------------------------------
    console.log('\n[8] Setup Readiness Engine & Pure Predicates')

    // Clean up all branding config from Tenant A to test unconfigured baseline
    await db.schoolConfig.deleteMany({ where: { tenantId: tenantA.id, domain: 'BRANDING' } })
    await db.tenant.update({ where: { id: tenantA.id }, data: { logoUrl: null } })

    // Fresh evaluation before any branding on unconfigured tenant
    const contextFresh = await loadContext(tenantA.id)
    const evalUnconfigured = evaluateStep('branding', contextFresh!)
    assert(
      evalUnconfigured.satisfied === false,
      'Pure predicate: Unconfigured tenant with null logo and no config is not satisfied'
    )

    // Now configure Tenant A with a logo
    await db.tenant.update({
      where: { id: tenantA.id },
      data: { logoUrl: 'https://cdn.sunrise-academy.edu/logo.png' },
    })

    const contextWithLogo = await loadContext(tenantA.id)
    const evalWithLogo = evaluateStep('branding', contextWithLogo!)
    assert(
      evalWithLogo.satisfied === true,
      'Pure predicate: Tenant with logoUrl is satisfied (canonical rule: logo exists OR branding config exists)'
    )

    // Non-blocking verification: branding is RECOMMENDED, not MANDATORY
    assert(
      STEP_MAP['branding']?.applicability === 'RECOMMENDED',
      'Branding is RECOMMENDED and does not block Go-Live or Phase 1 progression'
    )

    // -------------------------------------------------------------------------
    // TEST 9: DURABLE ASSET STORAGE & FILE UPLOAD PERSISTENCE
    // -------------------------------------------------------------------------
    console.log('\n[9] Durable Asset Storage & File Upload Persistence')

    // 1. isDurableAssetUrl rejection of temporary / transient URIs
    assert(
      isDurableAssetUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==') === false,
      'isDurableAssetUrl strictly rejects base64 data URIs'
    )
    assert(
      isDurableAssetUrl('blob:http://localhost:3000/12345-67890') === false,
      'isDurableAssetUrl strictly rejects browser blob object URLs'
    )
    assert(
      isDurableAssetUrl('/uploads/branding/school-logo.png') === true,
      'isDurableAssetUrl accepts durable relative paths (/uploads/...)'
    )
    assert(
      isDurableAssetUrl('https://storage.googleapis.com/school-assets/logo.png') === true,
      'isDurableAssetUrl accepts HTTPS web URLs'
    )

    // 2. Physical File Saving & Persistence
    const testBuffer = Buffer.from('FAKE-PNG-IMAGE-BINARY-DATA-FOR-TESTING')
    const savedAsset = await saveBrandingAsset({
      tenantId: tenantA.id,
      type: 'logo',
      buffer: testBuffer,
      mimeType: 'image/png',
      originalName: 'crest.png',
    })

    assert(
      savedAsset.url.startsWith(`/uploads/branding/${tenantA.id}-logo-`),
      `saveBrandingAsset produces structured durable URL (${savedAsset.url})`
    )

    const expectedDiskPath = path.join(process.cwd(), 'public', savedAsset.url)
    assert(
      fs.existsSync(expectedDiskPath),
      'Uploaded asset physically exists on disk under public/uploads/branding'
    )

    const diskContent = await fs.promises.readFile(expectedDiskPath)
    assert(
      diskContent.equals(testBuffer),
      'Asset disk contents exactly match the uploaded file buffer'
    )

    // 3. Database Persistence to Canonical Tenant.logoUrl
    await db.tenant.update({
      where: { id: tenantA.id },
      data: { logoUrl: savedAsset.url },
    })

    const directDbTenant = await db.tenant.findUnique({
      where: { id: tenantA.id },
      select: { logoUrl: true },
    })

    assert(
      directDbTenant?.logoUrl === savedAsset.url,
      'Tenant.logoUrl in PostgreSQL directly matches durable file path'
    )
    assert(
      !directDbTenant?.logoUrl?.startsWith('data:') && !directDbTenant?.logoUrl?.startsWith('blob:'),
      'CRITICAL: Tenant.logoUrl is durable and NEVER stored as base64 or blob URL'
    )

    // -------------------------------------------------------------------------
    // TEST 10: GLOBAL CROSS-SURFACE PROPAGATION & BRAND CONSISTENCY
    // -------------------------------------------------------------------------
    console.log('\n[10] Global Cross-Surface Propagation & Brand Consistency')

    // 1. Resolver consistency for Home and Workspace
    const resolvedEffectiveA = await getEffectiveBranding(tenantA.id)
    assert(
      resolvedEffectiveA.logoUrl === savedAsset.url,
      'getEffectiveBranding returns the exact durable logoUrl'
    )
    assert(
      resolvedEffectiveA.schoolName === tenantA.name,
      'getEffectiveBranding resolves schoolName correctly'
    )

    // 2. Theme Reset retains durable logo
    await resetThemeSettings(tenantA.id, { id: 'admin-1', name: 'Admin', role: 'ADMIN' })
    const afterResetTenant = await db.tenant.findUnique({
      where: { id: tenantA.id },
      select: { logoUrl: true },
    })
    assert(
      afterResetTenant?.logoUrl === savedAsset.url,
      'CRITICAL: Durable school logo survives theme reset intact'
    )

    // 3. Storage asset cleanup
    await deleteBrandingAsset(savedAsset.url)
    assert(
      !fs.existsSync(expectedDiskPath),
      'deleteBrandingAsset cleanly unlinks asset from disk on cleanup'
    )

  } catch (err: any) {
    console.error('Unexpected error during test execution:', err)
    failed++
  } finally {
    // Cleanup test data
    console.log('\n[Cleanup] Removing test tenants and related records...')
    if (tenantA?.id) {
      await db.auditLog.deleteMany({ where: { tenantId: tenantA.id } })
      await db.schoolConfig.deleteMany({ where: { tenantId: tenantA.id } })
      await db.schoolSetupStep.deleteMany({ where: { tenantId: tenantA.id } })
      await db.tenant.delete({ where: { id: tenantA.id } }).catch(() => {})
    }
    if (tenantB?.id) {
      await db.auditLog.deleteMany({ where: { tenantId: tenantB.id } })
      await db.schoolConfig.deleteMany({ where: { tenantId: tenantB.id } })
      await db.schoolSetupStep.deleteMany({ where: { tenantId: tenantB.id } })
      await db.tenant.delete({ where: { id: tenantB.id } }).catch(() => {})
    }
  }

  console.log('\n===============================================================')
  console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`)
  console.log('===============================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch((e) => {
  console.error('Fatal test error:', e)
  process.exit(1)
})
