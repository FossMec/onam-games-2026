CREATE TABLE "collab_pookalam_diffs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"cell_index" smallint NOT NULL,
	"flower_id" smallint NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "collab_pookalam_diffs_placed_at_idx" ON "collab_pookalam_diffs" USING btree ("placed_at");