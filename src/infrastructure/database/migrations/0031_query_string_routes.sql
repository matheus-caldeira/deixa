UPDATE "notifications" SET "href" = regexp_replace("href", '^/read/([^/?]+)\?(.*)$', '/read?id=\1&\2') WHERE "href" ~ '^/read/[^/?]+\?';--> statement-breakpoint
UPDATE "notifications" SET "href" = regexp_replace("href", '^/read/([^/?]+)$', '/read?id=\1') WHERE "href" ~ '^/read/[^/?]+$';--> statement-breakpoint
UPDATE "notifications" SET "href" = regexp_replace("href", '^/tutor/([^/?]+)$', '/tutor/chat?id=\1') WHERE "href" ~ '^/tutor/[^/?]+$';
