CREATE TABLE "collab_message_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collab_message_likes_user_msg_uniq" UNIQUE("message_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "collab_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day_key" text NOT NULL,
	"user_id" uuid NOT NULL,
	"user_name" text NOT NULL,
	"user_avatar" text,
	"message" text NOT NULL,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collab_message_likes" ADD CONSTRAINT "collab_message_likes_message_id_collab_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."collab_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collab_message_likes" ADD CONSTRAINT "collab_message_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collab_messages" ADD CONSTRAINT "collab_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collab_messages_day_key_idx" ON "collab_messages" USING btree ("day_key");--> statement-breakpoint
CREATE INDEX "collab_messages_user_day_idx" ON "collab_messages" USING btree ("day_key","user_id");