import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import { MAX_FEED_ITEMS, MAX_FEED_ITEMS_ARCHIVED } from "../constants.ts";
import { db, schema } from "../db/index.ts";
import { type FeedItemModel, type FeedItemUpdateModel, isFeedItemsValueEqual } from "../models/feedItem.ts";
import { mapDbError, raise } from "../utils/errors.ts";
import { partition } from "../utils/partition.ts";

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
	const feedId = await getFeedIdBySlug(feedSlug);
	return await db.transaction(async (tx) => {
		const item = await tx
			.insert(schema.feedItem)
			.values({
				...values,
				feedId,
				createdAt: ts,
				modifiedAt: ts,
			})
			.returning()
			.get()
			.catch(mapDbError);
		if (!item) {
			raise(404, `Unable to find the required slug: ${values.slug} in feed ${feedSlug}`);
		}
		await removeOldArchivedItems(feedId, tx);
		return item;
	});
}

export async function updateFeedItem(
	feedSlug: string,
	feedItemSlug: string,
	values: Partial<FeedItemUpdateModel>
): Promise<FeedItemModel> {
	const feedId = await getFeedIdBySlug(feedSlug);
	const item = await db
		.update(schema.feedItem)
		.set(values)
		.where(and(eq(schema.feedItem.feedId, feedId), eq(schema.feedItem.slug, feedItemSlug)))
		.returning()
		.get()
		.catch(mapDbError);
	return item ?? raise(404, `Unable to find the required slug: ${feedItemSlug} in feed ${feedSlug}`);
}

export async function upsertMultipleFeedItems(
	feedSlug: string,
	items: FeedItemUpdateModel[]
): Promise<FeedItemModel[]> {
	items = items.slice(0, MAX_FEED_ITEMS);
	if (!items.length) {
		return [];
	}

	assertSlugUniqueness(items);

	const ts = new Date();
	const feedId = await getFeedIdBySlug(feedSlug);
	const existingDbItemsMap = await getDbItemsMap(
		feedId,
		items.map((i) => i.slug)
	);

	const [payloadItemsInDb, payloadItemsToInsert] = partition(items, (payloadItem) =>
		existingDbItemsMap.has(payloadItem.slug)
	);
	const [payloadItemsWithoutChange, payloadItemsToUpdate] = partition(payloadItemsInDb, (payloadItem) => {
		const dbItem = existingDbItemsMap.get(payloadItem.slug) ?? raise(500, "change/no change partition assertion");
		return isFeedItemsValueEqual(dbItem, payloadItem);
	});

	const [insertedItems, updatedItems] = await db.transaction(async (tx) => {
		const insertedItems = await tx
			.insert(schema.feedItem)
			.values(
				payloadItemsToInsert.map((item) => ({
					...item,
					feedId,
					createdAt: ts,
					modifiedAt: ts,
				}))
			)
			.returning();

		const updatedItems: FeedItemModel[] = await Array.fromAsync(payloadItemsToUpdate, (item) =>
			tx
				.update(schema.feedItem)
				.set({
					...item,
					modifiedAt: ts,
				})
				.where(and(eq(schema.feedItem.feedId, feedId), eq(schema.feedItem.slug, item.slug)))
				.returning()
				.get()
		);
		await removeOldArchivedItems(feedId, tx);
		return [insertedItems, updatedItems];
	});

	const dbItemsWithoutChange = payloadItemsWithoutChange.map(
		(item) => existingDbItemsMap.get(item.slug) ?? raise(500, "no change extraction assertion")
	);

	return [...insertedItems, ...updatedItems, ...dbItemsWithoutChange];
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

export async function deleteAllFeedItems(feedSlug: string): Promise<number> {
	const feedId = await getFeedIdBySlug(feedSlug);
	const { rowsAffected } = await db.delete(schema.feedItem).where(eq(schema.feedItem.feedId, feedId));
	return rowsAffected;
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
			.get()) ?? {};
	return id ?? raise(404, "Unable to find feed with the provided slug");
}

function getFeedItemsDbQuery(feedId: number) {
	return db
		.select()
		.from(schema.feedItem)
		.where(eq(schema.feedItem.feedId, feedId))
		.orderBy(desc(schema.feedItem.date), schema.feedItem.id);
}

async function removeOldArchivedItems(feedId: number, tx: MaybeTransaction = db): Promise<void> {
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
}

async function getDbItemsMap(feedId: number, feedItemSlugs: string[]): Promise<Map<string, FeedItemModel>> {
	const dbItems = await db
		.select()
		.from(schema.feedItem)
		.where(and(eq(schema.feedItem.feedId, feedId), inArray(schema.feedItem.slug, feedItemSlugs)))
		.all();
	return new Map(dbItems.map((item) => [item.slug, item]));
}

function assertSlugUniqueness(items: Array<{ slug: string }>): void {
	const itemsBySlug = Map.groupBy(items, (i) => i.slug);
	for (const [slug, group] of itemsBySlug) {
		if (group.length !== 1) {
			raise(409, `slug ${slug} is not unique among the provided items and is present ${group.length} times`);
		}
	}
}
