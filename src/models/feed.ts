import z from "zod";
import { slugSchema } from "./slug.ts";
import { FEED_DESC_LENGTH, FEED_TITLE_LENGTH, URL_LENGTH } from "../constants.ts";

export const feedPreviewSchema = z.object({
	id: z.number().int().positive(),
	slug: slugSchema,
	title: z.string().max(FEED_TITLE_LENGTH),
	updatedAt: z.date().describe("Datetime of the latest entry in the feed"),
});

export const feedUpdateSchema = z.object({
	slug: slugSchema,
	title: z.string().max(FEED_TITLE_LENGTH),
	description: z.string().max(FEED_DESC_LENGTH),
	image: z.string().url().max(URL_LENGTH),
	favicon: z.string().url().max(URL_LENGTH),
	copyright: z.string().max(512),
});

export const feedSchema = feedUpdateSchema.extend({
	id: z.number().int().positive(),
	link: z.string().url(),
	updatedAt: z.date().describe("Datetime of the latest entry in the feed"),
	createdAt: z.date().describe("Date of feed creation"),
	modifiedAt: z.date().describe("Date of feed fields last modification"),
});
