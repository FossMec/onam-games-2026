ALTER TABLE "users" ALTER COLUMN "batch" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."batch";--> statement-breakpoint
CREATE TYPE "public"."batch" AS ENUM('26', '27', '28', '29', '30', '<=26', 'na');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "batch" SET DATA TYPE "public"."batch" USING "batch"::"public"."batch";