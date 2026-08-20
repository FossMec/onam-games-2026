CREATE TYPE "public"."hunt_difficulty" AS ENUM('first', 'easy', 'medium', 'hard');--> statement-breakpoint
CREATE TABLE "hunt_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"hint_html" text NOT NULL,
	"answer" text NOT NULL,
	"difficulty" "hunt_difficulty" DEFAULT 'easy' NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hunt_questions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_hunt_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"current_question_id" uuid,
	"solved_question_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"solved_count" integer DEFAULT 0 NOT NULL,
	"last_submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_hunt_progress_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "user_hunt_progress" ADD CONSTRAINT "user_hunt_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_hunt_progress" ADD CONSTRAINT "user_hunt_progress_current_question_id_hunt_questions_id_fk" FOREIGN KEY ("current_question_id") REFERENCES "public"."hunt_questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hunt_questions_diff_idx" ON "hunt_questions" USING btree ("difficulty");--> statement-breakpoint
CREATE INDEX "hunt_questions_order_idx" ON "hunt_questions" USING btree ("order_index");--> statement-breakpoint
CREATE INDEX "user_hunt_progress_user_idx" ON "user_hunt_progress" USING btree ("user_id");