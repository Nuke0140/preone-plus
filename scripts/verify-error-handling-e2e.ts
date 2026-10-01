/**
 * PreOne Enterprise Error Handling & Observability E2E Test Suite
 * Validates PreOneError taxonomy, trace ID propagation, redaction,
 * Prisma normalization, CSV error contracts, and health metrics.
 */

import { NextRequest } from 'next/server'
import {
  PreOneError,
  errValidation,
  errPermission,
  errNotFound,
  errConflict,
  errBusiness,
  errDeveloper,
  toPreOneError,
  isOperational,
  isDeveloper,
} from '../src/lib/errors'
import { ErrorCodes } from '../src/lib/error-codes'
import { redactSensitive } from '../src/lib/redaction'
import {
  generateTraceId,
  getActiveTraceId,
  traceStorage,
  healthMetrics,
  logger,
} from '../src/lib/logger'
import { withApi } from '../src/lib/with-api'
import { ok, fail, Errors } from '../src/lib/api'
import { sanitizeCsvCell, generateCsvErrorReport, CsvImportError } from '../src/lib/csv-error'

let passed = 0
let failed = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ ${msg}`)
    passed++
  } else {
    console.error(`  ✗ ${msg}`)
    failed++
  }
}

async function runSuite() {
  console.log('===============================================================')
  console.log('PREONE CENTRALIZED ERROR & OBSERVABILITY E2E VERIFICATION')
  console.log('===============================================================\n')

  // -------------------------------------------------------------
  // 1. Error Taxonomy & Factories
  // -------------------------------------------------------------
  console.log('[1] Error Taxonomy & Central Factories')
  const vErr = errValidation('First name required', 'firstName')
  assert(vErr.class === 'OPERATIONAL', 'errValidation is classified as OPERATIONAL')
  assert(vErr.httpStatus === 400, 'errValidation status is 400')
  assert(vErr.field === 'firstName', 'errValidation carries field name')
  assert(isOperational(vErr), 'isOperational(vErr) returns true')

  const pErr = errPermission('Denied')
  assert(pErr.class === 'OPERATIONAL' && pErr.httpStatus === 403, 'errPermission is 403 OPERATIONAL')

  const nfErr = errNotFound('Classroom')
  assert(nfErr.class === 'OPERATIONAL' && nfErr.httpStatus === 404, 'errNotFound is 404 OPERATIONAL')

  const cErr = errConflict('Duplicate employee code', ErrorCodes.CONFLICT_EMPLOYEE_CODE)
  assert(cErr.class === 'OPERATIONAL' && cErr.httpStatus === 409, 'errConflict is 409 OPERATIONAL')

  const bErr = errBusiness(ErrorCodes.BUSINESS_PARENT_LIMIT_EXCEEDED, 'Max 2 parents')
  assert(bErr.class === 'OPERATIONAL' && bErr.httpStatus === 422, 'errBusiness is 422 OPERATIONAL')

  const dErr = errDeveloper('Database connection timeout')
  assert(dErr.class === 'DEVELOPER', 'errDeveloper is classified as DEVELOPER')
  assert(dErr.httpStatus === 500, 'errDeveloper status is 500')
  assert(isDeveloper(dErr), 'isDeveloper(dErr) returns true')
  assert(!dErr.userMessage.includes('timeout'), 'Developer error hides internal crash message from userMessage')

  // -------------------------------------------------------------
  // 2. Sensitive Data & Secret Redaction
  // -------------------------------------------------------------
  console.log('\n[2] PII & Secret Redaction Policy')
  const sensitivePayload = {
    email: 'parent@preschool.com',
    password: 'SuperSecretPassword123',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz',
    token: 'jwt.token.here',
    pickupPin: '4829',
    details: {
      cardNumber: '4111222233334444',
      cvv: '123',
      otp: '998811',
      studentName: 'Aarav Sharma',
    },
  }

  const sanitized = redactSensitive(sensitivePayload)
  assert((sanitized as any).password === '[REDACTED]', 'password is redacted')
  assert((sanitized as any).passwordHash === '[REDACTED]', 'passwordHash is redacted')
  assert((sanitized as any).token === '[REDACTED]', 'token is redacted')
  assert((sanitized as any).pickupPin === '[REDACTED]', 'pickupPin is redacted')
  assert((sanitized as any).details.cardNumber === '[REDACTED]', 'nested cardNumber is redacted')
  assert((sanitized as any).details.cvv === '[REDACTED]', 'nested cvv is redacted')
  assert((sanitized as any).details.otp === '[REDACTED]', 'nested otp is redacted')
  assert((sanitized as any).details.studentName === 'Aarav Sharma', 'non-sensitive fields preserved')

  // -------------------------------------------------------------
  // 3. Prisma & Exception Normalization
  // -------------------------------------------------------------
  console.log('\n[3] Unknown Error & Prisma Normalization')
  const prismaUniqueError = {
    code: 'P2002',
    meta: { target: ['email'] },
    message: 'Unique constraint failed on the fields: (`email`)',
  }
  const normPrismaUnique = toPreOneError(prismaUniqueError, 'users')
  assert(normPrismaUnique.class === 'OPERATIONAL', 'P2002 is normalized to OPERATIONAL')
  assert(normPrismaUnique.httpStatus === 409, 'P2002 is mapped to 409 Conflict')
  assert(normPrismaUnique.code === ErrorCodes.CONFLICT_DUPLICATE_RECORD, 'P2002 code is CONFLICT_001')
  assert(!normPrismaUnique.userMessage.includes('(`email`)'), 'Prisma internal syntax stripped from userMessage')

  const prismaNotFoundError = {
    code: 'P2025',
    message: 'An operation failed because it depends on one or more records that were required but not found',
  }
  const normPrismaNotFound = toPreOneError(prismaNotFoundError, 'students')
  assert(normPrismaNotFound.class === 'OPERATIONAL', 'P2025 normalized to OPERATIONAL')
  assert(normPrismaNotFound.httpStatus === 404, 'P2025 mapped to 404 Not Found')

  const rawRuntimeCrash = new TypeError('Cannot read properties of undefined (reading "findFirst")')
  const normRuntimeCrash = toPreOneError(rawRuntimeCrash, 'attendance')
  assert(normRuntimeCrash.class === 'DEVELOPER', 'Unhandled TypeError normalized to DEVELOPER')
  assert(normRuntimeCrash.httpStatus === 500, 'Unhandled TypeError mapped to 500')
  assert(normRuntimeCrash.code === ErrorCodes.SYSTEM_INTERNAL_ERROR, 'Code is SYSTEM_001')

  // -------------------------------------------------------------
  // 4. Trace ID Propagation & withApi Boundary
  // -------------------------------------------------------------
  console.log('\n[4] Trace ID Propagation & withApi Pipeline')
  const testTraceId = 'PRE-99AA88BB'

  const mockApiHandler = withApi(async (req, ctx) => {
    assert(ctx.traceId === testTraceId, 'Context receives exact incoming trace ID')
    assert(ctx.module === 'students', 'Module derived dynamically from route path')
    return ok({ message: 'Success' })
  })

  const req = new NextRequest('http://localhost:3000/api/v1/students/list', {
    headers: { 'x-trace-id': testTraceId },
  })

  const res = await mockApiHandler(req)
  assert(res.headers.get('X-Trace-Id') === testTraceId, 'Response header X-Trace-Id matches test trace ID')

  const jsonBody = await res.json()
  assert(jsonBody.success === true, 'Response body success is true')
  assert(jsonBody.traceId === testTraceId, 'Response body traceId matches header and request')

  // Test error handling in withApi
  const failingApiHandler = withApi(async () => {
    throw errBusiness('BUSINESS_FEE_ALREADY_PAID_001', 'Invoice has already been settled')
  }, { module: 'fees' })

  const failReq = new NextRequest('http://localhost:3000/api/v1/fees/invoices/pay', {
    headers: { 'x-trace-id': 'PRE-11223344' },
  })

  const failRes = await failingApiHandler(failReq)
  assert(failRes.status === 422, 'Operational error returned status 422')
  assert(failRes.headers.get('X-Trace-Id') === 'PRE-11223344', 'Error response header carries X-Trace-Id')

  const failJson = await failRes.json()
  assert(failJson.success === false, 'Error response success is false')
  assert(failJson.error.code === 'BUSINESS_FEE_ALREADY_PAID_001', 'Error code preserved in envelope')
  assert(failJson.traceId === 'PRE-11223344', 'Error response traceId matches request')

  // Test uncaught developer exception in withApi
  const crashingApiHandler = withApi(async () => {
    throw new Error('Database server suddenly vanished')
  }, { module: 'database' })

  const crashReq = new NextRequest('http://localhost:3000/api/v1/reports/export', {
    headers: { 'x-trace-id': 'PRE-55667788' },
  })

  const crashRes = await crashingApiHandler(crashReq)
  assert(crashRes.status === 500, 'Developer exception returned status 500')
  const crashJson = await crashRes.json()
  assert(crashJson.error.code === ErrorCodes.SYSTEM_INTERNAL_ERROR, 'Developer exception mapped to SYSTEM_001')
  assert(crashJson.error.stack === undefined, 'Developer stack trace is NEVER exposed to client')
  assert(crashJson.traceId === 'PRE-55667788', 'Developer exception carries same trace ID')

  // -------------------------------------------------------------
  // 5. CSV Error Standard & Formula Injection Protection
  // -------------------------------------------------------------
  console.log('\n[5] CSV Error Contract & Injection Defense')
  assert(sanitizeCsvCell('=SUM(A1:A10)') === "'=SUM(A1:A10)", 'Formula "=" neutralized')
  assert(sanitizeCsvCell('+cmd|') === "'+cmd|", 'Formula "+" neutralized')
  assert(sanitizeCsvCell('-5+2') === "'-5+2", 'Formula "-" neutralized')
  assert(sanitizeCsvCell('@test') === "'@test", 'Formula "@" neutralized')
  assert(sanitizeCsvCell('Normal Text') === 'Normal Text', 'Safe text unaltered')

  const sampleCsvErrors: CsvImportError[] = [
    {
      traceId: 'PRE-77889900',
      rowNumber: 12,
      identifier: 'ADM-0012',
      field: 'dob',
      code: ErrorCodes.VALIDATION_DATE,
      class: 'OPERATIONAL',
      message: 'Invalid date format',
      severity: 'ERROR',
      currentValue: 'not-a-date',
    },
  ]
  const errorReport = generateCsvErrorReport(sampleCsvErrors, 'test_errors.csv')
  assert(errorReport.csvContent.includes('PRE-77889900'), 'Report includes traceId')
  assert(errorReport.csvContent.includes('ADM-0012'), 'Report includes row identifier')
  assert(errorReport.csvContent.includes('VALIDATION_DATE_001'), 'Report includes error code')

  // -------------------------------------------------------------
  // 6. Health & Observability Metrics
  // -------------------------------------------------------------
  console.log('\n[6] Observability & Health Metrics Aggregation')
  healthMetrics.recordError('VALIDATION_EMAIL_001', 'users', 'OPERATIONAL')
  healthMetrics.recordError('BUSINESS_CLASSROOM_FULL_001', 'academics', 'OPERATIONAL')
  healthMetrics.recordError('SYSTEM_DB_001', 'db', 'DEVELOPER')
  healthMetrics.recordRequestDuration(1800, 1500)

  const metricsSnapshot = healthMetrics.getSnapshot()
  assert(metricsSnapshot.operationalErrorCount24h >= 2, 'Operational error counter updated')
  assert(metricsSnapshot.developerErrorCount24h >= 1, 'Developer error counter updated')
  assert(metricsSnapshot.slowRequestCount >= 1, 'Slow request counter updated')
  assert(Array.isArray(metricsSnapshot.topErrorCodes), 'Top error codes aggregated')
  assert(Array.isArray(metricsSnapshot.topModules), 'Top error modules aggregated')

  // -------------------------------------------------------------
  // 7. Backward Compatibility Shim
  // -------------------------------------------------------------
  console.log('\n[7] Backward Compatibility Shim (ok / fail / Errors.*)')
  const legacyOk = ok({ foo: 'bar' })
  assert(legacyOk.headers.get('X-Trace-Id')?.startsWith('PRE-') === true, 'ok() sets X-Trace-Id header')

  const legacyFail = fail('LEGACY_001', 'Legacy failure', 400)
  assert(legacyFail.headers.get('X-Trace-Id')?.startsWith('PRE-') === true, 'fail() sets X-Trace-Id header')

  const legacyErr = Errors.forbidden('Action forbidden')
  assert(legacyErr.status === 403, 'Errors.forbidden() works with status 403')

  console.log('\n===============================================================')
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
  console.log('===============================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runSuite().catch((err) => {
  console.error('Test runner fatal error:', err)
  process.exit(1)
})
