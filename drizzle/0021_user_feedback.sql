CREATE TABLE IF NOT EXISTS "user_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"device_id" text,
	"enjoyed_games" text,
	"favorite_thing" text,
	"changes_next_year" text,
	"code_pookalam_experience" text,
	"code_pookalam_roadmap" text,
	"open_source_learning" text,
	"want_more_foss_events" text,
	"next_event_suggestions" text,
	"learn_topics" text,
	"community_pookalam_experience" text,
	"batch" text,
	"college" text,
	"additional_notes" text,
	"answers_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'user_feedback_user_id_users_id_fk'
	) THEN
		ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_feedback_user_id_idx" ON "user_feedback" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_feedback_created_at_idx" ON "user_feedback" USING btree ("created_at");
