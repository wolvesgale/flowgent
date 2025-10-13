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
