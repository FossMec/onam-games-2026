-- Day 7: Code-a-Pookalam entries and head-to-head Elo voting.
--
-- Purely additive: two new tables and one new enum, nothing existing is
-- touched. Hand-written for the same reason as 0006 - drizzle-kit's generator
-- needs a TTY this environment does not have.

CREATE TYPE "public"."pookalam_status" AS ENUM('pending', 'approved', 'rejected');
--> statement-breakpoint

CREATE TABLE "pookalam_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"source_url" text NOT NULL,
	"image_url" text NOT NULL,
	"notes" text,
	"status" "pookalam_status" DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"rating" double precision DEFAULT 1200 NOT NULL,
	"matches" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pookalam_submissions_user_key" UNIQUE("user_id")
);
--> statement-breakpoint

CREATE TABLE "pookalam_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voter_id" uuid NOT NULL,
	"winner_id" uuid NOT NULL,
	"loser_id" uuid NOT NULL,
	"pair_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	-- The guarantee that one person judges one matchup once. Application code
	-- checks this too, but only to produce a nicer message; this is the rule.
	CONSTRAINT "pookalam_votes_voter_pair_key" UNIQUE("voter_id","pair_key")
);
--> statement-breakpoint

ALTER TABLE "pookalam_submissions" ADD CONSTRAINT "pookalam_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pookalam_submissions" ADD CONSTRAINT "pookalam_submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pookalam_votes" ADD CONSTRAINT "pookalam_votes_voter_id_users_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pookalam_votes" ADD CONSTRAINT "pookalam_votes_winner_id_pookalam_submissions_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."pookalam_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pookalam_votes" ADD CONSTRAINT "pookalam_votes_loser_id_pookalam_submissions_id_fk" FOREIGN KEY ("loser_id") REFERENCES "public"."pookalam_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "pookalam_submissions_status_idx" ON "pookalam_submissions" USING btree ("status");--> statement-breakpoint
-- Pairing reads the pool ordered by exposure, and results order by rating.
CREATE INDEX "pookalam_submissions_rating_idx" ON "pookalam_submissions" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "pookalam_votes_voter_idx" ON "pookalam_votes" USING btree ("voter_id");
