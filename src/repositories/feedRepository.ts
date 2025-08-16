import { getTableColumns, eq, sql } from "drizzle-orm";
import { db, schema } from "../db/index.ts";
import type { FeedModel, FeedUpdateModel } from "../models/feed.ts";
import { mapDbError, raise } from "../utils/errors.ts";
import { generateFeedLink } from "../utils/generateFeedLink.ts";

export async function listFeeds(): Promise<FeedModel[]> {
	const data = await getFeedFromDb();
	return data.map(dbItemToFeedModel);
}

export async function readFeed(feedSlug: string): Promise<FeedModel | undefined> {
	const item = await getFeedFromDb().where(eq(schema.feed.slug, feedSlug)).get();
	return item ? dbItemToFeedModel(item) : undefined;
}

export async function createFeed(values: FeedUpdateModel): Promise<FeedModel> {
	const ts = new Date();
	await db
		.insert(schema.feed)
		.values({
			...values,
			createdAt: ts,
			modifiedAt: ts,
		})
		.catch(mapDbError);
	return (await readFeed(values.slug)) ?? raise(500, "Unable to retrieve modified feed from DB");
}

export async function updateFeed(feedSlug: string, values: Partial<FeedUpdateModel>): Promise<FeedModel> {
	const { rowsAffected } = await db
		.update(schema.feed)
		.set({
			...values,
			modifiedAt: new Date(),
		})
		.where(eq(schema.feed.slug, feedSlug))
		.catch(mapDbError);
	if (rowsAffected === 0) {
		raise(404, `Unable to find the required slug: ${feedSlug}`);
	}
	return (await readFeed(values.slug ?? feedSlug)) ?? raise(500, "Unable to retrieve modified feed from DB");
}

export async function deleteFeed(feedSlug: string): Promise<void> {
	const { rowsAffected } = await db.delete(schema.feed).where(eq(schema.feed.slug, feedSlug));
	if (rowsAffected === 0) {
		raise(404, `Unable to find the required slug: ${feedSlug}`);
	}
}

type FeedDbModel = typeof schema.feed.$inferSelect & { updatedAt: number };
function getFeedFromDb() {
	return db
		.select({
			...getTableColumns(schema.feed),
			updatedAt: sql<number>`
				COALESCE(
					MAX(${schema.feedItem.date}) OVER (PARTITION BY ${schema.feedItem.feedId}),
					${schema.feed.createdAt}
				)
			`.as("updatedAt"),
		})
		.from(schema.feed)
		.leftJoin(schema.feedItem, eq(schema.feedItem.feedId, schema.feed.id));
}

function dbItemToFeedModel(item: FeedDbModel): FeedModel {
	return {
		...item,
		link: generateFeedLink(item.slug),
		updatedAt: new Date(item.updatedAt),
	};
}
