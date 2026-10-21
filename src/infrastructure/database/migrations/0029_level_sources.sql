CREATE TABLE "level_ratings" (
	"source_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"level_min" text NOT NULL,
	"level_max" text NOT NULL,
	CONSTRAINT "level_ratings_source_id_external_id_pk" PRIMARY KEY("source_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "level_sources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"name" text,
	"parent_id" uuid,
	"enabled" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"last_status" integer,
	"fetched_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "level_ratings" ADD CONSTRAINT "level_ratings_source_id_level_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."level_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_sources" ADD CONSTRAINT "level_sources_parent_id_level_sources_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."level_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_sources" ADD CONSTRAINT "level_sources_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "level_ratings_external" ON "level_ratings" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "level_sources_url" ON "level_sources" USING btree ("url");