import z from "zod";
import { slugSchema } from "./slug.ts";
import { authorScheme } from "./author.ts";
import { FEED_DESC_LENGTH, FEED_TITLE_LENGTH, URL_LENGTH } from "../constants.ts";

export const feedUpdateSchema = z.object({
	slug: slugSchema,
	title: z.string().max(FEED_TITLE_LENGTH),
	description: z.string().max(FEED_DESC_LENGTH),
	image: z.string().url().max(URL_LENGTH).nullish(),
	favicon: z.string().url().max(URL_LENGTH).nullish(),
	language: z
		.string()
		.min(2)
		.max(128)
		.nullable()
		.optional()
		.describe("ISO 639 language or IETF language tag of the feed"),
	copyright: z.string().max(512).nullish(),
	author: authorScheme.nullish(),
});
export type FeedUpdateModel = z.infer<typeof feedUpdateSchema>;

export const feedSchema = feedUpdateSchema.extend({
	id: z.number().int().positive(),
	link: z.string().url(),
	updatedAt: z.date().describe("Datetime of the latest entry in the feed"),
	createdAt: z.date().describe("Date of feed creation"),
	modifiedAt: z.date().describe("Date of feed fields last modification"),
});
export type FeedModel = z.infer<typeof feedSchema>;
