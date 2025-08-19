import z from "zod";
import { FEED_ITEM_DESC_LENGTH, FEED_ITEM_TITLE_LENGTH, URL_LENGTH } from "../constants.ts";
import { deepEqual } from "../utils/deepEqual.ts";
import { authorScheme } from "./author.ts";
import { slugSchema } from "./slug.ts";

export const feedItemUpdateSchema = z.object({
	slug: slugSchema,
	title: z.string().max(FEED_ITEM_TITLE_LENGTH),
	date: z.date({ coerce: true }),
	link: z.string().url(),
	description: z.string().max(FEED_ITEM_DESC_LENGTH).nullish(),
	content: z.string().nullish(),
	image: z.string().url().max(URL_LENGTH).nullish(),
	authors: z.array(authorScheme).nullish(),
	contributors: z.array(authorScheme).nullish(),
});
export type FeedItemUpdateModel = z.infer<typeof feedItemUpdateSchema>;

export const feedItemSchema = feedItemUpdateSchema.extend({
	id: z.number().int().positive(),
	createdAt: z.date(),
	modifiedAt: z.date(),
});
export type FeedItemModel = z.infer<typeof feedItemSchema>;

export const multiUpsertSchema = z.object({
	inserted: z.array(feedItemSchema),
	updated: z.array(feedItemSchema),
	withoutChange: z.array(feedItemSchema),
});
export type MultiUpsertModel = z.infer<typeof multiUpsertSchema>;

/**
 * Check if two feed items are deep equal, considering optionality of some of the fields and not
 * considering meta info, such as createdAt and modifiedAt.
 */
export function isFeedItemsValueEqual(
	source: FeedItemUpdateModel,
	target: FeedItemUpdateModel | FeedItemModel
): boolean {
	if (source.slug !== target.slug) return false;
	if (source.title !== target.title) return false;
	if (source.date.getTime() !== target.date.getTime()) return false;
	if (source.link !== target.link) return false;
	// optional fields
	if (source.content !== undefined && source.content !== (target.content ?? null)) return false;
	if (source.description !== undefined && source.description !== (target.description ?? null)) return false;
	if (source.image !== undefined && source.image !== (target.image ?? null)) return false;
	if (source.authors !== undefined && !deepEqual(source.authors, target.authors ?? null)) return false;
	if (source.contributors !== undefined && !deepEqual(source.contributors, target.contributors ?? null)) return false;
	return true;
}
