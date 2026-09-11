CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`category` text NOT NULL,
	`note` text NOT NULL,
	`amount` integer NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `expenses_day_created` ON `expenses` (`day`,`created_at`);
