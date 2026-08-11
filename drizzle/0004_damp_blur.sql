ALTER TABLE "devices" ADD COLUMN "hardware_hash" text;--> statement-breakpoint
CREATE INDEX "devices_hardware_hash_idx" ON "devices" USING btree ("hardware_hash");