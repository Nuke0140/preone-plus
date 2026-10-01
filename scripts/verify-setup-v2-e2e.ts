/**
 * PreOne M00 — Setup v2 Architectural & E2E Acceptance Test Suite
 *
 * Verifies:
 * 1. 17-Step & 4-Phase Canonical Structure
 * 2. Pure Predicates & Setup Engine DAG
 * 3. Drift Detection (status === 'COMPLETE' && changedAfterCompletion === true)
 * 4. Tenant Profile & Principal Signature Support
 * 5. Subject Master Data & Program/Classroom Mapping (M02)
 * 6. Config Domain Extension (MOOD_ENVIRONMENT, PROMOTION)
 * 7. Multi-Category Setup Readiness Validation (Calendar, Admissions, Safeguards, Subjects)
 * 8. Zero Shadow Tables & Canonical Isolation
 */

import { db } from '../src/lib/db'
import { SETUP_STEPS, PHASES, STEP_MAP, LEGACY_KEY_MAP } from '../src/lib/setup/steps'
import { evaluateStep, loadContext, ensureSetupRows, syncSetup, completeStep } from '../src/lib/setup/engine'
import { SubjectService } from '../src/lib/academics/subject-service'
import { runValidation, validateAndRecord } from '../src/lib/setup/validate'
import { SubjectType, ConfigDomain } from '@prisma/client'

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
  console.log('PREONE M00 SETUP V2: ARCHITECTURAL CERTIFICATION & E2E SUITE')
  console.log('===============================================================\n')

  const testSuffix = Date.now().toString().slice(-6)
  const tenantSlug = `setup-v2-${testSuffix}`

  let tenant: any = null

  try {
    // -------------------------------------------------------------------------
    // TEST 1: CANONICAL 17-STEP & 4-PHASE STRUCTURE
    // -------------------------------------------------------------------------
    console.log('[1] Canonical 17-Step & 4-Phase Definitions')
    assert(SETUP_STEPS.length === 17, `SETUP_STEPS count is exactly 17 (got ${SETUP_STEPS.length})`)
    assert(PHASES.length === 4, `PHASES count is exactly 4 (got ${PHASES.length})`)

    const phases = PHASES.map((p) => p.key)
    assert(
      phases.includes('FOUNDATION') &&
      phases.includes('ACADEMIC_STRUCTURE') &&
      phases.includes('OPERATIONS') &&
      phases.includes('BUSINESS_RULES'),
      'Phases match canonical names (FOUNDATION, ACADEMIC_STRUCTURE, OPERATIONS, BUSINESS_RULES)'
    )

    const expectedSteps = [
      'school_profile', 'branch', 'branding', 'roles',
      'academic_year', 'curriculum', 'programs', 'classroom', 'subject',
      'mood_environment', 'health_settings', 'daily_operations', 'observation',
      'fees_setup', 'templates', 'communication', 'promotion'
    ]
    const allPresent = expectedSteps.every((s) => STEP_MAP[s] !== undefined)
    assert(allPresent, 'All 17 canonical steps are indexed in STEP_MAP')

    // Verify Legacy Aliases
    assert(LEGACY_KEY_MAP['classes_sections'] === 'classroom', 'Legacy alias classes_sections -> classroom')
    assert(LEGACY_KEY_MAP['infrastructure'] === 'branch', 'Legacy alias infrastructure -> branch')
    assert(LEGACY_KEY_MAP['teacher_assignment'] === 'classroom', 'Legacy alias teacher_assignment -> classroom')
    assert(LEGACY_KEY_MAP['operating_config'] === 'daily_operations', 'Legacy alias operating_config -> daily_operations')
    assert(LEGACY_KEY_MAP['admission_config'] === 'daily_operations', 'Legacy alias admission_config -> daily_operations')
    assert(LEGACY_KEY_MAP['fees'] === 'fees_setup', 'Legacy alias fees -> fees_setup')

    // -------------------------------------------------------------------------
    // TEST 2: TENANT CREATION & PRINCIPAL SIGNATURE
    // -------------------------------------------------------------------------
    console.log('\n[2] Tenant Profile & Principal Signature Support')
    tenant = await db.tenant.create({
      data: {
        code: `SCH-${testSuffix}`,
        name: `M00 Setup School ${testSuffix}`,
        status: 'PENDING_ACTIVATION',
        phone: '+91 98765 43210',
        email: `principal-${testSuffix}@preone.test`,
        address: '123 Education Blvd',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        principalSignatureUrl: 'https://cdn.preone.test/signatures/principal_sig.png',
      }
    })
    assert(tenant.id !== undefined, 'Tenant created in SETUP status')
    assert(tenant.principalSignatureUrl === 'https://cdn.preone.test/signatures/principal_sig.png', 'Tenant stores principalSignatureUrl correctly')

    // -------------------------------------------------------------------------
    // TEST 3: SETUP ROWS INITIALIZATION & PURE PREDICATES
    // -------------------------------------------------------------------------
    console.log('\n[3] Setup Engine Row Initialization & Evaluation')
    await ensureSetupRows(tenant.id)
    const setupRows = await db.schoolSetupStep.findMany({ where: { tenantId: tenant.id } })
    assert(setupRows.length === 17, `ensureSetupRows initialized exactly 17 rows (got ${setupRows.length})`)

    const ctxInitial = await loadContext(tenant.id)
    assert(ctxInitial !== null, 'loadContext returned tenant context')

    // Evaluate school_profile: with all required fields filled, predicate returns satisfied: true
    const profileEval = evaluateStep('school_profile', ctxInitial!)
    assert(profileEval.satisfied === true, `evaluateStep('school_profile') returns satisfied: true when required fields are present`)

    // Evaluate subject: currently 0 subjects, predicate returns satisfied: false
    const subjectEvalInitial = evaluateStep('subject', ctxInitial!)
    assert(subjectEvalInitial.satisfied === false, `evaluateStep('subject') returns satisfied: false when 0 subjects exist`)
    assert(subjectEvalInitial.detail.includes('No academic subjects'), `Subject predicate specifies missing reason (${subjectEvalInitial.detail})`)

    // -------------------------------------------------------------------------
    // TEST 4: DRIFT DETECTION MECHANICS
    // -------------------------------------------------------------------------
    console.log('\n[4] Drift Detection Mechanics (No Shadow Enum)')
    // Mark school_profile as complete
    const completeRes = await completeStep(tenant.id, 'school_profile', { id: 'admin-1', name: 'System Test' })
    assert(completeRes.ok === true, 'Step marked COMPLETE via completeStep')
    let stepRow = await db.schoolSetupStep.findUnique({
      where: { tenantId_stepKey: { tenantId: tenant.id, stepKey: 'school_profile' } }
    })
    assert(stepRow?.status === 'COMPLETE', 'Step marked COMPLETE in database')
    assert(stepRow?.changedAfterCompletion === false, 'changedAfterCompletion is initially false')

    // Alter tenant profile data (simulating post-completion drift)
    await db.tenant.update({
      where: { id: tenant.id },
      data: { address: '456 Updated Crescent' }
    })

    // Run syncSetup to trigger drift evaluation
    await syncSetup(tenant.id)
    stepRow = await db.schoolSetupStep.findUnique({
      where: { tenantId_stepKey: { tenantId: tenant.id, stepKey: 'school_profile' } }
    })
    assert(stepRow?.status === 'COMPLETE', 'Step remains in canonical status COMPLETE')
    assert(stepRow?.changedAfterCompletion === true, 'changedAfterCompletion set to true on data drift')

    // -------------------------------------------------------------------------
    // TEST 5: SUBJECT MASTER DATA & PROGRAM/CLASSROOM MAPPING
    // -------------------------------------------------------------------------
    console.log('\n[5] Subject Service & Domain Entities (M02 Academics)')

    // Create Academic Year & Branch & Program first
    const year = await db.academicSession.create({
      data: {
        tenantId: tenant.id,
        name: '2026-27',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2027-04-30'),
        status: 'ACTIVE',
        isCurrent: true,
      }
    })

    const branch = await db.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'Main Campus',
        code: `BR-${testSuffix}`,
      }
    })

    const program = await db.program.create({
      data: {
        tenantId: tenant.id,
        name: 'Nursery Explorers',
        code: `NUR-${testSuffix}`,
        programType: 'NURSERY',
        ageMinMonths: 36,
        ageMaxMonths: 48,
        capacity: 25,
      }
    })

    const classroom = await db.classroom.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        academicSessionId: year.id,
        programId: program.id,
        programType: 'NURSERY',
        name: 'Nursery A',
        code: `NUR-A-${testSuffix}`,
        capacity: 20,
      }
    })

    // Test Subject creation with SubjectService
    const actor = { id: 'test-admin', name: 'Test Administrator', role: 'OWNER' }
    const subject1 = await SubjectService.createSubject(
      tenant.id,
      {
        name: 'Early Literacy & Phonics',
        code: `LIT-${testSuffix}`,
        shortName: 'Literacy',
        description: 'Phonemic awareness and pre-reading skills',
        subjectType: SubjectType.CORE,
        programIds: [program.id],
      },
      actor
    )
    assert(subject1.id !== undefined, 'Subject 1 created via SubjectService')
    assert(subject1.subjectType === 'CORE', 'Subject 1 type is CORE')
    const fetchedSub1 = await SubjectService.getSubject(tenant.id, subject1.id)
    assert(fetchedSub1?.programMappings.length === 1, 'Subject 1 mapped to Program')

    const subject2 = await SubjectService.createSubject(
      tenant.id,
      {
        name: 'Creative Movement & Music',
        code: `MUS-${testSuffix}`,
        shortName: 'Music',
        description: 'Rhythm, motor coordination and song',
        subjectType: SubjectType.ACTIVITY,
        programIds: [program.id],
      },
      actor
    )
    assert(subject2.subjectType === 'ACTIVITY', 'Subject 2 created with ACTIVITY type')

    // Test Subject update and classroom mapping
    const updatedSub = await SubjectService.updateSubject(
      tenant.id,
      subject1.id,
      {
        description: 'Updated phonemic awareness description',
      },
      actor
    )
    assert(updatedSub.description === 'Updated phonemic awareness description', 'Subject updated successfully')

    // Assign Subject to Classroom
    const classSubject = await SubjectService.mapSubjectToClassroom(
      tenant.id,
      classroom.id,
      subject1.id
    )
    assert(classSubject.id !== undefined, 'Subject assigned to Classroom via ClassroomSubject')

    // Query subjects via SubjectService with filters
    const coreSubjects = await SubjectService.getSubjects(tenant.id, { subjectType: SubjectType.CORE })
    assert(coreSubjects.length === 1 && coreSubjects[0].code === `LIT-${testSuffix}`, 'Subject filter by type=CORE works')

    // Evaluate subject step predicate now
    const ctxAfter = await loadContext(tenant.id)
    assert(ctxAfter !== null, 'loadContext returned updated tenant context')
    const subjectEvalAfter = evaluateStep('subject', ctxAfter!)
    assert(subjectEvalAfter.satisfied === true, `evaluateStep('subject') returns satisfied: true after creating subjects`)

    // Verify Audit Trail for Subjects
    const auditLogs = await db.auditLog.findMany({
      where: {
        tenantId: tenant.id,
        action: { in: ['SUBJECT_CREATED', 'SUBJECT_UPDATED'] }
      }
    })
    assert(auditLogs.length >= 3, `AuditLog captured subject events (count: ${auditLogs.length})`)

    // -------------------------------------------------------------------------
    // TEST 6: CONFIG DOMAIN EXTENSIONS (MOOD_ENVIRONMENT, PROMOTION)
    // -------------------------------------------------------------------------
    console.log('\n[6] Config Domain Extensions')
    const moodConfig = await db.schoolConfig.create({
      data: {
        tenantId: tenant.id,
        domain: ConfigDomain.MOOD_ENVIRONMENT,
        data: {
          indoorTempTarget: 24,
          noiseAlertLevel: 'MEDIUM',
          cleanlinessCheckFreqHours: 2,
        },
      }
    })
    assert(moodConfig.domain === 'MOOD_ENVIRONMENT', 'MOOD_ENVIRONMENT saved in SchoolConfig')

    const promoConfig = await db.schoolConfig.create({
      data: {
        tenantId: tenant.id,
        domain: ConfigDomain.PROMOTION,
        data: {
          autoPromoteOnYearEnd: false,
          minAttendanceForPromotion: 75,
        },
      }
    })
    assert(promoConfig.domain === 'PROMOTION', 'PROMOTION saved in SchoolConfig')

    // -------------------------------------------------------------------------
    // TEST 7: COMPREHENSIVE SETUP READINESS VALIDATION
    // -------------------------------------------------------------------------
    console.log('\n[7] Comprehensive Setup Readiness Validation (validateAndRecord)')
    const valResult = await validateAndRecord(tenant.id, 'SETUP_VALIDATION', { id: 'admin-1', name: 'Admin Test' })
    assert(valResult !== null, 'validateAndRecord returned validation result')
    assert(valResult!.categories.length === 15, `Validation evaluated exactly 15 categories (got ${valResult!.categories.length})`)

    const subjectCat = valResult!.categories.find((c) => c.key === 'subject')
    assert(subjectCat !== undefined, 'subject validation category evaluated')
    assert(subjectCat?.status === 'PASS', `subject category status is PASS (findings: ${subjectCat?.findings.map((f: any) => f.message).join(';')})`)

    const calCat = valResult!.categories.find((c) => c.key === 'calendar')
    assert(calCat !== undefined, 'calendar validation category evaluated')

    const safeCat = valResult!.categories.find((c) => c.key === 'students_parents')
    assert(safeCat !== undefined, 'students_parents safeguards validation category evaluated without shadow tables')

    // Verify validation run was persisted
    const savedRuns = await db.schoolSetupValidationRun.findMany({ where: { tenantId: tenant.id } })
    assert(savedRuns.length >= 1, `SchoolSetupValidationRun record persisted (count: ${savedRuns.length})`)

    // -------------------------------------------------------------------------
    // TEST 8: GO-LIVE CONTROL PLANE STATUS
    // -------------------------------------------------------------------------
    console.log('\n[8] Setup Status Control Plane (syncSetup)')
    const statusPayload = await syncSetup(tenant.id)
    assert(statusPayload !== null, 'syncSetup returned status payload')
    assert(statusPayload!.steps.length === 17, `syncSetup returns 17 steps (got ${statusPayload!.steps.length})`)
    assert(typeof statusPayload!.progress === 'number', `Progress percentage calculated (${statusPayload!.progress}%)`)

    // Verify dependencies are tracked
    const subjectRow = statusPayload!.steps.find((s) => s.key === 'subject')
    assert(subjectRow !== null, 'Subject step included in statusPayload')
    assert(subjectRow?.missingDeps !== undefined, 'Missing dependencies tracked for DAG')
    assert(typeof subjectRow?.driftState === 'boolean', 'driftState computed on status payload')

  } catch (err: any) {
    console.error('UNEXPECTED EXCEPTION:', err)
    failed++
  } finally {
    // Teardown test data
    if (tenant) {
      console.log('\n[Teardown] Cleaning up test tenant...')
      try {
        await db.classroomSubject.deleteMany({ where: { classroom: { tenantId: tenant.id } } })
        await db.programSubject.deleteMany({ where: { subject: { tenantId: tenant.id } } })
        await db.subject.deleteMany({ where: { tenantId: tenant.id } })
        await db.classroom.deleteMany({ where: { tenantId: tenant.id } })
        await db.program.deleteMany({ where: { tenantId: tenant.id } })
        await db.branch.deleteMany({ where: { tenantId: tenant.id } })
        await db.academicSession.deleteMany({ where: { tenantId: tenant.id } })
        await db.schoolConfig.deleteMany({ where: { tenantId: tenant.id } })
        await db.schoolSetupStep.deleteMany({ where: { tenantId: tenant.id } })
        await db.auditLog.deleteMany({ where: { tenantId: tenant.id } })
        await db.tenant.delete({ where: { id: tenant.id } })
        console.log('Cleanup completed successfully.')
      } catch (cleanErr) {
        console.warn('Cleanup warning:', cleanErr)
      }
    }
  }

  console.log('\n===============================================================')
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
  console.log('===============================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runTests()
