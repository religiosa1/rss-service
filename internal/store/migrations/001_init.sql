-- Schema of the original drizzle migration (0000_ancient_vin_gonzales).
-- IF NOT EXISTS makes it a no-op on databases created by the node.js version,
-- which only bumps their user_version. Their __drizzle_migrations table is
-- left untouched.
CREATE TABLE IF NOT EXISTS `feed` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`image` text,
	`favicon` text,
	`language` text,
	`copyright` text,
	`author` text,
	`created_at` integer NOT NULL,
	`modified_at` integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `feed_slug_unique` ON `feed` (`slug`);

CREATE TABLE IF NOT EXISTS `feed_item` (
	`id` integer PRIMARY KEY NOT NULL,
	`feed_id` integer NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`date` integer NOT NULL,
	`link` text NOT NULL,
	`description` text,
	`content` text,
	`image` text,
	`authors` text,
	`contributors` text,
	`created_at` integer NOT NULL,
	`modified_at` integer NOT NULL,
	FOREIGN KEY (`feed_id`) REFERENCES `feed`(`id`) ON UPDATE cascade ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `idx_feed_item_by_date` ON `feed_item` (`feed_id`, "date" desc);
CREATE UNIQUE INDEX IF NOT EXISTS `feed_item_feedId_slug_unique` ON `feed_item` (`feed_id`, `slug`);
