ALTER TABLE `museums` ADD `status` text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE `museums` ADD `render_response_id` text;--> statement-breakpoint
ALTER TABLE `museums` ADD `curation_response_id` text;--> statement-breakpoint
ALTER TABLE `museums` ADD `error` text;