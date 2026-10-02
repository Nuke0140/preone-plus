-- PreOne M00 Setup v2 Staged Migration
-- Safe, Idempotent PostgreSQL script

-- 1. Alter Tenant table: add principalSignatureUrl
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "principalSignatureUrl" TEXT;

-- 2. Extend ConfigDomain enum
ALTER TYPE "ConfigDomain" ADD VALUE IF NOT EXISTS 'MOOD_ENVIRONMENT';
ALTER TYPE "ConfigDomain" ADD VALUE IF NOT EXISTS 'PROMOTION';

-- 3. Create SubjectType enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubjectType') THEN
    CREATE TYPE "SubjectType" AS ENUM ('CORE', 'OPTIONAL', 'ACTIVITY');
  END IF;
END $$;

-- 4. Create subjects table
CREATE TABLE IF NOT EXISTS "subjects" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "shortName" TEXT,
  "description" TEXT,
  "subjectType" "SubjectType" NOT NULL DEFAULT 'CORE',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "subjects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subjects_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "subjects_tenantId_code_key" ON "subjects"("tenantId", "code");
CREATE INDEX IF NOT EXISTS "subjects_tenantId_status_idx" ON "subjects"("tenantId", "status");

-- 5. Create program_subjects table
CREATE TABLE IF NOT EXISTS "program_subjects" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "program_subjects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "program_subjects_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "program_subjects_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "program_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "program_subjects_programId_subjectId_key" ON "program_subjects"("programId", "subjectId");
CREATE INDEX IF NOT EXISTS "program_subjects_tenantId_programId_idx" ON "program_subjects"("tenantId", "programId");

-- 6. Create classroom_subjects table
CREATE TABLE IF NOT EXISTS "classroom_subjects" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "classroomId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "specialistTeacherId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "classroom_subjects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "classroom_subjects_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "classroom_subjects_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "classroom_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "classroom_subjects_specialistTeacherId_fkey" FOREIGN KEY ("specialistTeacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "classroom_subjects_classroomId_subjectId_key" ON "classroom_subjects"("classroomId", "subjectId");
CREATE INDEX IF NOT EXISTS "classroom_subjects_tenantId_classroomId_idx" ON "classroom_subjects"("tenantId", "classroomId");

-- 7. Migrate legacy step keys in school_setup_steps
UPDATE "school_setup_steps" SET "stepKey" = 'classroom' WHERE "stepKey" = 'classes_sections';
UPDATE "school_setup_steps" SET "stepKey" = 'fees_setup' WHERE "stepKey" = 'fees';
UPDATE "school_setup_steps" SET "stepKey" = 'templates' WHERE "stepKey" = 'documents';
UPDATE "school_setup_steps" SET "stepKey" = 'health_settings' WHERE "stepKey" = 'health_safety';
