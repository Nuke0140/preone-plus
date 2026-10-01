/**
 * PREONE DESIGN SYSTEM v4.1: TYPOGRAPHY VERIFICATION SUITE (SECTION 5.2)
 *
 * Verifies that the strict 12-role typographic system is fully implemented,
 * configured in CSS variables, Tailwind tokens, CSS classes, and React components.
 */

import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '..')

const EXPECTED_ROLES = [
  't-display',
  't-h1',
  't-h2',
  't-h3',
  't-h4',
  't-body-lg',
  't-body',
  't-body-sm',
  't-caption',
  't-label',
  't-btn',
  't-kpi',
  't-data',
]

const EXPECTED_CSS_VARS = [
  '--fs-display',
  '--fs-h1',
  '--fs-h2',
  '--fs-h3',
  '--fs-h4',
  '--fs-body-lg',
  '--fs-body',
  '--fs-body-sm',
  '--fs-caption',
  '--fs-label',
  '--fs-btn',
  '--fs-kpi',
  '--fs-data',
]

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`)
    passed++
  } else {
    console.error(`  ✗ ${message}`)
    failed++
  }
}

async function run() {
  console.log('===============================================================')
  console.log('PREONE: 12-ROLE TYPOGRAPHY SYSTEM (SECTION 5.2) VERIFICATION')
  console.log('===============================================================\n')

  // --- Phase 1: globals.css Class Definitions
  console.log('--- Phase 1: globals.css 12-Role CSS Classes')
  const globalsCssPath = path.join(ROOT, 'src/app/globals.css')
  const globalsCss = fs.readFileSync(globalsCssPath, 'utf8')

  for (const role of EXPECTED_ROLES) {
    const classRegex = new RegExp(`\\.${role}\\s*\\{`, 'i')
    assert(classRegex.test(globalsCss), `globals.css defines class .${role}`)
  }

  // --- Phase 2: CSS Custom Properties in :root
  console.log('\n--- Phase 2: CSS Custom Properties in :root')
  for (const cssVar of EXPECTED_CSS_VARS) {
    assert(globalsCss.includes(cssVar), `globals.css declares token ${cssVar}`)
  }

  // --- Phase 3: Tailwind Configuration
  console.log('\n--- Phase 3: Tailwind Config Typography Scale')
  const tailwindPath = path.join(ROOT, 'tailwind.config.ts')
  const tailwindContent = fs.readFileSync(tailwindPath, 'utf8')

  for (const role of EXPECTED_ROLES) {
    assert(tailwindContent.includes(`'${role}'`), `tailwind.config.ts maps fontSize '${role}'`)
  }

  // --- Phase 4: React Typography Components
  console.log('\n--- Phase 4: React Typography Components Library')
  const typogPath = path.join(ROOT, 'src/components/preone/Typography.tsx')
  assert(fs.existsSync(typogPath), 'src/components/preone/Typography.tsx exists')
  const typogContent = fs.readFileSync(typogPath, 'utf8')

  const expectedComponents = [
    'Typography',
    'Display',
    'H1',
    'H2',
    'H3',
    'H4',
    'BodyLg',
    'Body',
    'BodySm',
    'Caption',
    'LabelText',
    'BtnText',
    'KPI',
    'DataText',
  ]

  for (const comp of expectedComponents) {
    assert(typogContent.includes(`export function ${comp}`), `Typography.tsx exports <${comp}>`)
  }

  // --- Phase 5: UI Module Re-Export
  console.log('\n--- Phase 5: src/components/preone/ui.tsx Re-Exports')
  const uiPath = path.join(ROOT, 'src/components/preone/ui.tsx')
  const uiContent = fs.readFileSync(uiPath, 'utf8')
  assert(uiContent.includes("export * from './Typography'"), 'ui.tsx re-exports all typography components')

  // --- Phase 6: Canonical Inventory Item Schema Invariant
  console.log('\n--- Phase 6: Canonical Inventory Item Schema Invariant')
  const stockRoutePath = path.join(ROOT, 'src/app/api/v1/inventory/stock/route.ts')
  const stockContent = fs.readFileSync(stockRoutePath, 'utf8')
  const itemSelectOnly = stockContent.replace(/unit:\s*\{[^}]*\}/g, '')
  assert(!/item:\s*\{\s*select:\s*\{[^}]*\bcode:\s*true/s.test(itemSelectOnly), 'stock/route.ts item select does not query non-existent InventoryItem.code')
  assert(stockContent.includes('sku: true,'), 'stock/route.ts queries canonical InventoryItem.sku')
  assert(!stockContent.includes('costPriceCents: true,'), 'stock/route.ts does not query non-existent InventoryItem.costPriceCents')
  assert(stockContent.includes('reorderLevel: true,'), 'stock/route.ts queries canonical InventoryItem.reorderLevel')

  const movementsRoutePath = path.join(ROOT, 'src/app/api/v1/inventory/movements/route.ts')
  const movementsContent = fs.readFileSync(movementsRoutePath, 'utf8')
  const movementsItemSelectOnly = movementsContent.replace(/unit:\s*\{[^}]*\}/g, '')
  assert(!/item:\s*\{\s*select:\s*\{[^}]*\bcode:\s*true/s.test(movementsItemSelectOnly), 'movements/route.ts item select does not query non-existent InventoryItem.code')
  assert(movementsContent.includes('sku: true,'), 'movements/route.ts queries canonical InventoryItem.sku')

  console.log('\n===============================================================')
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`)
  console.log('===============================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
