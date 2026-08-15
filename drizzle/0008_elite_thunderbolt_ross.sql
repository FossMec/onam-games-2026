DROP INDEX "daily_leaderboard_game_duration_idx";--> statement-breakpoint
DROP INDEX "daily_leaderboard_game_score_idx";--> statement-breakpoint
DROP INDEX "pookalam_submissions_status_idx";--> statement-breakpoint
CREATE INDEX "daily_leaderboard_game_submitted_idx" ON "daily_leaderboard" USING btree ("game_id","is_flagged","submitted_at");--> statement-breakpoint
CREATE INDEX "game_attempts_user_game_status_idx" ON "game_attempts" USING btree ("user_id","game_id","status");--> statement-breakpoint
CREATE INDEX "games_published_day_idx" ON "games" USING btree ("published","day");--> statement-breakpoint
CREATE INDEX "daily_leaderboard_game_duration_idx" ON "daily_leaderboard" USING btree ("game_id","is_flagged","duration_ms");--> statement-breakpoint
CREATE INDEX "daily_leaderboard_game_score_idx" ON "daily_leaderboard" USING btree ("game_id","is_flagged","score");--> statement-breakpoint
CREATE INDEX "pookalam_submissions_status_idx" ON "pookalam_submissions" USING btree ("status","matches","id");