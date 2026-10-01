/**
 * Automated Verification Suite for PreOne OS Global Dual-Tone Semantic Status Pills
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { STATUS_SEMANTIC_MAP, STATUS_BADGE } from '../src/components/preone/ui'

// Relative luminance calculator (WCAG 2.1)
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
  console.log('PREONE: DUAL-TONE SEMANTIC STATUS PILLS VERIFICATION')
  console.log('===============================================================')

  console.log('\n[1] Semantic Status Mapping & Exhaustive Domain Coverage')
  test('STATUS_SEMANTIC_MAP is defined with status configs', Object.keys(STATUS_SEMANTIC_MAP).length > 30)
  test('STATUS_BADGE backwards compatibility alias matches map length', Object.keys(STATUS_BADGE).length === Object.keys(STATUS_SEMANTIC_MAP).length)
  
  // Specific domain validations
  test('ACTIVE maps to success with dot', STATUS_SEMANTIC_MAP.ACTIVE.variant === 'success' && STATUS_SEMANTIC_MAP.ACTIVE.dot === true)
  test('PENDING maps to pending with pulsing dot', STATUS_SEMANTIC_MAP.PENDING.variant === 'pending' && STATUS_SEMANTIC_MAP.PENDING.pulse === true)
  test('UNDER_REVIEW maps to pending with pulsing dot', STATUS_SEMANTIC_MAP.UNDER_REVIEW.variant === 'pending' && STATUS_SEMANTIC_MAP.UNDER_REVIEW.pulse === true)
  test('WAITLISTED maps to waiting with violet variant', STATUS_SEMANTIC_MAP.WAITLISTED.variant === 'waiting' && STATUS_SEMANTIC_MAP.WAITLISTED.cls === 'status-pill-waiting')
  test('OVERDUE maps to urgent with dot', STATUS_SEMANTIC_MAP.OVERDUE.variant === 'urgent' && STATUS_SEMANTIC_MAP.OVERDUE.dot === true)
  test('REJECTED maps to urgent with dot', STATUS_SEMANTIC_MAP.REJECTED.variant === 'urgent' && STATUS_SEMANTIC_MAP.REJECTED.dot === true)
  test('ABSENT maps to urgent with dot', STATUS_SEMANTIC_MAP.ABSENT.variant === 'urgent' && STATUS_SEMANTIC_MAP.ABSENT.dot === true)
  test('DRAFT maps to neutral', STATUS_SEMANTIC_MAP.DRAFT.variant === 'neutral')
  test('COMPLETE maps to success', STATUS_SEMANTIC_MAP.COMPLETE.variant === 'success')

  console.log('\n[2] WCAG Contrast Accessibility for Light Dual-Tone Colors')
  // Colors specified in design system
  const colorPairs = [
    { name: 'SUCCESS (emerald-50 bg #ECFDF5 / emerald-700 text #047857)', bg: '#ECFDF5', text: '#047857' },
    { name: 'PENDING (amber-50 bg #FFFBEB / amber-700 text #B45309)', bg: '#FFFBEB', text: '#B45309' },
    { name: 'WAITING (violet-50 bg #F5F3FF / violet-700 text #6D28D9)', bg: '#F5F3FF', text: '#6D28D9' },
    { name: 'URGENT (rose-50 bg #FFF1F2 / rose-700 text #BE123C)', bg: '#FFF1F2', text: '#BE123C' },
    { name: 'WARNING (orange-50 bg #FFF7ED / orange-700 text #C2410C)', bg: '#FFF7ED', text: '#C2410C' },
    { name: 'INFO (blue-50 bg #EFF6FF / blue-700 text #1D4ED8)', bg: '#EFF6FF', text: '#1D4ED8' },
    { name: 'NEUTRAL (slate-50 bg #F8FAFC / slate-600 text #475569)', bg: '#F8FAFC', text: '#475569' },
    { name: 'PINK (pink-50 bg #FDF2F8 / pink-700 text #BE185D)', bg: '#FDF2F8', text: '#BE185D' },
  ]

  for (const pair of colorPairs) {
    const ratio = getContrastRatio(pair.bg, pair.text)
    // WCAG AA requires 4.5:1 for normal text (or 3.0:1 for large / bold)
    test(`${pair.name} contrast ratio is ${ratio.toFixed(2)}:1 (>= 4.5:1 WCAG AA)`, ratio >= 4.5)
  }

  console.log('\n[3] CSS Global Architecture & Micro-Interactions')
  const cssPath = resolve(__dirname, '../src/app/globals.css')
  const css = readFileSync(cssPath, 'utf8')

  test('.status-pill selector defined', css.includes('.status-pill'))
  test('.status-dot selector defined', css.includes('.status-dot'))
  test('.status-dot-pulse keyframe animation defined', css.includes('@keyframes statusDotPulse'))
  test('Dot animation scales and fades subtley (not whole pill)', css.includes('transform: scale(1.24)') && css.includes('opacity: 0.60'))
  test('.status-pill-urgent has calm hover micro-interaction', css.includes('.status-pill-urgent:hover') && css.includes('translateX(1.5px)'))
  test('Prefers-reduced-motion disables pulse and transform', css.includes('@media (prefers-reduced-motion: reduce)') && css.includes('.status-dot-pulse {') && css.includes('animation: none !important'))
  test('Dark mode tokens defined for semantic status pills', css.includes('[data-theme="dark"] .status-pill-success') && css.includes('[data-theme="dark"] .status-pill-urgent'))
  test('Upgraded backward-compatible .badge aliases present', css.includes('.status-pill,') && css.includes('.badge {') && css.includes('.b-success {'))

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
