-- Ensure Innovator table exposes the NOT NULL "name" column expected by Prisma's company field
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Innovator'
      AND column_name = 'company'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Innovator'
      AND column_name = 'name'
  ) THEN
    EXECUTE 'ALTER TABLE "Innovator" RENAME COLUMN "company" TO "name"';
  END IF;
END
$$;

-- Drop optional columns that are no longer represented in the Prisma schema
ALTER TABLE "Innovator"
  DROP COLUMN IF EXISTS "url",
  DROP COLUMN IF EXISTS "introductionPoint",
  DROP COLUMN IF EXISTS "domain",
  DROP COLUMN IF EXISTS "email",
  DROP COLUMN IF EXISTS "position",
  DROP COLUMN IF EXISTS "status",
  DROP COLUMN IF EXISTS "requiresIntroduction",
  DROP COLUMN IF EXISTS "notes";
