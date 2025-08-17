import z from "zod";
import { FEED_ITEM_DESC_LENGTH, FEED_ITEM_TITLE_LENGTH, URL_LENGTH } from "../constants.ts";
import { deepEqual } from "../utils/deepEqual.ts";
import { authorScheme } from "./author.ts";
import { slugSchema } from "./slug.ts";

export const feedItemUpdateSchema = z.object({
	slug: slugSchema,
	title: z.string().max(FEED_ITEM_TITLE_LENGTH),
	description: z.string().max(FEED_ITEM_DESC_LENGTH),
	content: z.string(),
	date: z.date({ coerce: true }),
	link: z.string().url(),
	image: z.string().url().max(URL_LENGTH).nullish(),
	authors: z.array(authorScheme).nullish(),
	contributors: z.array(authorScheme).nullish(),
});
export type FeedItemUpdateModel = z.infer<typeof feedItemUpdateSchema>;

export const feedItemSchema = feedItemUpdateSchema.extend({
	id: z.number().int().positive(),
	link: z.string().url(),
	createdAt: z.date(),
	modifiedAt: z.date(),
});
export type FeedItemModel = z.infer<typeof feedItemSchema>;

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
	if (source.description !== target.description) return false;
	if (source.content !== target.content) return false;
	if (source.date.getTime() !== target.date.getTime()) return false;
	if (source.link !== target.link) return false;
	// optional fields
	if (source.image !== undefined && target.image != null && source.image !== target.image) return false;
	if (source.authors !== undefined && target.authors != null && !deepEqual(source.authors, target.authors))
		return false;
	if (
		source.contributors !== undefined &&
		target.contributors != null &&
		!deepEqual(source.contributors, target.contributors)
	)
		return false;
	return true;
}
