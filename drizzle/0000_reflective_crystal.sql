CREATE TABLE `feed` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`image` text,
	`favicon` text,
	`language` text,
	`copyright` text,
	`author` text,
	`created_at` integer NOT NULL,
	`modified_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feed_slug_unique` ON `feed` (`slug`);--> statement-breakpoint
CREATE TABLE `feed_item` (
	`id` integer PRIMARY KEY NOT NULL,
	`feed_id` integer NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`content` text NOT NULL,
	`date` integer NOT NULL,
	`image` text,
	`link` text NOT NULL,
	`authors` text,
	`contributors` text,
	`created_at` integer NOT NULL,
	`modified_at` integer NOT NULL,
	FOREIGN KEY (`feed_id`) REFERENCES `feed`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_feed_item_by_date` ON `feed_item` (`feed_id`,"date" desc);--> statement-breakpoint
CREATE UNIQUE INDEX `feed_item_feedId_slug_unique` ON `feed_item` (`feed_id`,`slug`);