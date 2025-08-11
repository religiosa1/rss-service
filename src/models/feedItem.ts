import z from "zod";
import { slugSchema } from "./slug.ts";
import { FEED_ITEM_DESC_LENGTH, FEED_ITEM_TITLE_LENGTH, URL_LENGTH } from "../constants.ts";

export const feedItemPreviewSchema = z.object({
	id: z.number().int().positive(),
	slug: slugSchema,
	title: z.string().max(FEED_ITEM_TITLE_LENGTH),
});
export type FeedItemPreviewModel = z.infer<typeof feedItemPreviewSchema>;

export const feedItemUpdateSchema = z.object({
	slug: slugSchema,
	title: z.string().max(FEED_ITEM_TITLE_LENGTH),
	description: z.string().max(FEED_ITEM_DESC_LENGTH),
	content: z.string(),
	date: z.date({ coerce: true }),
	image: z.string().url().max(URL_LENGTH).nullable().optional(),
	// TODO: authors and contributors
});
export type FeedItemUpdateModel = z.infer<typeof feedItemUpdateSchema>;

export const feedItemSchema = feedItemUpdateSchema.extend({
	id: z.number().int().positive(),
	link: z.string().url(),
	createdAt: z.date(),
	modifiedAt: z.date(),
});
export type FeedItemModel = z.infer<typeof feedItemSchema>;
