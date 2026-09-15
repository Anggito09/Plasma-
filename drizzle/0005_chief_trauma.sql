ALTER TABLE `orders` ADD `discount_rp` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `service_rp` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `tax_rp` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `img` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `target_food_min` integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `target_drink_min` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `tax_pct` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `service_pct` integer DEFAULT 0 NOT NULL;