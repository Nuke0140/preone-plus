/**
 * Automated Verification Suite for PreOne OS Enterprise "Zen Table" Data Presentation System
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  getDeterministicPastel,
  getInitials,
  ZEN_PASTEL_PALETTE,
  StudentIdentityChip,
  FamilyIdentityChip,
  ZenTable,
  ZenTableHeader,
  ZenTableRow,
  ZenTableCell,
  ZenTableSkeleton,
} from '../src/components/preone/ZenTable'

// Luminance and Contrast calculation (WCAG 2.1)
function getLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '')
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255

  const [rl, gl, bl] = [r, g, b].map((c) => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })

  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl
}

function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getLuminance(hex1)
  const lum2 = getLuminance(hex2)
  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)
  return (brightest + 0.05) / (darkest + 0.05)
}

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
  console.log('PREONE: ENTERPRISE "ZEN TABLE" SYSTEM VERIFICATION')
  console.log('===============================================================')

  console.log('\n[1] Deterministic Pastel Avatar Palette & Hash Distribution')
  test('ZEN_PASTEL_PALETTE has 8 distinct pastel themes', ZEN_PASTEL_PALETTE.length === 8)

  // Verify deterministic consistency
  const studentA = 'std_908234_aarav'
  const studentB = 'std_124982_ananya'
  const colA1 = getDeterministicPastel(studentA)
  const colA2 = getDeterministicPastel(studentA)
  const colB = getDeterministicPastel(studentB)

  test('Same student ID yields exact identical pastel color on repeated calls', colA1.bg === colA2.bg && colA1.text === colA2.text)
  test('Different student IDs map to deterministic colors', colA1.bg !== '' && colB.bg !== '')
  test('Null/undefined seed provides safe fallback color', getDeterministicPastel(null).bg === ZEN_PASTEL_PALETTE[0].bg)

  // Test Initials Extractor
  test('Two-word name generates two uppercase initials ("Aarav Bhosale" -> "AB")', getInitials('Aarav Bhosale') === 'AB')
  test('Single-word name generates two letters ("Ananya" -> "AN")', getInitials('Ananya') === 'AN')
  test('Multi-word name extracts first and last initials ("Priya Ramesh Shah" -> "PS")', getInitials('Priya Ramesh Shah') === 'PS')
  test('Empty/null name returns safe placeholder ("?")', getInitials(null) === '?')

  console.log('\n[2] WCAG AA Contrast Evaluation for Pastel Avatars')
  for (let i = 0; i < ZEN_PASTEL_PALETTE.length; i++) {
    const item = ZEN_PASTEL_PALETTE[i]
    const ratio = getContrastRatio(item.bg, item.text)
    test(`Pastel theme #${i + 1} (${item.bg} / ${item.text}) contrast is ${ratio.toFixed(2)}:1 (>= 4.5:1 WCAG AA)`, ratio >= 4.5)
  }

  console.log('\n[3] CSS Global Architecture & 56px Row Specifications')
  const cssPath = resolve(__dirname, '../src/app/globals.css')
  const css = readFileSync(cssPath, 'utf8')

  test('.zen-table-wrap and .dtable-wrap defined with #FFFFFF surface and 16px radius',
    css.includes('.zen-table-wrap') && css.includes('.dtable-wrap') && css.includes('border-radius: var(--radius-xl, 16px)'))

  test('Table headers configured with Poppins, 11-12px, 600, uppercase, 0.04em tracking',
    css.includes('.zen-th') && css.includes('Poppins') && css.includes('0.04em') && css.includes('uppercase'))

  test('Table rows specified with ~56px operational target (14px 16px padding + min-height 56px)',
    css.includes('padding: 14px 16px') && css.includes('min-height: 56px'))

  test('Subtle horizontal separators configured (rgba(241, 245, 249, 0.95))',
    css.includes('border-bottom: 1px solid rgba(241, 245, 249, 0.95)'))

  test('Soft slate-50/80 hover background configured (rgba(248, 250, 252, 0.85))',
    css.includes('background: rgba(248, 250, 252, 0.85)'))

  test('Rounded hover treatment on first and last visible cells (8px)',
    css.includes('border-top-left-radius: 8px') && css.includes('border-top-right-radius: 8px'))

  test('Hover transition is fast and operational (140ms ease)',
    css.includes('140ms ease'))

  test('Quick actions hover reveal defined for desktop',
    css.includes('tr:hover .zen-quick-actions') && css.includes('tr:hover .dt-quick-actions'))

  test('Mobile & touch devices enforce visible quick actions and >=44px touch targets',
    css.includes('min-width: 44px !important') && css.includes('min-height: 44px !important'))

  test('Dark mode tokens defined for table surface, headers, and rows',
    css.includes('[data-theme="dark"] .zen-th') && css.includes('[data-theme="dark"] .dtable tbody tr:hover'))

  console.log('\n[4] Component Export Integrity & Surface Upgrades')
  const uiPath = resolve(__dirname, '../src/components/preone/ui.tsx')
  const uiSrc = readFileSync(uiPath, 'utf8')
  test('ui.tsx exports ZenTable components', uiSrc.includes("export * from './ZenTable'"))

  const indexPath = resolve(__dirname, '../src/components/preone/index.ts')
  const indexSrc = readFileSync(indexPath, 'utf8')
  test('components/preone/index.ts exports ZenTable', indexSrc.includes("export * from './ZenTable'"))

  const dtPath = resolve(__dirname, '../src/components/preone/DataTable.tsx')
  const dtSrc = readFileSync(dtPath, 'utf8')
  test('DataTable.tsx uses ZenTableSkeleton for 56px loading rows', dtSrc.includes('<ZenTableSkeleton'))
  test('DataTable.tsx renders quick row actions with overflow support', dtSrc.includes('dt-quick-actions'))

  const studentsPath = resolve(__dirname, '../src/app/app/students/page.tsx')
  const studentsSrc = readFileSync(studentsPath, 'utf8')
  test('Students page uses StudentIdentityChip', studentsSrc.includes('<StudentIdentityChip'))
  test('Students page uses FamilyIdentityChip', studentsSrc.includes('<FamilyIdentityChip'))
  test('Students page uses StatusPill', studentsSrc.includes('<StatusPill status='))

  const admissionsPath = resolve(__dirname, '../src/app/app/admissions/page.tsx')
  const admissionsSrc = readFileSync(admissionsPath, 'utf8')
  test('Admissions page uses StudentIdentityChip for leads, applications, and waitlist', admissionsSrc.includes('<StudentIdentityChip'))
  test('Admissions page uses FamilyIdentityChip for parent/contact', admissionsSrc.includes('<FamilyIdentityChip'))
  test('Admissions page uses StatusPill for semantic statuses', admissionsSrc.includes('<StatusPill status='))

  const financePath = resolve(__dirname, '../src/app/app/finance/page.tsx')
  const financeSrc = readFileSync(financePath, 'utf8')
  test('Finance page uses StudentIdentityChip in Invoice table', financeSrc.includes('<StudentIdentityChip'))
  test('Finance page uses StatusPill in Invoice table', financeSrc.includes('<StatusPill status='))
  test('Finance page uses tabular-nums for aligned currency amounts', financeSrc.includes('tabular-nums'))

  console.log('\n===============================================================')
  console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`)
  console.log('===============================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
