CREATE TYPE "public"."pookalam_verdict" AS ENUM('like', 'dislike');--> statement-breakpoint
CREATE TABLE "pookalam_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"verdict" "pookalam_verdict" NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pookalam_reviews_submission_reviewer_key" UNIQUE("submission_id","reviewer_id")
);
--> statement-breakpoint
CREATE TABLE "pookalam_standings" (
	"key" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pookalam_submissions" ADD COLUMN "image_path" text;--> statement-breakpoint
ALTER TABLE "pookalam_submissions" ADD COLUMN "image_width" integer;--> statement-breakpoint
ALTER TABLE "pookalam_submissions" ADD COLUMN "image_height" integer;--> statement-breakpoint
ALTER TABLE "pookalam_submissions" ADD COLUMN "shortlisted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pookalam_reviews" ADD CONSTRAINT "pookalam_reviews_submission_id_pookalam_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."pookalam_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pookalam_reviews" ADD CONSTRAINT "pookalam_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pookalam_reviews_submission_idx" ON "pookalam_reviews" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "pookalam_submissions_shortlist_idx" ON "pookalam_submissions" USING btree ("shortlisted","status","matches");