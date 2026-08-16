CREATE TABLE "collab_pookalam" (
	"day_key" text PRIMARY KEY NOT NULL,
	"cells" "bytea" NOT NULL,
	"placed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
