CREATE TABLE `sales_records` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`archived` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sales_records_business_kind` ON `sales_records` (`business_id`,`kind`);--> statement-breakpoint
ALTER TABLE `events` ADD `lifecycle` text DEFAULT 'Active' NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `tip` integer DEFAULT 0 NOT NULL;