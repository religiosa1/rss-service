import { Hono } from "hono";
import z from "zod";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { feedUpdateSchema, feedSchema } from "../models/feed.ts";
import { slugSchema } from "../models/slug.ts";
import { apiKeyAuthSecurity } from "../models/apiKeyAuthSecurity.ts";
import { apiKeyAuth } from "../middleware/apiKeyAuth.ts";
import * as feedRepository from "../repositories/feed.ts";
import * as feedService from "../services/feedService.ts";

export const feedController = new Hono();

const tags = ["feed"];

feedController.get(
	"/",
	describeRoute({
		summary: "List existing feeds",
		operationId: "listFeeds",
		tags,
		responses: {
			200: {
				description: "Successful response",
				content: {
					"application/json": { schema: resolver(z.array(feedSchema)) },
				},
			},
		},
	}),
	async (c) => {
		const data = await feedRepository.listFeeds();
		return c.json(data);
	}
);

feedController.post(
	"/",
	describeRoute({
		summary: "Create a new feed",
		operationId: "createFeed",
		tags,
		security: apiKeyAuthSecurity,
		responses: {
			201: {
				description: "Created",
				content: {
					"application/json": { schema: resolver(feedSchema) },
				},
			},
			400: {
				description: "Bad request",
			},
			401: {
				description: "Unauthorized",
			},
			409: {
				description: "Feed with this slug already exists",
			},
		},
	}),
	apiKeyAuth,
	validator("json", feedUpdateSchema),
	async (c) => {
		const payload = c.req.valid("json");
		const item = await feedRepository.createFeed(payload);
		return c.json(item, 201);
	}
);

feedController.get(
	"/:feedSlug",
	describeRoute({
		summary: "Get a feed in RSS format",
		operationId: "getFeedRss",
		tags,
		responses: {
			200: {
				description: "Successful response",
				content: {
					"application/rss+xml": {},
				},
			},
			400: {
				description: "Bad request",
			},
			404: {
				description: "No such feed",
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
		const data = await feedService.getFeed(feedSlug);
		return c.text(data, 200, {
			"Content-Type": " application/rss+xml; charset=UTF-8",
		});
	}
);

feedController.patch(
	"/:feedSlug",
	describeRoute({
		summary: "Update existing feed values",
		operationId: "updateFeed",
		tags,
		security: apiKeyAuthSecurity,
		responses: {
			200: {
				description: "Successful response",
				content: {
					"application/json": { schema: resolver(feedSchema) },
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
				description: "Updated slug value already exists",
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
	validator("json", feedUpdateSchema.partial()),
	async (c) => {
		const { feedSlug } = c.req.valid("param");
		const payload = c.req.valid("json");
		const item = await feedRepository.updateFeed(feedSlug, payload);
		return c.json(item);
	}
);

feedController.delete(
	"/:feedSlug",
	describeRoute({
		summary: "Delete an existing feed",
		operationId: "deleteFeed",
		tags,
		security: apiKeyAuthSecurity,
		responses: {
			204: {
				description: "Successful response",
			},
			401: {
				description: "Unauthorized",
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
	async (c) => {
		const { feedSlug } = c.req.valid("param");
		await feedRepository.deleteFeed(feedSlug);
		return c.body(null, 204);
	}
);
