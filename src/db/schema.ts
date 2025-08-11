import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import {
	COPYRIGHT_LENGTH,
	FEED_DESC_LENGTH,
	FEED_ITEM_DESC_LENGTH,
	FEED_ITEM_TITLE_LENGTH,
	FEED_TITLE_LENGTH,
	SLUG_LENGTH,
	URL_LENGTH,
} from "../constants.ts";

export const feed = sqliteTable("feed", {
	id: integer().primaryKey(),
	slug: text({ length: SLUG_LENGTH }).unique().notNull(),
	title: text({ length: FEED_TITLE_LENGTH }).notNull(),
	description: text({ length: FEED_DESC_LENGTH }).notNull(),
	image: text({ length: URL_LENGTH }),
	favicon: text({ length: URL_LENGTH }),
	copyright: text({ length: COPYRIGHT_LENGTH }),
	// TODO: author
	createdAt: integer({ mode: "timestamp_ms" }).notNull(),
	modifiedAt: integer({ mode: "timestamp_ms" }).notNull(),
});

export const feedItem = sqliteTable(
	"feed_item",
	{
		id: integer().primaryKey(),
		feedId: integer().references(() => feed.id, { onDelete: "cascade", onUpdate: "cascade" }),
		slug: text({ length: SLUG_LENGTH }).notNull(),
		title: text({ length: FEED_ITEM_TITLE_LENGTH }).notNull(),
		description: text({ length: FEED_ITEM_DESC_LENGTH }).notNull(),
		content: text().notNull(),
		date: integer({ mode: "timestamp_ms" }).notNull(),
		image: text({ length: URL_LENGTH }),
		// TODO: authors and contributors
		createdAt: integer({ mode: "timestamp_ms" }).notNull(),
		modifiedAt: integer({ mode: "timestamp_ms" }).notNull(),
	},
	(t) => [unique().on(t.feedId, t.slug)]
);
