import { db } from '../src/lib/db'

async function migrate() {
  console.log('Running custom transport schema migration...')

  const statements = [
    `ALTER TABLE student_transport_assignments ADD COLUMN IF NOT EXISTS "requestedByGuardianId" TEXT;`,
    `ALTER TYPE "TransportAssignmentStatus" ADD VALUE IF NOT EXISTS 'PENDING'`,
    `ALTER TYPE "TransportAssignmentStatus" ADD VALUE IF NOT EXISTS 'APPROVED'`,
    `ALTER TYPE "TransportAssignmentStatus" ADD VALUE IF NOT EXISTS 'REJECTED'`,
    `ALTER TYPE "ManifestItemStatus" ADD VALUE IF NOT EXISTS 'ARRIVAL_SUBMITTED'`,
    `ALTER TYPE "ManifestItemStatus" ADD VALUE IF NOT EXISTS 'ARRIVAL_VERIFIED'`,
    `DO $$ BEGIN
      CREATE TYPE "PickupAuthorizationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'USED', 'EXPIRED', 'CANCELLED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,
    `DO $$ BEGIN
      CREATE TYPE "TransportSecurityEventType" AS ENUM (
        'QR_SCAN', 'PIN_VERIFICATION_SUCCESS', 'PIN_VERIFICATION_FAILED',
        'UNAUTHORIZED_PICKUP_ATTEMPT', 'UNAUTHORIZED_DROP_ATTEMPT', 'UNKNOWN_PERSON_DETECTED',
        'AUTHORIZATION_APPROVED', 'AUTHORIZATION_REJECTED', 'DRIVER_LOGIN',
        'DRIVER_MISMATCH', 'DUPLICATE_PICKUP_ATTEMPT', 'DUPLICATE_DROP_ATTEMPT',
        'ARRIVAL_SUBMITTED', 'ARRIVAL_VERIFIED', 'ARRIVAL_REJECTED', 'MANUAL_OVERRIDE'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,
    `CREATE TABLE IF NOT EXISTS transport_pickup_authorizations (
      id TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "branchId" TEXT,
      "studentId" TEXT NOT NULL,
      "guardianId" TEXT,
      "personName" TEXT NOT NULL,
      phone TEXT NOT NULL,
      relationship TEXT NOT NULL,
      "actionType" TEXT NOT NULL DEFAULT 'PICKUP',
      reason TEXT NOT NULL,
      "validFrom" DATE NOT NULL,
      "validUntil" DATE NOT NULL,
      "isOneTime" BOOLEAN NOT NULL DEFAULT true,
      status "PickupAuthorizationStatus" NOT NULL DEFAULT 'PENDING',
      "approvedById" TEXT,
      "approvedByName" TEXT,
      "approvedAt" TIMESTAMP(3),
      "rejectionReason" TEXT,
      "usedAt" TIMESTAMP(3),
      "usedById" TEXT,
      "usedByName" TEXT,
      remarks TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_tpa_tenant FOREIGN KEY ("tenantId") REFERENCES "tenants"(id) ON DELETE CASCADE,
      CONSTRAINT fk_tpa_branch FOREIGN KEY ("branchId") REFERENCES "branches"(id) ON DELETE SET NULL,
      CONSTRAINT fk_tpa_student FOREIGN KEY ("studentId") REFERENCES "students"(id) ON DELETE CASCADE,
      CONSTRAINT fk_tpa_guardian FOREIGN KEY ("guardianId") REFERENCES "guardians"(id) ON DELETE SET NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_tpa_tenant_student ON transport_pickup_authorizations("tenantId", "studentId");`,
    `CREATE INDEX IF NOT EXISTS idx_tpa_tenant_status ON transport_pickup_authorizations("tenantId", status);`,
    `CREATE TABLE IF NOT EXISTS transport_security_events (
      id TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "branchId" TEXT,
      "eventType" "TransportSecurityEventType" NOT NULL,
      "studentId" TEXT,
      "driverProfileId" TEXT,
      "vehicleId" TEXT,
      "routeId" TEXT,
      "tripId" TEXT,
      "authorizationId" TEXT,
      "actorId" TEXT NOT NULL,
      "actorName" TEXT NOT NULL,
      "actorRole" TEXT NOT NULL,
      action TEXT NOT NULL,
      result TEXT NOT NULL DEFAULT 'SUCCESS',
      reason TEXT,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      metadata JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_tse_tenant FOREIGN KEY ("tenantId") REFERENCES "tenants"(id) ON DELETE CASCADE,
      CONSTRAINT fk_tse_branch FOREIGN KEY ("branchId") REFERENCES "branches"(id) ON DELETE SET NULL,
      CONSTRAINT fk_tse_student FOREIGN KEY ("studentId") REFERENCES "students"(id) ON DELETE SET NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_tse_tenant_event ON transport_security_events("tenantId", "eventType");`,
    `CREATE INDEX IF NOT EXISTS idx_tse_tenant_created ON transport_security_events("tenantId", "createdAt");`,
  ]

  for (const stmt of statements) {
    try {
      await db.$executeRawUnsafe(stmt)
      console.log('Success:', stmt.substring(0, 50).trim())
    } catch (e: any) {
      console.error('Error executing:', stmt.substring(0, 50), e.message)
      throw e
    }
  }

  console.log('All transport migrations applied successfully!')
}

migrate()
  .catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
