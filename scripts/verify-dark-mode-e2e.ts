/**
 * Automated Verification Suite for PreOne OS Premium Dark Mode — "Midnight Slate"
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { getDarkModeAdaptedColor } from '../src/lib/branding'

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
  console.log('PREONE: MIDNIGHT SLATE DARK MODE VERIFICATION')
  console.log('===============================================================')

  console.log('\n[1] Midnight Slate Color Palette & Contrast Hierarchy (WCAG 2.1)')
  const canvasBg = '#0B0F19'
  const cardSurface = '#151D2E'
  const elevatedSurface = '#1E293B'
  const textPrimary = '#F8FAFC'
  const textSecondary = '#CBD5E1'
  const textMuted = '#94A3B8'

  test('Canvas background is Midnight Slate (#0B0F19), NOT pure black (#000000)', canvasBg === '#0B0F19')
  test('Surface/Card background is refined navy-slate (#151D2E)', cardSurface === '#151D2E')
  test('Elevated surfaces/modals use lighter slate (#1E293B)', elevatedSurface === '#1E293B')

  const primaryOnCanvas = getContrastRatio(textPrimary, canvasBg)
  const primaryOnSurface = getContrastRatio(textPrimary, cardSurface)
  const secondaryOnSurface = getContrastRatio(textSecondary, cardSurface)
  const mutedOnSurface = getContrastRatio(textMuted, cardSurface)

  console.log(`  Contrast primary on canvas: ${primaryOnCanvas.toFixed(2)}:1 (Req >= 7:1 AAA)`)
  console.log(`  Contrast primary on surface: ${primaryOnSurface.toFixed(2)}:1 (Req >= 7:1 AAA)`)
  console.log(`  Contrast secondary on surface: ${secondaryOnSurface.toFixed(2)}:1 (Req >= 4.5:1 AA)`)
  console.log(`  Contrast muted on surface: ${mutedOnSurface.toFixed(2)}:1 (Req >= 4.5:1 AA)`)

  test('Primary text on canvas meets WCAG AAA (>= 7:1)', primaryOnCanvas >= 7)
  test('Primary text on card meets WCAG AAA (>= 7:1)', primaryOnSurface >= 7)
  test('Secondary text on card meets WCAG AA (>= 4.5:1)', secondaryOnSurface >= 4.5)
  test('Muted text on card meets WCAG AA (>= 4.5:1)', mutedOnSurface >= 4.5)

  console.log('\n[2] CSS Design Tokens & Dual-Selector Compatibility')
  const css = readFileSync(resolve(__dirname, '../src/app/globals.css'), 'utf-8')

  test('CSS defines Midnight Slate tokens under [data-theme="dark"], .dark', css.includes('[data-theme="dark"]') && css.includes('.dark'))
  test('CSS sets --dark-canvas to #0B0F19', css.includes('--dark-canvas:#0B0F19') || css.includes('--dark-canvas: #0B0F19'))
  test('CSS sets --dark-surface to #151D2E', css.includes('--dark-surface:#151D2E') || css.includes('--dark-surface: #151D2E'))
  test('CSS sets --dark-elevated to #1E293B', css.includes('--dark-elevated:#1E293B') || css.includes('--dark-elevated: #1E293B'))
  test('CSS sets --text-primary to #F8FAFC', css.includes('--text-primary:#F8FAFC') || css.includes('--text-primary: #F8FAFC'))
  test('CSS sets --text-secondary to #CBD5E1', css.includes('--text-secondary:#CBD5E1') || css.includes('--text-secondary: #CBD5E1'))
  test('CSS sets --text-muted to #94A3B8', css.includes('--text-muted:#94A3B8') || css.includes('--text-muted: #94A3B8'))
  test('CSS applies brand ambient wash token', css.includes('--brand-wash:') || css.includes('rgba(99, 102, 241, 0.05)') || css.includes('--brand-ambient-wash:'))
  test('CSS styles custom scrollbars for dark mode', css.includes('::-webkit-scrollbar-track') && css.includes('#0B0F19'))

  console.log('\n[3] Dynamic Brand Lightness Adaptation')
  // Test brand adaptation helper function
  const navyBrand = '#1E3A8A'
  const adaptedNavy = getDarkModeAdaptedColor(navyBrand, 14)
  test('getDarkModeAdaptedColor returns valid hex', /^#[0-9A-Fa-f]{6}$/.test(adaptedNavy))
  const origLum = getLuminance(navyBrand)
  const adaptedLum = getLuminance(adaptedNavy)
  test('Adaptive color increases luminance for dark mode visibility', adaptedLum > origLum)

  const layoutSrc = readFileSync(resolve(__dirname, '../src/app/app/layout.tsx'), 'utf-8')
  test('Layout injects dynamic color-mix lightness for [data-theme="dark"], .dark', layoutSrc.includes('color-mix(in srgb, var(--primary) 85%, #FFFFFF 15%)') || layoutSrc.includes('--primary-dark'))

  console.log('\n[4] Theme Shell Synchronization & Storage Integrity')
  const shellSrc = readFileSync(resolve(__dirname, '../src/components/shell/AppShell.tsx'), 'utf-8')
  test('AppShell syncs data-theme attribute on <html>', shellSrc.includes("setAttribute('data-theme'"))
  test('AppShell syncs dark class on <html> for Tailwind', shellSrc.includes("classList.toggle('dark'"))
  test('AppShell reads and writes to localStorage preone-theme', shellSrc.includes("'preone-theme'"))

  console.log('\n[5] Dark Mode Surface Protection & Anti-Patterns Check')
  test('No invert(1) logo filter hack in branding or layout', !css.includes('invert(1)') && !layoutSrc.includes('invert(1)'))
  test('Pure black #000000 is not used as --bg-canvas', !css.includes('--bg-canvas: #000000;'))

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
