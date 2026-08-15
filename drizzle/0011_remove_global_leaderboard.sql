DROP TABLE "global_scores" CASCADE;--> statement-breakpoint
ALTER TABLE "daily_leaderboard" DROP COLUMN "rank";--> statement-breakpoint
ALTER TABLE "daily_leaderboard" DROP COLUMN "points";--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "settled_at";