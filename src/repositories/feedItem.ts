import { and, eq, desc, inArray } from "drizzle-orm";
import { MAX_FEED_ITEMS, MAX_FEED_ITEMS_ARCHIVED } from "../constants.ts";
import { db, schema } from "../db/index.ts";
import type { FeedItemModel, FeedItemUpdateModel } from "../models/feedItem.ts";
import { raise } from "../utils/raise.ts";

export async function listFeedItems(feedSlug: string): Promise<FeedItemModel[]> {
	const feedId = await getFeedIdBySlug(feedSlug);
	return await db
		.select()
		.from(schema.feedItem)
		.where(eq(schema.feedItem.feedId, feedId))
		.orderBy(desc(schema.feedItem.date), schema.feedItem.id)
		.limit(MAX_FEED_ITEMS);
}

export async function createFeedItem(feedSlug: string, values: FeedItemUpdateModel): Promise<FeedItemModel> {
	const ts = new Date();
	return await db.transaction(async (tx) => {
		const feedId = await getFeedIdBySlug(feedSlug, tx);
		await tx.insert(schema.feedItem).values({
			...values,
			feedId,
			createdAt: ts,
			modifiedAt: ts,
		});

		// Removing older items from archive
		await tx.delete(schema.feedItem).where(
			inArray(
				schema.feedItem.id,
				tx
					.select({ id: schema.feedItem.id })
					.from(schema.feedItem)
					.where(eq(schema.feedItem.feedId, feedId))
					.orderBy(desc(schema.feedItem.date), schema.feedItem.id)
					.offset(MAX_FEED_ITEMS + MAX_FEED_ITEMS_ARCHIVED)
			)
		);
		const newItem = await readFeedItem(feedId, values.slug);
		return dbItemToFeedModel(feedSlug, newItem);
	});
}

export async function updateFeedItem(
	feedSlug: string,
	feedItemSlug: string,
	values: Partial<FeedItemUpdateModel>
): Promise<FeedItemModel> {
	const feedId = await getFeedIdBySlug(feedSlug);
	await db
		.update(schema.feedItem)
		.set(values)
		.where(and(eq(schema.feedItem.feedId, feedId), eq(schema.feedItem.slug, feedItemSlug)));
	const item = await readFeedItem(feedId, feedItemSlug);
	return dbItemToFeedModel(feedSlug, item);
}

export async function deleteFeedItem(feedSlug: string, feedItemSlug: string): Promise<void> {
	const feedId = await getFeedIdBySlug(feedSlug);
	await db.delete(schema.feedItem).where(
		and(
			eq(schema.feedItem.feedId, feedId), //
			eq(schema.feedItem.slug, feedItemSlug)
		)
	);
}

/** @see https://github.com/drizzle-team/drizzle-orm/discussions/3271 */
type Transaction = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];
type MaybeTransaction = Transaction | typeof db;
async function getFeedIdBySlug(feedSlug: string, tx: MaybeTransaction = db): Promise<number> {
	const { id } =
		(await tx
			.select({
				id: schema.feed.id,
			})
			.from(schema.feed)
			.where(eq(schema.feed.slug, feedSlug))
			.get()) ?? raise("Unable to find feed with the provided slug");
	return id;
}

type FeedItemDbModel = typeof schema.feedItem.$inferSelect;
async function readFeedItem(feedId: number, slug: string, tx: MaybeTransaction = db): Promise<FeedItemDbModel> {
	const item =
		(await tx
			.select()
			.from(schema.feedItem)
			.where(and(eq(schema.feedItem.feedId, feedId), eq(schema.feedItem.slug, slug)))
			.get()) ?? raise("Unable to find feed with provided slug and feedId");
	return item;
}

function dbItemToFeedModel(feedSlug: string, item: FeedItemDbModel): FeedItemModel {
	return {
		...item,
		link: new URL(`/feed/${encodeURIComponent(feedSlug)}/items/${encodeURIComponent(item.slug)}`).toString(),
	};
}
