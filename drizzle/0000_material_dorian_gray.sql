CREATE TABLE `museums` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`subtitle` text NOT NULL,
	`lens` text NOT NULL,
	`source_key` text NOT NULL,
	`render_key` text NOT NULL,
	`exhibits_json` text NOT NULL,
	`created_at` integer NOT NULL
);
