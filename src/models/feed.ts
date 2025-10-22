import z from "zod";

import { FEED_DESC_LENGTH, FEED_TITLE_LENGTH, URL_LENGTH } from "../constants.ts";
import { authorScheme } from "./author.ts";
import { slugSchema } from "./slug.ts";

export const feedUpdateSchema = z
	.object({
		slug: slugSchema,
		title: z.string().max(FEED_TITLE_LENGTH),
		description: z.string().max(FEED_DESC_LENGTH).nullish(),
		image: z.url().max(URL_LENGTH).nullish(),
		favicon: z.url().max(URL_LENGTH).nullish(),
		language: z.string().min(2).max(128).nullish().describe("ISO 639 language or IETF language tag of the feed"),
		copyright: z.string().max(512).nullish(),
		author: authorScheme.nullish(),
	})
	.meta({
		ref: "FeedUpdateSchema",
	});
export type FeedUpdateModel = z.infer<typeof feedUpdateSchema>;

export const feedSchema = feedUpdateSchema
	.extend({
		id: z.number().int().positive(),
		link: z.string().url(),
		updatedAt: z.iso.datetime().describe("Datetime of the latest entry in the feed"),
		createdAt: z.iso.datetime().describe("Date of feed creation"),
		modifiedAt: z.iso.datetime().describe("Date of feed fields last modification"),
	})
	.meta({
		ref: "FeedSchema",
	});
export type FeedModel = z.infer<typeof feedSchema>;
