ALTER TABLE "devices" ADD COLUMN "audio_hash" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "local_ip" text;--> statement-breakpoint
CREATE INDEX "devices_fp_visitor_idx" ON "devices" USING btree ("fp_visitor_id");--> statement-breakpoint
CREATE INDEX "devices_canvas_hash_idx" ON "devices" USING btree ("canvas_hash");--> statement-breakpoint
CREATE INDEX "devices_webgl_hash_idx" ON "devices" USING btree ("webgl_hash");--> statement-breakpoint
CREATE INDEX "devices_font_hash_idx" ON "devices" USING btree ("font_hash");--> statement-breakpoint
CREATE INDEX "devices_audio_hash_idx" ON "devices" USING btree ("audio_hash");--> statement-breakpoint
CREATE INDEX "devices_local_ip_idx" ON "devices" USING btree ("local_ip");--> statement-breakpoint
CREATE INDEX "devices_last_ip_idx" ON "devices" USING btree ("last_ip");