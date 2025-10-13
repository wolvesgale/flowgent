-- Adjust Innovator schema to align with application expectations

-- Ensure the BusinessDomain enum exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    WHERE t.typname = 'BusinessDomain'
  ) THEN
    CREATE TYPE "BusinessDomain" AS ENUM (
      'HR',
      'IT',
      'ACCOUNTING',
      'ADVERTISING',
      'MANAGEMENT',
      'SALES',
      'MANUFACTURING',
      'MEDICAL',
      'FINANCE'
    );
  END IF;
END
$$;

-- Rename legacy name column to company when necessary
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Innovator'
      AND column_name = 'name'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Innovator'
      AND column_name = 'company'
  ) THEN
    EXECUTE 'ALTER TABLE "Innovator" RENAME COLUMN "name" TO "company"';
  END IF;
END
$$;

-- Drop unused columns that are no longer part of the Prisma model
ALTER TABLE "Innovator"
  DROP COLUMN IF EXISTS "email",
  DROP COLUMN IF EXISTS "position",
  DROP COLUMN IF EXISTS "status",
  DROP COLUMN IF EXISTS "requiresIntroduction",
  DROP COLUMN IF EXISTS "notes";

-- Add the new optional columns if they are missing
ALTER TABLE "Innovator"
  ADD COLUMN IF NOT EXISTS "url" TEXT,
  ADD COLUMN IF NOT EXISTS "introductionPoint" TEXT,
  ADD COLUMN IF NOT EXISTS "domain" "BusinessDomain";

-- Drop indexes that referenced removed columns
DROP INDEX IF EXISTS "Innovator_email_key";
