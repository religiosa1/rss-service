import z from "zod";
import { slugSchema } from "./slug.ts";
import { FEED_ITEM_DESC_LENGTH, FEED_ITEM_TITLE_LENGTH, URL_LENGTH } from "../constants.ts";

export const feedItemPreviewSchema = z.object({
	id: z.number().int().positive(),
	slug: slugSchema,
	title: z.string().max(FEED_ITEM_TITLE_LENGTH),
});

export const feedItemUpdateSchema = z.object({
	slug: slugSchema,
	title: z.string().max(FEED_ITEM_TITLE_LENGTH),
	description: z.string().max(FEED_ITEM_DESC_LENGTH),
	content: z.string(),
	date: z.date({ coerce: true }),
	image: z.string().url().max(URL_LENGTH),
	// TODO: authors and contributors
});

export const feedItemSchema = feedItemUpdateSchema.extend({
	id: z.number().int().positive(),
	link: z.string().url(),
	createdAt: z.date(),
	modifiedAt: z.date(),
});
