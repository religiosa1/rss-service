import { desc } from "drizzle-orm/sql";
import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import type { AuthorModel } from "../models/author.ts";

export const feed = sqliteTable("feed", {
	id: integer().primaryKey(),
	slug: text().unique().notNull(),
	title: text().notNull(),
	description: text().notNull(),
	image: text(),
	favicon: text(),
	language: text(),
	copyright: text(),
	author: text({ mode: "json" }).$type<AuthorModel>(),
	createdAt: integer({ mode: "timestamp_ms" }).notNull(),
	modifiedAt: integer({ mode: "timestamp_ms" }).notNull(),
});

export const feedItem = sqliteTable(
	"feed_item",
	{
		id: integer().primaryKey(),
		feedId: integer()
			.notNull()
			.references(() => feed.id, { onDelete: "cascade", onUpdate: "cascade" }),
		slug: text().notNull(),
		title: text().notNull(),
		description: text().notNull(),
		content: text().notNull(),
		date: integer({ mode: "timestamp_ms" }).notNull(),
		image: text(),
		link: text().notNull(),
		authors: text({ mode: "json" }).$type<AuthorModel[]>(),
		contributors: text({ mode: "json" }).$type<AuthorModel[]>(),
		createdAt: integer({ mode: "timestamp_ms" }).notNull(),
		modifiedAt: integer({ mode: "timestamp_ms" }).notNull(),
	},
	(t) => [
		unique().on(t.feedId, t.slug), //
		index("idx_feed_item_by_date").on(t.feedId, desc(t.date)),
	]
);
