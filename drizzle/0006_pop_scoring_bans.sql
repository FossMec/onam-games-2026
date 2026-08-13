-- Schema rework: multi-attempt games, cross-game points, graduated bans.
--
-- Hand-written because drizzle-kit cannot tell a drop+create from a rename
-- without a TTY prompt, and every "conflict" here is genuinely a replacement:
-- is_blocked (boolean) -> ban_level (integer scale), weighted_total (float
-- p99 ratio) -> total_points (integer rank points), percentile_score -> points.
-- Answering "rename" to any of them would silently carry incompatible values.
--
-- Existing data is migrated where it has meaning; recomputable aggregates are
-- simply reset, since `rollUpGlobalScores()` rebuilds them from scratch.

CREATE TYPE "public"."metric" AS ENUM('time', 'score', 'fcfs');--> statement-breakpoint

--=========================================================== daily_leaderboard
-- A game's rows are no longer all times: `metric` says which column ranks a
-- row, so duration_ms and score are both nullable and only one is meaningful.
ALTER TABLE "daily_leaderboard" ADD COLUMN "metric" "public"."metric" DEFAULT 'time' NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_leaderboard" ADD COLUMN "score" integer;--> statement-breakpoint
ALTER TABLE "daily_leaderboard" ADD COLUMN "attempts_used" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_leaderboard" ADD COLUMN "rank" integer;--> statement-breakpoint
ALTER TABLE "daily_leaderboard" ADD COLUMN "points" integer;--> statement-breakpoint
-- Score-based games have no completion time to record.
ALTER TABLE "daily_leaderboard" ALTER COLUMN "duration_ms" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_leaderboard" DROP COLUMN "percentile_score";--> statement-breakpoint
DROP INDEX IF EXISTS "daily_leaderboard_duration_idx";--> statement-breakpoint
-- Ranking is always scoped to one game, so both indexes lead with game_id.
CREATE INDEX "daily_leaderboard_game_duration_idx" ON "daily_leaderboard" USING btree ("game_id","duration_ms");--> statement-breakpoint
CREATE INDEX "daily_leaderboard_game_score_idx" ON "daily_leaderboard" USING btree ("game_id","score");--> statement-breakpoint

--============================================================== game_attempts
-- Retry games (Maveli Jump) need many rows per user per game. The old
-- unique(user, game) made that impossible; the per-day cap now comes from the
-- registry's maxAttempts, while the new constraint still blocks a raced
-- double-start from minting two rows with the same attempt number.
ALTER TABLE "game_attempts" ADD COLUMN "attempt_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_attempts" ADD COLUMN "score" integer;--> statement-breakpoint
ALTER TABLE "game_attempts" DROP CONSTRAINT IF EXISTS "game_attempts_user_game_key";--> statement-breakpoint
ALTER TABLE "game_attempts" ADD CONSTRAINT "game_attempts_user_game_number_key" UNIQUE("user_id","game_id","attempt_number");--> statement-breakpoint
CREATE INDEX "game_attempts_user_game_idx" ON "game_attempts" USING btree ("user_id","game_id");--> statement-breakpoint

--======================================================================= games
-- config_json is gone: it was returned to the browser for every published
-- game, including unreleased ones, which leaked upcoming puzzle setup. Game
-- behaviour now lives in src/server/games/registry.ts and never ships.
ALTER TABLE "games" ADD COLUMN "settled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "config_json";--> statement-breakpoint

--=============================================================== global_scores
-- weighted_total held a p99-anchored ratio that is not comparable to the new
-- rank points, so it is dropped rather than carried. rollUpGlobalScores()
-- recomputes totals from settled daily rows on the next leaderboard read.
ALTER TABLE "global_scores" ADD COLUMN "total_points" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "global_scores" ADD COLUMN "streak_bonus" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "global_scores" DROP COLUMN "weighted_total";--> statement-breakpoint

--======================================================================= users
ALTER TABLE "users" ADD COLUMN "college_other" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "branch_other" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ban_level" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ban_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ban_acked_at" timestamp with time zone;--> statement-breakpoint
-- Carry existing blocks across before the old columns go: a blocked account
-- becomes a level-4 hard ban, which is the only level that closes an account.
UPDATE "users" SET "ban_level" = 4, "ban_reason" = COALESCE("block_reason", 'migrated from is_blocked') WHERE "is_blocked" = true;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "is_blocked";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "block_reason";
