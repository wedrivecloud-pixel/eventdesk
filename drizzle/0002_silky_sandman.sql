CREATE TABLE `package_images` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`package_id` text NOT NULL,
	`is_primary` integer DEFAULT 0 NOT NULL,
	`alt` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_package_images_owner` ON `package_images` (`business_id`,`package_id`);--> statement-breakpoint
ALTER TABLE `packages` ADD `settings` text DEFAULT '{}' NOT NULL;