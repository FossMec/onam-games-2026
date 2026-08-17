-- The flower canvas is one persistent grid for the whole campaign.
-- Older versions created one row per day and copied the latest row forward.
DO $$
DECLARE
  keeper text;
BEGIN
  IF EXISTS (SELECT 1 FROM "collab_pookalam" WHERE "day_key" = 'community') THEN
    DELETE FROM "collab_pookalam" WHERE "day_key" <> 'community';
  ELSE
    SELECT "day_key"
      INTO keeper
      FROM "collab_pookalam"
      ORDER BY "day_key" DESC
      LIMIT 1;

    IF keeper IS NOT NULL THEN
      UPDATE "collab_pookalam"
      SET "day_key" = 'community'
      WHERE "day_key" = keeper;
    END IF;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "collab_pookalam"
  ADD CONSTRAINT "collab_pookalam_singleton_key"
  CHECK ("day_key" = 'community');
