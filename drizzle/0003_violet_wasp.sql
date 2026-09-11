CREATE TABLE `booking_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`hits` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_booking_rate_expiry` ON `booking_rate_limits` (`expires_at`);