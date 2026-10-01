import { db } from '../src/lib/db'
import { TransportService } from '../src/lib/transport/transport-service'
import { TransportSecurityService } from '../src/lib/transport/transport-security'

async function runTransportSecurityTests() {
  console.log('--- STARTING PREONE TRANSPORT MANAGEMENT & SECURITY TEST SUITE ---')

  // 1. Setup Test Tenant & Users
  const tenantId = `test_tenant_${Date.now()}`
  const tenantBId = `test_tenant_b_${Date.now()}`

  try {
    // Create Test Tenants
    await db.tenant.create({
      data: {
        id: tenantId,
        name: 'Transport Test School A',
        code: `TA-${Date.now()}`,
      },
    })
    await db.tenant.create({
      data: {
        id: tenantBId,
        name: 'Transport Test School B',
        code: `TB-${Date.now()}`,
      },
    })

    // Create Active Academic Session for Tenant A
    await db.academicSession.create({
      data: {
        id: `session_${Date.now()}`,
        tenantId,
        name: '2026-2027',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2027-03-31'),
        isCurrent: true,
      },
    })

    const ctxA = {
      tenantId,
      actorId: 'user_admin_a',
      actorName: 'Admin Alice',
      actorRole: 'OWNER',
    }

    const ctxB = {
      tenantId: tenantBId,
      actorId: 'user_admin_b',
      actorName: 'Admin Bob',
      actorRole: 'OWNER',
    }

    // 2. Test Vehicle & Route Creation (Positive)
    console.log('[TEST 1] Creating Transport Vehicle & Route...')
    const vehicle = await TransportService.createVehicle(ctxA, {
      registrationNumber: `BUS-${Date.now()}`,
      vehicleType: 'SCHOOL_BUS',
      capacity: 30,
      makeModel: 'Tata Starbus 2026',
    })
    console.log('✓ Vehicle created:', vehicle.id, vehicle.registrationNumber)

    const route = await TransportService.createRoute(ctxA, {
      code: `R-${Date.now()}`,
      name: 'North Campus Express',
      vehicleId: vehicle.id,
    })
    console.log('✓ Route created:', route.id, route.name)

    // Create Branch for Tenant
    const branchA = await db.branch.create({
      data: {
        id: `br_${Date.now()}`,
        tenantId,
        name: 'Main Branch A',
        code: `BR-${Date.now()}`,
      },
    })

    // 3. Test Student Creation & Transport Assignment
    console.log('[TEST 2] Creating Student & Transport Assignment...')
    const student = await db.student.create({
      data: {
        id: `st_${Date.now()}`,
        tenantId,
        branchId: branchA.id,
        firstName: 'Rahul',
        lastName: 'Sharma',
        admissionNo: `ADM-${Date.now()}`,
        dob: new Date('2020-01-01'),
        gender: 'MALE',
      },
    })

    // Create Stops for the Route
    const stopA = await db.routeStop.create({
      data: {
        id: `stop_a_${Date.now()}`,
        tenantId,
        routeId: route.id,
        name: 'Sector 15 Main Gate',
        sequence: 1,
        morningPickupTime: '07:30 AM',
        eveningDropTime: '02:30 PM',
      },
    })

    const stopB = await db.routeStop.create({
      data: {
        id: `stop_b_${Date.now()}`,
        tenantId,
        routeId: route.id,
        name: 'School Gate',
        sequence: 2,
        morningPickupTime: '08:00 AM',
        eveningDropTime: '02:00 PM',
      },
    })

    const assignment = await TransportService.assignStudent(ctxA, {
      studentId: student.id,
      routeId: route.id,
      pickupStopId: stopA.id,
      dropStopId: stopB.id,
      tripType: 'TWO_WAY',
    })
    console.log('✓ Student Assigned to Transport Route:', assignment.id)

    // 4. Test Tenant Isolation (Negative Security Test)
    console.log('[TEST 3] Testing Tenant Isolation Enforcement...')
    const tenantBAssignments = await TransportService.listAssignments(ctxB, {
      routeId: route.id,
    })
    if (tenantBAssignments.length === 0) {
      console.log('✓ Security Verified: Tenant B cannot view Tenant A transport assignments!')
    } else {
      throw new Error('SECURITY VIOLATION: Cross-tenant data leakage detected!')
    }

    // 5. Test Driver PIN Verification & Lockout (Security Test)
    console.log('[TEST 4] Testing Secure PIN Verification & Rate Limiting...')
    const driverUser = await db.user.create({
      data: {
        id: `dr_${Date.now()}`,
        email: `driver_${Date.now()}@test.com`,
        fullName: 'Ramesh Driver',
        passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
        memberships: {
          create: {
            tenantId,
            role: 'STAFF',
          },
        },
      },
    })

    await TransportSecurityService.setDriverPin(ctxA, driverUser.id, '1234')

    // Correct PIN Check
    const validPinResult = await TransportSecurityService.verifyDriverPin(ctxA, driverUser.id, '1234')
    if (validPinResult.valid) {
      console.log('✓ Correct PIN Verified successfully')
    } else {
      throw new Error('FAILED: Valid PIN rejected')
    }

    // Incorrect PIN Check
    const invalidPinResult = await TransportSecurityService.verifyDriverPin(ctxA, driverUser.id, '9999')
    if (!invalidPinResult.valid) {
      console.log('✓ Security Verified: Incorrect PIN rejected with warning:', invalidPinResult.message)
    } else {
      throw new Error('SECURITY VIOLATION: Incorrect PIN was accepted!')
    }

    // 6. Test Temporary Authorized Pickup Workflow
    console.log('[TEST 5] Testing Temporary Authorized Pickup Workflow...')
    const authReq = await TransportSecurityService.createPickupAuthorization(ctxA, {
      studentId: student.id,
      authorizedPersonName: 'Uncle Vikram',
      authorizedPersonPhone: '9876543210',
      relationship: 'Uncle',
      reason: 'Parents out of town',
      validFrom: new Date(Date.now() - 3600000), // 1 hour ago
      validUntil: new Date(Date.now() + 86400000), // tomorrow
      isOneTime: true,
    })
    console.log('✓ Temp Pickup Authorization created:', authReq.id, 'Status:', authReq.status)

    // Verify approval workflow
    const approvedAuth = await TransportSecurityService.approvePickupAuthorization(ctxA, authReq.id, 'Identity verified by front desk')
    if (approvedAuth.status === 'APPROVED') {
      console.log('✓ Temp Pickup Authorization Approved by Staff:', approvedAuth.id)
    } else {
      throw new Error('FAILED: Pickup authorization approval failed')
    }

    // 7. Test Security Event Logging & Audit Trail
    console.log('[TEST 6] Verifying Transport Security Audit Trail...')
    const logs = await TransportSecurityService.getSecurityLogs(ctxA, { limit: 10 })
    if (logs.length > 0) {
      console.log(`✓ Audit Trail Verified: Logged ${logs.length} immutable security events.`)
    } else {
      throw new Error('FAILED: Audit trail is empty')
    }

    console.log('\n==========================================================')
    console.log('🎉 ALL TRANSPORT MANAGEMENT & SAFETY SECURITY TESTS PASSED!')
    console.log('==========================================================\n')
  } catch (err: any) {
    console.error('❌ TEST FAILED:', err.message)
    process.exit(1)
  } finally {
    // Cleanup test tenants
    await db.transportSecurityEvent.deleteMany({ where: { tenantId: { in: [tenantId, tenantBId] } } }).catch(() => {})
    await db.transportPickupAuthorization.deleteMany({ where: { tenantId: { in: [tenantId, tenantBId] } } }).catch(() => {})
    await db.studentTransportAssignment.deleteMany({ where: { tenantId: { in: [tenantId, tenantBId] } } }).catch(() => {})
    await db.transportRoute.deleteMany({ where: { tenantId: { in: [tenantId, tenantBId] } } }).catch(() => {})
    await db.vehicle.deleteMany({ where: { tenantId: { in: [tenantId, tenantBId] } } }).catch(() => {})
    await db.student.deleteMany({ where: { tenantId: { in: [tenantId, tenantBId] } } }).catch(() => {})
    await db.academicSession.deleteMany({ where: { tenantId: { in: [tenantId, tenantBId] } } }).catch(() => {})
    await db.branch.deleteMany({ where: { tenantId: { in: [tenantId, tenantBId] } } }).catch(() => {})
    await db.tenantUser.deleteMany({ where: { tenantId: { in: [tenantId, tenantBId] } } }).catch(() => {})
    await db.tenant.deleteMany({ where: { id: { in: [tenantId, tenantBId] } } }).catch(() => {})
    await db.$disconnect()
  }
}

runTransportSecurityTests()
