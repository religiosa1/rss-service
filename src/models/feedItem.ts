import z from "zod";
import { slugSchema } from "./slug.ts";
import { authorScheme } from "./author.ts";
import { FEED_ITEM_DESC_LENGTH, FEED_ITEM_TITLE_LENGTH, URL_LENGTH } from "../constants.ts";

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
