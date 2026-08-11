CREATE TYPE "public"."action_taken" AS ENUM('none', 'flag', 'block');--> statement-breakpoint
CREATE TYPE "public"."attempt_status" AS ENUM('in_progress', 'submitted', 'expired', 'void');--> statement-breakpoint
CREATE TYPE "public"."batch" AS ENUM('27', '28', '29', '30', '<=26');--> statement-breakpoint
CREATE TYPE "public"."block_scope" AS ENUM('auth', 'game', 'all');--> statement-breakpoint
CREATE TYPE "public"."branch" AS ENUM('cs', 'cu', 'ee', 'eb', 'ec', 'ev', 'me', 'other');--> statement-breakpoint
CREATE TYPE "public"."college" AS ENUM('mec', 'other');--> statement-breakpoint
CREATE TYPE "public"."div" AS ENUM('none', 'a', 'b', 'c');--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('upcoming', 'tester', 'live', 'closed');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('player', 'tester', 'admin');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('info', 'warn', 'critical');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"device_id" uuid,
	"ip" text,
	"event_type" text NOT NULL,
	"meta_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"group" text DEFAULT 'general' NOT NULL,
	"description" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocked_ips" (
	"ip" text PRIMARY KEY NOT NULL,
	"reason" text,
	"scope" "block_scope" DEFAULT 'all' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_leaderboard" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"duration_ms" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"percentile_score" double precision,
	"is_flagged" boolean DEFAULT false NOT NULL,
	CONSTRAINT "daily_leaderboard_game_user_key" UNIQUE("game_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_hash" text NOT NULL,
	"fingerprint_json" jsonb,
	"fingerprint_version" integer DEFAULT 1 NOT NULL,
	"canvas_hash" text,
	"webgl_hash" text,
	"font_hash" text,
	"screen_hash" text,
	"user_agent" text,
	"platform" text,
	"first_ip" text,
	"last_ip" text,
	"first_country" text,
	"first_city" text,
	"last_country" text,
	"last_city" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"flag_reason" text,
	"flag_confidence" double precision,
	"flagged_at" timestamp with time zone,
	"attempts_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "devices_device_hash_unique" UNIQUE("device_hash")
);
--> statement-breakpoint
CREATE TABLE "game_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"seed" text NOT NULL,
	"initial_state_hash" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"duration_ms" integer,
	"submitted_state_hash" text,
	"server_valid" boolean DEFAULT false NOT NULL,
	"is_anomalous" boolean DEFAULT false NOT NULL,
	"after_deadline" boolean DEFAULT false NOT NULL,
	"status" "attempt_status" DEFAULT 'in_progress' NOT NULL,
	"moves_count" integer,
	"ip" text,
	"user_agent" text,
	"country" text,
	"city" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_attempts_attempt_token_unique" UNIQUE("attempt_token"),
	CONSTRAINT "game_attempts_user_game_key" UNIQUE("user_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"day" integer NOT NULL,
	"title" text NOT NULL,
	"hint" text,
	"game_type" text NOT NULL,
	"difficulty" text DEFAULT 'normal' NOT NULL,
	"release_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"tester_early_hours" integer DEFAULT 24 NOT NULL,
	"status" "game_status" DEFAULT 'upcoming' NOT NULL,
	"config_json" jsonb,
	"assets_json" jsonb,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "global_scores" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"games_completed" integer DEFAULT 0 NOT NULL,
	"weighted_total" double precision DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suspicious_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"device_id" uuid,
	"ip" text,
	"event_type" text NOT NULL,
	"severity" "severity" DEFAULT 'info' NOT NULL,
	"details_json" jsonb,
	"action_taken" "action_taken" DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "testers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"added_by" uuid,
	"early_hours" integer DEFAULT 24 NOT NULL,
	"activated_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "testers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"first_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_devices_user_device_key" UNIQUE("user_id","device_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supabase_uid" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"avatar_url" text,
	"instagram_handle" text,
	"college" "college" NOT NULL,
	"branch" "branch",
	"batch" "batch",
	"div" "div" DEFAULT 'none',
	"role" "role" DEFAULT 'player',
	"is_blocked" boolean DEFAULT false NOT NULL,
	"block_reason" text,
	"trust_score" integer DEFAULT 100 NOT NULL,
	"streak_count" integer DEFAULT 0 NOT NULL,
	"best_streak" integer DEFAULT 0 NOT NULL,
	"last_streak_day" date,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_supabase_uid_unique" UNIQUE("supabase_uid"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_ips" ADD CONSTRAINT "blocked_ips_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_leaderboard" ADD CONSTRAINT "daily_leaderboard_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_leaderboard" ADD CONSTRAINT "daily_leaderboard_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_leaderboard" ADD CONSTRAINT "daily_leaderboard_attempt_id_game_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."game_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_attempts" ADD CONSTRAINT "game_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_attempts" ADD CONSTRAINT "game_attempts_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_attempts" ADD CONSTRAINT "game_attempts_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_scores" ADD CONSTRAINT "global_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suspicious_logs" ADD CONSTRAINT "suspicious_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suspicious_logs" ADD CONSTRAINT "suspicious_logs_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testers" ADD CONSTRAINT "testers_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_logs_user_idx" ON "activity_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "app_settings_group_idx" ON "app_settings" USING btree ("group");--> statement-breakpoint
CREATE INDEX "daily_leaderboard_duration_idx" ON "daily_leaderboard" USING btree ("duration_ms");--> statement-breakpoint
CREATE INDEX "devices_last_seen_idx" ON "devices" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "game_attempts_game_idx" ON "game_attempts" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "game_attempts_started_at_idx" ON "game_attempts" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "games_day_idx" ON "games" USING btree ("day");--> statement-breakpoint
CREATE INDEX "suspicious_logs_created_at_idx" ON "suspicious_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "suspicious_logs_ip_idx" ON "suspicious_logs" USING btree ("ip");--> statement-breakpoint
CREATE INDEX "suspicious_logs_user_idx" ON "suspicious_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "testers_active_idx" ON "testers" USING btree ("active");--> statement-breakpoint
CREATE INDEX "user_devices_device_idx" ON "user_devices" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");