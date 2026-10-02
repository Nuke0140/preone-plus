import fs from 'fs'
import path from 'path'

function getFiles(dir: string): string[] {
  let results: string[] = []
  const list = fs.readdirSync(dir)
  for (const file of list) {
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath))
    } else if (file === 'route.ts') {
      results.push(fullPath)
    }
  }
  return results
}

console.log('===============================================================')
console.log('PREONE AUTHORITATIVE BACKEND ERROR HANDLING & OBSERVABILITY AUDIT')
console.log('===============================================================')

const allRoutes = getFiles('src/app/api')
console.log(`\nFound ${allRoutes.length} API route files under src/app/api.\n`)

let failures = 0

// Test 1: 100% withApi Adoption
console.log('[1] Full Centralized API Route Pipeline (withApi) Adoption:')
const missingWithApi: string[] = []
for (const r of allRoutes) {
  const content = fs.readFileSync(r, 'utf8')
  if (!content.includes('withApi(')) {
    missingWithApi.push(r)
  }
}
if (missingWithApi.length === 0) {
  console.log(`  ✓ 100% compliance: All ${allRoutes.length} route files are wrapped in withApi()`)
} else {
  console.error(`  ✗ Non-compliant: ${missingWithApi.length} routes are missing withApi():`, missingWithApi)
  failures++
}

// Test 2: Zero Route-Level console.* Usages
console.log('\n[2] Zero Route-Level Console Logging (Structured Logger Enforcement):')
const withConsole: string[] = []
for (const r of allRoutes) {
  const content = fs.readFileSync(r, 'utf8')
  if (content.includes('console.log') || content.includes('console.warn') || content.includes('console.error')) {
    withConsole.push(r)
  }
}
if (withConsole.length === 0) {
  console.log(`  ✓ 100% compliance: Zero route files use console.*`)
} else {
  console.error(`  ✗ Non-compliant: ${withConsole.length} routes contain console.*:`, withConsole)
  failures++
}

// Test 3: Zero Route-Level Raw 'throw new Error'
console.log('\n[3] Zero Route-Level Raw Exceptions (PreOneError Taxonomy Enforcement):')
const withRawThrow: string[] = []
for (const r of allRoutes) {
  const content = fs.readFileSync(r, 'utf8')
  if (content.includes('throw new Error(')) {
    withRawThrow.push(r)
  }
}
if (withRawThrow.length === 0) {
  console.log(`  ✓ 100% compliance: Zero route files throw raw Error()`)
} else {
  console.error(`  ✗ Non-compliant: ${withRawThrow.length} routes throw raw Error():`, withRawThrow)
  failures++
}

// Test 4: Verify Core Infrastructure Integrity
console.log('\n[4] Core Platform Error Handling Infrastructure:')
const requiredInfra = [
  'src/lib/errors.ts',
  'src/lib/error-codes.ts',
  'src/lib/error-messages.ts',
  'src/lib/redaction.ts',
  'src/lib/logger.ts',
  'src/lib/with-api.ts',
  'src/lib/api.ts',
  'src/lib/client-api.ts',
  'src/lib/csv-error.ts',
  'src/middleware.ts',
  'src/app/error.tsx',
  'src/app/global-error.tsx',
  'src/app/not-found.tsx',
]
let missingInfra = 0
for (const f of requiredInfra) {
  if (fs.existsSync(f)) {
    console.log(`  ✓ ${f} verified`)
  } else {
    console.error(`  ✗ Missing required infrastructure file: ${f}`)
    missingInfra++
    failures++
  }
}

console.log('\n===============================================================')
if (failures === 0) {
  console.log('AUDIT RESULT: 100% BACKEND ERROR-HANDLING COMPLETE (0 VIOLATIONS)')
  console.log('===============================================================')
  process.exit(0)
} else {
  console.error(`AUDIT RESULT: FAILED WITH ${failures} VIOLATIONS`)
  console.log('===============================================================')
  process.exit(1)
}
