/**
 * Automated Verification Suite for PreOne OS Empty States with Personality & Guidance
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  EMPTY_STATE_CONFIG,
  EmptyState,
  SearchEmptyState,
  FilterEmptyState,
  PermissionEmptyState,
  DependencyEmptyState,
  ErrorState,
} from '../src/components/preone/EmptyState'
import {
  EMPTY_STATE_ILLUSTRATIONS,
  EmptyStateIllustration,
} from '../src/components/preone/EmptyStateIllustrations'

let passed = 0
let failed = 0

function test(name: string, condition: boolean) {
  if (condition) {
    console.log(`  ✓ ${name}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${name}`)
    failed++
  }
}

async function run() {
  console.log('===============================================================')
  console.log('PREONE: EMPTY STATES WITH PERSONALITY & GUIDANCE VERIFICATION')
  console.log('===============================================================')

  console.log('\n[1] Vector Line-Art Illustration Registry')
  const illustrationKeys = Object.keys(EMPTY_STATE_ILLUSTRATIONS)
  test('Contains at least 20 specialized line-art illustrations', illustrationKeys.length >= 20)
  test('Contains admissions/enquiries illustration', illustrationKeys.includes('enquiries'))
  test('Contains applications illustration', illustrationKeys.includes('applications'))
  test('Contains waitlist illustration', illustrationKeys.includes('waitlist'))
  test('Contains students illustration', illustrationKeys.includes('students'))
  test('Contains payments / fees illustration', illustrationKeys.includes('payments'))
  test('Contains attendance illustration', illustrationKeys.includes('attendance'))
  test('Contains documents illustration', illustrationKeys.includes('documents'))
  test('Contains classroom illustration', illustrationKeys.includes('classroom'))
  test('Contains search empty illustration', illustrationKeys.includes('search'))
  test('Contains filter empty illustration', illustrationKeys.includes('filter'))
  test('Contains error state illustration', illustrationKeys.includes('error'))
  test('Contains permission empty illustration', illustrationKeys.includes('permission'))

  console.log('\n[2] Canonical Empty State Configurations')
  const configKeys = Object.keys(EMPTY_STATE_CONFIG)
  test('Contains canonical preset configs', configKeys.length >= 10)

  const samplePresets = ['enquiries', 'applications', 'students', 'payments', 'search', 'filter', 'permission']
  for (const preset of samplePresets) {
    const conf = EMPTY_STATE_CONFIG[preset]
    test(`Preset "${preset}" has valid title and description`, !!(conf && conf.title && conf.description))
    test(`Preset "${preset}" specifies a valid illustration`, !!(conf && illustrationKeys.includes(conf.illustration)))
  }

  // Verify guidance action is present on operational presets
  test('Enquiries preset has guided primary action', !!(EMPTY_STATE_CONFIG.enquiries.actionLabel && EMPTY_STATE_CONFIG.enquiries.actionHref))
  test('Applications preset has guided primary action', !!(EMPTY_STATE_CONFIG.applications.actionLabel && EMPTY_STATE_CONFIG.applications.actionHref))
  test('Students preset has guided primary action', !!(EMPTY_STATE_CONFIG.students.actionLabel && EMPTY_STATE_CONFIG.students.actionHref))

  console.log('\n[3] Component Exports & Hierarchy')
  test('EmptyState is exported as a function/component', typeof EmptyState === 'function')
  test('SearchEmptyState is exported', typeof SearchEmptyState === 'function')
  test('FilterEmptyState is exported', typeof FilterEmptyState === 'function')
  test('PermissionEmptyState is exported', typeof PermissionEmptyState === 'function')
  test('DependencyEmptyState is exported', typeof DependencyEmptyState === 'function')
  test('ErrorState is exported', typeof ErrorState === 'function')

  console.log('\n[4] CSS Design Tokens & Mobile Styling')
  const css = readFileSync(resolve(__dirname, '../src/app/globals.css'), 'utf-8')
  test('CSS defines --empty-illustration-size token', css.includes('--empty-illustration-size'))
  test('CSS defines --empty-title-size token', css.includes('--empty-title-size'))
  test('CSS defines --empty-description-size token', css.includes('--empty-description-size'))
  test('CSS defines --empty-content-max-width token', css.includes('--empty-content-max-width'))
  test('CSS defines entrance animation for empty states', css.includes('emptyEntrance'))
  test('CSS defines mobile breakpoint responsiveness for empty states', css.includes('@media (max-width: 640px)') && css.includes('.preone-empty-state'))

  console.log('\n[5] Table & Module Integration')
  const zenTableSrc = readFileSync(resolve(__dirname, '../src/components/preone/ZenTable.tsx'), 'utf-8')
  test('ZenTableEmpty integrates EmptyState with compact presentation', zenTableSrc.includes('<EmptyState') && zenTableSrc.includes('compact'))

  const dataTableSrc = readFileSync(resolve(__dirname, '../src/components/preone/DataTable.tsx'), 'utf-8')
  test('DataTable integrates EmptyState for zero data', dataTableSrc.includes('<EmptyState') && dataTableSrc.includes('emptyAction'))
  test('DataTable suppresses pagination when dataset is empty', dataTableSrc.includes('data && data.length > 0'))

  const studentsSrc = readFileSync(resolve(__dirname, '../src/app/app/students/page.tsx'), 'utf-8')
  test('Students page desktop table uses EmptyState', studentsSrc.includes('<EmptyState') && studentsSrc.includes('students'))

  const admissionsSrc = readFileSync(resolve(__dirname, '../src/app/app/admissions/page.tsx'), 'utf-8')
  test('Admissions page enquiries table uses EmptyState', admissionsSrc.includes('illustration="enquiries"'))
  test('Admissions page waitlist table uses EmptyState', admissionsSrc.includes('illustration="waitinglist"'))
  test('Admissions page classroom placement uses EmptyState', admissionsSrc.includes('illustration="classroom"'))
  test('Admissions page ledger uses EmptyState', admissionsSrc.includes('eyebrow="Admissions Ledger"'))

  console.log('\n===============================================================')
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`)
  console.log('===============================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
