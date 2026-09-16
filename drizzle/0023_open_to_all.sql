-- Open-to-all mode: name-only guest accounts.
--
-- A guest is a real `users` row (the whole leaderboard/attempts schema hangs
-- off that table) that simply has no Supabase identity behind it. The column
-- exists so the leaderboard can tell the two worlds apart: in open-to-all mode
-- the board shows only guests, so a deployment that was handed a database from
-- the closed, scheduled event does not surface last year's finishers.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_guest" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_is_guest_idx" ON "users" USING btree ("is_guest");
