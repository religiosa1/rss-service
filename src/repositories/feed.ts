import { getTableColumns, eq, sql } from "drizzle-orm";
import { db, schema } from "../db/index.ts";
import type { FeedModel, FeedUpdateModel } from "../models/feed.ts";
import { publicUrl } from "../globalContext.ts";
import { raise } from "../utils/raise.ts";

// TODO sql errors handling and conversion to http errors;

export async function listFeeds(): Promise<FeedModel[]> {
	const data = await getFeedFromDb();
	return data.map(dbItemToFeedModel);
}

export async function readFeed(feedSlug: string): Promise<FeedModel> {
	const item = await getFeedFromDb().where(eq(schema.feed.slug, feedSlug)).get();
	return dbItemToFeedModel(item ?? raise("Unable to retrieve item"));
}

export async function createFeed(values: FeedUpdateModel): Promise<FeedModel> {
	const ts = new Date();
	await db.insert(schema.feed).values({
		...values,
		createdAt: ts,
		modifiedAt: ts,
	});
	return readFeed(values.slug);
}

export async function updateFeed(feedSlug: string, values: Partial<FeedUpdateModel>): Promise<FeedModel> {
	await db.update(schema.feed).set(values).where(eq(schema.feed.slug, feedSlug));
	return readFeed(feedSlug);
}

export async function deleteFeed(feedSlug: string): Promise<void> {
	await db.delete(schema.feed).where(eq(schema.feed.slug, feedSlug));
}

type FeebDbModel = typeof schema.feed.$inferSelect & { updatedAt: number };
function getFeedFromDb() {
	return db
		.select({
			...getTableColumns(schema.feed),
			updatedAt: sql<number>`
				COALESCE(
					MAX(${schema.feedItem.date}) OVER (PARTITION BY ${schema.feedItem.feedId}),
					${schema.feed.modifiedAt}
				)
			`.as("updatedAt"),
		})
		.from(schema.feed)
		.leftJoin(schema.feedItem, eq(schema.feedItem.feedId, schema.feed.id));
}

function dbItemToFeedModel(item: FeebDbModel): FeedModel {
	return {
		...item,
		link: new URL(`/${encodeURIComponent(item.slug)}`, publicUrl).toString(),
		updatedAt: new Date(item.updatedAt),
	};
}
