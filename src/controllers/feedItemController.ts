import { Hono } from "hono";
import z from "zod";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { feedItemSchema, feedItemUpdateSchema } from "../models/feedItem.ts";
import { slugSchema } from "../models/slug.ts";
import { apiKeyAuthSecurity } from "../models/apiKeyAuthSecurity.ts";
import { apiKeyAuth } from "../middleware/apiKeyAuth.ts";
import * as feedItemRepository from "../repositories/feedItem.ts";

export const feedItemController = new Hono();

const tags = ["feed-item"];

feedItemController.get(
	"/",
	describeRoute({
		summary: "Get list of feed items",
		operationId: "getListOfFeedItems",
		tags,
		responses: {
			200: {
				description: "Successful response",
			},
			400: {
				description: "Bad request",
			},
			404: {
				description: "Feed with the provided slug doesn't exist",
			},
		},
	}),
	validator(
		"param",
		z.object({
			feedSlug: slugSchema,
		})
	),
	async (c) => {
		const { feedSlug } = c.req.valid("param");
		const data = await feedItemRepository.listFeedItems(feedSlug);
		c.json(data);
	}
);

feedItemController.post(
	"/",
	describeRoute({
		summary: "Create a new entry in the feed",
		operationId: "createFeedItem",
		tags,
		security: apiKeyAuthSecurity,
		responses: {
			201: {
				description: "Created",
				content: {
					"application/json": { schema: resolver(feedItemSchema) },
				},
			},
			400: {
				description: "Bad request",
			},
			404: {
				description: "Feed with the provided slug doesn't exist",
			},
		},
	}),
	apiKeyAuth,
	validator(
		"param",
		z.object({
			feedSlug: slugSchema,
		})
	),
	validator("json", feedItemUpdateSchema),
	async (c) => {
		const { feedSlug } = c.req.valid("param");
		const payload = c.req.valid("json");
		const item = await feedItemRepository.createFeedItem(feedSlug, payload);
		c.json(item, 201);
	}
);

feedItemController.patch(
	"/:feedItemSlug",
	describeRoute({
		summary: "Update a feed entry item",
		operationId: "updateFeedItem",
		tags,
		security: apiKeyAuthSecurity,
		responses: {
			200: {
				description: "Successful response",
				content: {
					"application/json": { schema: resolver(feedItemSchema) },
				},
			},
			400: {
				description: "Bad request",
			},
			404: {
				description: "Feed or entry with the provided slug doesn't exist",
			},
			409: {
				description: "Updated slug value already exists in the feed",
			},
		},
	}),
	apiKeyAuth,
	validator(
		"param",
		z.object({
			feedSlug: slugSchema,
			feedItemSlug: slugSchema,
		})
	),
	validator("json", feedItemUpdateSchema.partial()),
	async (c) => {
		const { feedSlug, feedItemSlug } = c.req.valid("param");
		const payload = c.req.valid("json");
		const item = await feedItemRepository.updateFeedItem(feedSlug, feedItemSlug, payload);
		c.json(item);
	}
);

feedItemController.delete(
	"/:feedItemSlug",
	describeRoute({
		summary: "Delete an existing feed entry item",
		operationId: "deleteFeedItem",
		tags,
		security: apiKeyAuthSecurity,
		responses: {
			204: {
				description: "Deleted",
			},
			400: {
				description: "Bad request",
			},
			404: {
				description: "Feed or entry with the provided slug doesn't exist",
			},
		},
	}),
	apiKeyAuth,
	validator(
		"param",
		z.object({
			feedSlug: slugSchema,
			feedItemSlug: slugSchema,
		})
	),
	async (c) => {
		const { feedSlug, feedItemSlug } = c.req.valid("param");
		await feedItemRepository.deleteFeedItem(feedSlug, feedItemSlug);
	}
);
