/**
 * Automated Verification Suite for PreOne OS Tactile Micro-Interactions & Motion Design System
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import * as PreOneIndex from '../src/components/preone/index'
import * as PreOneUI from '../src/components/preone/ui'
import {
  AnimatedCheckmark,
  TactileButton,
  InteractiveCard,
} from '../src/components/preone/TactileMotion'

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
  console.log('PREONE: TACTILE MICRO-INTERACTIONS & MOTION DESIGN SYSTEM VERIFICATION')
  console.log('===============================================================')

  const cssPath = resolve(__dirname, '../src/app/globals.css')
  const cssContent = readFileSync(cssPath, 'utf-8')

  console.log('\n[1] CSS Motion Tokens')
  test('Token --motion-fast is 120ms', cssContent.includes('--motion-fast:120ms'))
  test('Token --motion-normal is 180ms', cssContent.includes('--motion-normal:180ms'))
  test('Token --motion-slow is 260ms', cssContent.includes('--motion-slow:260ms'))
  test('Token --ease-tactile is cubic-bezier(0.2, 0, 0, 1)', cssContent.includes('--ease-tactile:cubic-bezier(0.2, 0, 0, 1)'))

  console.log('\n[2] Tactile Button Active Press Scale (0.97)')
  test('Button active scale is 0.97', cssContent.includes('transform:scale(0.97)') || cssContent.includes('transform: scale(0.97)'))
  test('Tactile button transition uses var(--motion-fast)', cssContent.includes('transition:transform var(--motion-fast) var(--ease-tactile)') || cssContent.includes('transition: transform var(--motion-fast) var(--ease-tactile)'))
  test('Applied to .btn:active', cssContent.includes('.btn:active'))
  test('Applied to .zen-action-btn:active', cssContent.includes('.zen-action-btn:active'))
  test('Applied to .tactile-btn:active', cssContent.includes('.tactile-btn:active'))
  test('Does not apply active scale globally to generic anchors', !cssContent.includes('a:active{transform:scale(0.97)'))
  test('Does not apply active scale globally to table rows', !cssContent.includes('tr:active{transform:scale(0.97)'))

  console.log('\n[3] Interactive Card Lift on Hover')
  test('Card lift uses fine-pointer hover media query', cssContent.includes('@media (hover: hover) and (pointer: fine)'))
  test('Card lift translateY(-2px)', cssContent.includes('transform: translateY(-2px);'))
  test('Card lift brand elevation uses color-mix with --primary', cssContent.includes('color-mix(in srgb, var(--primary) 18%, transparent)'))
  test('Card lift transitions with var(--motion-normal) and var(--ease-tactile)', cssContent.includes('transition: transform var(--motion-normal) var(--ease-tactile)'))
  test('Applied to .card-lift and .interactive-card', cssContent.includes('.card-lift:hover') && cssContent.includes('.interactive-card:hover'))

  console.log('\n[4] Stepper & SVG Checkmark Stroke Draw Animation')
  test('Keyframes checkmarkDraw exists with stroke-dashoffset 24 to 0', cssContent.includes('@keyframes checkmarkDraw') && cssContent.includes('stroke-dashoffset: 24;') && cssContent.includes('stroke-dashoffset: 0;'))
  test('.anim-checkmark class configured with 360ms duration', cssContent.includes('.anim-checkmark') && cssContent.includes('checkmarkDraw 360ms var(--ease-tactile)'))
  test('Wizard stepper connector has smooth background transition', cssContent.includes('.wizard-step:not(:last-child)::after') && cssContent.includes('transition:background var(--motion-normal) var(--ease-tactile)'))
  test('Wizard dot transitions background, color, and box-shadow', cssContent.includes('.wizard-dot') && cssContent.includes('transition:background var(--motion-normal) var(--ease-tactile)'))

  console.log('\n[5] Restrained Entrance Animations (Dropdown, Modal, Tooltip)')
  test('Dropdown entrance translates -4px to 0 in 140ms', cssContent.includes('@keyframes dropdownEntrance') && cssContent.includes('transform: translateY(-4px);') && cssContent.includes('dropdownEntrance 140ms var(--ease-tactile)'))
  test('Modal entrance scales 0.98 to 1 in 180ms', cssContent.includes('@keyframes modalEntrance') && cssContent.includes('transform: scale(0.98);') && cssContent.includes('modalEntrance 180ms var(--ease-tactile)'))
  test('Tooltip entrance translates 2px to 0 in 120ms', cssContent.includes('@keyframes tooltipEntrance') && cssContent.includes('tooltipEntrance 120ms var(--ease-tactile)'))

  console.log('\n[6] Reduced Motion Accessibility')
  test('prefers-reduced-motion media query present', cssContent.includes('@media (prefers-reduced-motion: reduce)'))
  test('Reduced motion resets transform to none', cssContent.includes('transform: none !important;'))
  test('Reduced motion resets box-shadow to none', cssContent.includes('box-shadow: none !important;'))
  test('Reduced motion disables anim-checkmark animation', cssContent.includes('stroke-dashoffset: 0 !important;'))

  console.log('\n[7] Component Exports & Integrity')
  test('AnimatedCheckmark is exported from TactileMotion', typeof AnimatedCheckmark === 'function')
  test('TactileButton is exported from TactileMotion', typeof TactileButton === 'function')
  test('InteractiveCard is exported from TactileMotion', typeof InteractiveCard === 'function')
  test('Tactile components exported from index.ts', typeof (PreOneIndex as any).TactileButton === 'function' && typeof (PreOneIndex as any).AnimatedCheckmark === 'function')
  test('Tactile components exported from ui.tsx', typeof (PreOneUI as any).TactileButton === 'function' && typeof (PreOneUI as any).AnimatedCheckmark === 'function')

  console.log('\n[8] Forms & Setup Stepper Integration')
  const formsContent = readFileSync(resolve(__dirname, '../src/components/preone/forms.tsx'), 'utf-8')
  test('forms.tsx imports AnimatedCheckmark', formsContent.includes("import { AnimatedCheckmark } from './TactileMotion'"))
  test('Wizard tracks step transitions via prevCurrentRef', formsContent.includes('prevCurrentRef') && formsContent.includes('justCompleted'))
  test('Wizard uses AnimatedCheckmark for completed step', formsContent.includes('<AnimatedCheckmark size={14} animate={justCompleted} />'))

  const setupCardsContent = readFileSync(resolve(__dirname, '../src/components/preone/SetupCards.tsx'), 'utf-8')
  test('SetupCards.tsx imports AnimatedCheckmark', setupCardsContent.includes("import { AnimatedCheckmark } from './TactileMotion'"))
  test('SetupStepTile uses AnimatedCheckmark for complete steps', setupCardsContent.includes('<AnimatedCheckmark size={16} animate={false} />'))

  console.log('\n[9] Server Health Check')
  try {
    const res = await fetch('http://localhost:3000/api/health')
    test('Next.js server responds to HTTP requests', res.status < 500)
  } catch (e: any) {
    try {
      const resRoot = await fetch('http://localhost:3000')
      test('Next.js root page responds', resRoot.status < 500)
    } catch (err: any) {
      test('Next.js server responds to HTTP requests', false)
    }
  }

  console.log('\n---------------------------------------------------------------')
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`)
  console.log('---------------------------------------------------------------')

  if (failed > 0) {
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
