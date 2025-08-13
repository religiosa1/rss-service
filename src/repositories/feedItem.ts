import { and, eq, desc, notInArray } from "drizzle-orm";
import { MAX_FEED_ITEMS, MAX_FEED_ITEMS_ARCHIVED } from "../constants.ts";
import { db, schema } from "../db/index.ts";
import type { FeedItemModel, FeedItemUpdateModel } from "../models/feedItem.ts";
import { mapDbError, raise } from "../utils/errors.ts";

export async function getFeedItems(feedSlug: string): Promise<FeedItemModel[]> {
	const feedId = await getFeedIdBySlug(feedSlug);
	const items = await getFeedItemsDbQuery(feedId).limit(MAX_FEED_ITEMS);
	return items;
}

export async function getArchivedFeedItems(feedSlug: string): Promise<FeedItemModel[]> {
	const feedId = await getFeedIdBySlug(feedSlug);
	// offset without limit is invalid sqlite expression, but drizzle filters out limit(-1)
	const items = await getFeedItemsDbQuery(feedId).limit(Number.MAX_SAFE_INTEGER).offset(MAX_FEED_ITEMS);
	return items;
}

export async function createFeedItem(feedSlug: string, values: FeedItemUpdateModel): Promise<FeedItemModel> {
	const ts = new Date();

	return await db.transaction(async (tx) => {
		const feedId = await getFeedIdBySlug(feedSlug, tx);
		const { rowsAffected } = await tx
			.insert(schema.feedItem)
			.values({
				...values,
				feedId,
				createdAt: ts,
				modifiedAt: ts,
			})
			.catch(mapDbError);
		if (rowsAffected === 0) {
			raise(404, `Unable to find the required slug: ${values.slug} in feed ${feedSlug}`);
		}

		// Removing older items from archive
		await tx.delete(schema.feedItem).where(
			and(
				eq(schema.feedItem.feedId, feedId),
				notInArray(
					schema.feedItem.id,
					tx
						.select({ id: schema.feedItem.id })
						.from(schema.feedItem)
						.where(eq(schema.feedItem.feedId, feedId))
						.orderBy(desc(schema.feedItem.date), schema.feedItem.id)
						.limit(MAX_FEED_ITEMS + MAX_FEED_ITEMS_ARCHIVED)
				)
			)
		);
		return await readModifiedFeedItem(feedId, values.slug, tx);
	});
}

export async function updateFeedItem(
	feedSlug: string,
	feedItemSlug: string,
	values: Partial<FeedItemUpdateModel>
): Promise<FeedItemModel> {
	const feedId = await getFeedIdBySlug(feedSlug);
	const { rowsAffected } = await db
		.update(schema.feedItem)
		.set(values)
		.where(and(eq(schema.feedItem.feedId, feedId), eq(schema.feedItem.slug, feedItemSlug)))
		.catch(mapDbError);
	if (rowsAffected === 0) {
		raise(404, `Unable to find the required slug: ${feedItemSlug} in feed ${feedSlug}`);
	}
	return await readModifiedFeedItem(feedId, values.slug ?? feedItemSlug);
}

export async function deleteFeedItem(feedSlug: string, feedItemSlug: string): Promise<void> {
	const feedId = await getFeedIdBySlug(feedSlug);
	const { rowsAffected } = await db.delete(schema.feedItem).where(
		and(
			eq(schema.feedItem.feedId, feedId), //
			eq(schema.feedItem.slug, feedItemSlug)
		)
	);
	if (rowsAffected === 0) {
		raise(404, `Unable to find the required slug: ${feedItemSlug} in feed ${feedSlug}`);
	}
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
			.get()) ?? raise(404, "Unable to find feed with the provided slug");
	return id;
}

type FeedItemDbModel = typeof schema.feedItem.$inferSelect;
async function readModifiedFeedItem(feedId: number, slug: string, tx: MaybeTransaction = db): Promise<FeedItemDbModel> {
	const item =
		(await tx
			.select()
			.from(schema.feedItem)
			.where(and(eq(schema.feedItem.feedId, feedId), eq(schema.feedItem.slug, slug)))
			.get()) ?? raise(500, "Unable to retrieve modified feed item from DB");
	return item;
}

function getFeedItemsDbQuery(feedId: number) {
	return db
		.select()
		.from(schema.feedItem)
		.where(eq(schema.feedItem.feedId, feedId))
		.orderBy(desc(schema.feedItem.date), schema.feedItem.id);
}
