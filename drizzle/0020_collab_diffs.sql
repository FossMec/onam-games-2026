-- collab_pookalam_diffs: per-stroke diff log for animation replay.
-- Each successfully written cell during a collab stroke appends one row.
-- flower_id = 0 means the cell was erased.

CREATE TABLE IF NOT EXISTS "collab_pookalam_diffs" (
  "id"         BIGSERIAL    NOT NULL PRIMARY KEY,
  "cell_index" SMALLINT     NOT NULL,
  "flower_id"  SMALLINT     NOT NULL,
  "placed_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- BRIN is ideal here: the table is append-only and rows are naturally
-- ordered by insertion time, which matches placed_at.
CREATE INDEX "collab_pookalam_diffs_placed_at_idx"
  ON "collab_pookalam_diffs" USING BRIN ("placed_at");
