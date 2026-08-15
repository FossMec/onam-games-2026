ALTER TYPE "public"."batch" ADD VALUE '26' BEFORE '27';--> statement-breakpoint
ALTER TYPE "public"."batch" ADD VALUE '<=25' BEFORE '<=26';--> statement-breakpoint
ALTER TYPE "public"."batch" ADD VALUE 'na';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "occupation" text;