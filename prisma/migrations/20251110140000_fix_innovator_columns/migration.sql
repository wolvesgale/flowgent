-- Ensure Innovator columns exist and are aligned
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Innovator'
      AND column_name = 'company'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Innovator'
      AND column_name = 'name'
  ) THEN
    EXECUTE 'ALTER TABLE "Innovator" RENAME COLUMN "company" TO "name"';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Innovator'
      AND column_name = 'name'
  ) THEN
    EXECUTE 'ALTER TABLE "Innovator" ADD COLUMN "name" TEXT';
  END IF;
END $$;

ALTER TABLE "Innovator" ADD COLUMN IF NOT EXISTS "url" TEXT;
ALTER TABLE "Innovator" ADD COLUMN IF NOT EXISTS "introPoint" TEXT;

UPDATE "Innovator" SET "name" = '' WHERE "name" IS NULL;
ALTER TABLE "Innovator" ALTER COLUMN "name" SET NOT NULL;
