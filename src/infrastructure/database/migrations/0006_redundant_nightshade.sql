ALTER TABLE "review_anticipations" ADD COLUMN "day" text NOT NULL;--> statement-breakpoint
ALTER TABLE "review_anticipations" ADD COLUMN "ordinal" integer NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "review_anticipations_slot" ON "review_anticipations" USING btree ("user_id","day","ordinal");