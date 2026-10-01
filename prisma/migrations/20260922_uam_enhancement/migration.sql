-- PreOne UAM Enhancement Staged Migration
-- Safe, Idempotent PostgreSQL script

-- 1. Add canonical enum values
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'STAFF';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'RECEPTIONIST';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ATTENDANT';

ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'LOCKED';
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'DEACTIVATED';
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

ALTER TYPE "Relationship" ADD VALUE IF NOT EXISTS 'GUARDIAN';
ALTER TYPE "Relationship" ADD VALUE IF NOT EXISTS 'SIBLING';

ALTER TYPE "EmploymentType" ADD VALUE IF NOT EXISTS 'FULL_TIME';
ALTER TYPE "EmploymentType" ADD VALUE IF NOT EXISTS 'PROBATION';

-- 2. Alter User table
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferences" JSONB;

-- 3. Create user_sessions table
CREATE TABLE IF NOT EXISTS "user_sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT,
  "tokenHash" TEXT NOT NULL,
  "device" TEXT,
  "platform" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_sessions_tokenHash_key" ON "user_sessions"("tokenHash");
CREATE INDEX IF NOT EXISTS "user_sessions_userId_status_idx" ON "user_sessions"("userId", "status");

-- 4. Staged data migration
UPDATE "staff_profiles" SET "employmentType" = 'FULL_TIME' WHERE "employmentType"::text = 'REGULAR';
UPDATE "staff_profiles" SET "employmentType" = 'PROBATION' WHERE "employmentType"::text = 'INTERN';
ALTER TABLE "staff_profiles" ALTER COLUMN "employmentType" SET DEFAULT 'FULL_TIME';

UPDATE "guardians" SET "relationship" = 'GUARDIAN' WHERE "relationship"::text IN ('LEGAL_GUARDIAN', 'OTHER');
UPDATE "student_guardians" SET "relationship" = 'GUARDIAN' WHERE "relationship"::text IN ('LEGAL_GUARDIAN', 'OTHER');

UPDATE "users" SET "status" = 'DEACTIVATED' WHERE "status"::text = 'INACTIVE';
UPDATE "users" SET "status" = 'ACTIVE' WHERE "status"::text = 'PENDING';
UPDATE "tenant_users" SET "status" = 'DEACTIVATED' WHERE "status"::text = 'INACTIVE';
UPDATE "tenant_users" SET "status" = 'ACTIVE' WHERE "status"::text = 'PENDING';

UPDATE "tenant_users" SET "role" = 'STAFF' WHERE "role"::text IN ('HELPER', 'HR');
UPDATE "tenant_users" SET "role" = 'ACCOUNTS' WHERE "role"::text = 'ACCOUNTANT';
UPDATE "tenant_users" SET "role" = 'RECEPTIONIST' WHERE "role"::text = 'RECEPTION';
