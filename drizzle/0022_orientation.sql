CREATE TABLE IF NOT EXISTS "orientation_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"batch" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orientation_participants_batch_idx" ON "orientation_participants" USING btree ("batch");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orientation_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"attempt_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"seed" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"duration_ms" integer,
	"score" integer,
	"moves_count" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"ip" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orientation_attempts_attempt_token_unique" UNIQUE("attempt_token"),
	CONSTRAINT "orientation_attempts_participant_game_unique" UNIQUE("participant_id","game_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orientation_attempts_participant_idx" ON "orientation_attempts" USING btree ("participant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orientation_attempts_game_idx" ON "orientation_attempts" USING btree ("game_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orientation_leaderboard" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"batch" varchar(20) NOT NULL,
	"metric" text NOT NULL,
	"duration_ms" integer,
	"score" integer,
	"started_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orientation_leaderboard_game_participant_unique" UNIQUE("game_id","participant_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orientation_leaderboard_game_batch_idx" ON "orientation_leaderboard" USING btree ("game_id","batch");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orientation_leaderboard_batch_idx" ON "orientation_leaderboard" USING btree ("batch");
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'orientation_attempts_participant_id_fkey'
	) THEN
		ALTER TABLE "orientation_attempts" ADD CONSTRAINT "orientation_attempts_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."orientation_participants"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'orientation_attempts_game_id_fkey'
	) THEN
		ALTER TABLE "orientation_attempts" ADD CONSTRAINT "orientation_attempts_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'orientation_leaderboard_game_id_fkey'
	) THEN
		ALTER TABLE "orientation_leaderboard" ADD CONSTRAINT "orientation_leaderboard_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'orientation_leaderboard_participant_id_fkey'
	) THEN
		ALTER TABLE "orientation_leaderboard" ADD CONSTRAINT "orientation_leaderboard_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."orientation_participants"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
