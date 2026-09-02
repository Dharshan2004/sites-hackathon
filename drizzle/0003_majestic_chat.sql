CREATE TABLE `generation_limits` (
	`bucket` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `museums` ADD `alt_text` text DEFAULT 'An isometric miniature museum generated from an uploaded photograph.' NOT NULL;