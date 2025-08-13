import { Hono } from "hono";
import z from "zod";
import { dedent } from "ts-dedent";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { feedItemSchema, feedItemUpdateSchema } from "../models/feedItem.ts";
import { slugSchema } from "../models/slug.ts";
import { apiKeyAuthSecurity } from "../models/apiKeyAuthSecurity.ts";
import { apiKeyAuth } from "../middleware/apiKeyAuth.ts";
import * as feedItemRepository from "../repositories/feedItem.ts";
import { MAX_FEED_ITEMS, MAX_FEED_ITEMS_ARCHIVED } from "../constants.ts";

export const feedItemController = new Hono();

const tags = ["feed-item"];

feedItemController.get(
	"/",
	describeRoute({
		summary: "Get a list of feed items",
		description: dedent`
			Get a list of all non-archived entries in the feed. The list is never
			bigger than ${MAX_FEED_ITEMS} items long.
		`,
		operationId: "getListOfFeedItems",
		tags,
		responses: {
			200: {
				description: "Successful response",
				content: {
					"application/json": { schema: resolver(z.array(feedItemSchema)) },
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
	validator(
		"param",
		z.object({
			feedSlug: slugSchema,
		})
	),
	async (c) => {
		const { feedSlug } = c.req.valid("param");
		const data = await feedItemRepository.getFeedItems(feedSlug);
		return c.json(data);
	}
);

feedItemController.get(
	"/all",
	describeRoute({
		summary: "Get a list of both non-archived and archived feed items",
		description: dedent`
			Get a list of all non-archived and archived entries in the feed. 
			The list is never bigger than 
			${MAX_FEED_ITEMS + MAX_FEED_ITEMS_ARCHIVED} items long.
		`,
		operationId: "getListOfFeedItems",
		tags,
		responses: {
			200: {
				description: "Successful response",
				content: {
					"application/json": {
						schema: resolver(
							z.array(
								feedItemSchema.extend({
									archived: z.boolean(),
								})
							)
						),
					},
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
	validator(
		"param",
		z.object({
			feedSlug: slugSchema,
		})
	),
	async (c) => {
		const { feedSlug } = c.req.valid("param");
		const nonArchived = await feedItemRepository.getFeedItems(feedSlug);
		const archived = await feedItemRepository.getArchivedFeedItems(feedSlug);
		return c.json([
			...nonArchived.map((i) => ({ ...i, archived: false })),
			...archived.map((i) => ({ ...i, archived: true })),
		]);
	}
);

feedItemController.post(
	"/",
	describeRoute({
		summary: "Create a new entry in the feed",
		description: dedent`
			Creates a new entry (post, article, etc.) in a feed. At any given time
			a feed contains ${MAX_FEED_ITEMS} entries, when you're adding an entry 
			beyond that limit, the oldest entry moves to archive, which contains
			${MAX_FEED_ITEMS_ARCHIVED} additional entries. Any older entry from 
			archive is deleted.
			`,
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
			401: {
				description: "Unauthorized",
			},
			404: {
				description: "Feed with the provided slug doesn't exist",
			},
			409: {
				description: "Feed entry item with the same slug already exists in the feed",
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
		return c.json(item, 201);
	}
);

feedItemController.patch(
	"/:feedItemSlug",
	describeRoute({
		summary: "Update a feed entry item",
		description: dedent`
			Update an existing feed entry with new values. 
			Only specified values will be used. For nullable values you must specify
			\`null\` in the payload, to reset them, not specifying the field in the 
			payload at all, or specifying an undefined value will result in 
			the existing value kept.
		`,
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
		return c.json(item);
	}
);

feedItemController.delete(
	"/:feedItemSlug",
	describeRoute({
		summary: "Delete an existing feed entry item",
		description: dedent`
			Deletes an existing feed entry. If archive contains some entries, one of
			them will be added to the current feed RSS instead of deleted one (but
			taking the oldest place). You can also use this endpoint to delete 
			archived entries as well.
		`,
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
		return c.body(null, 204);
	}
);
