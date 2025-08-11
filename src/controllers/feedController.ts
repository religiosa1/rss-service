import { Hono } from "hono";
import z from "zod";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { feedUpdateSchema, feedPreviewSchema, feedSchema } from "../models/feed.ts";
import { slugSchema } from "../models/slug.ts";
import { apiKeyAuthSecurity } from "../models/apiKeyAuthSecurity.ts";
import { apiKeyAuth } from "../middleware/apiKeyAuth.ts";

const feedController = new Hono();

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
					"application/json": { schema: resolver(z.array(feedPreviewSchema)) },
				},
			},
		},
	}),
	async (c) => {
		c.json("TODO");
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
			403: {
				description: "Forbidden",
			},
			409: {
				description: "Feed already exists",
			},
		},
	}),
	apiKeyAuth,
	validator("json", feedUpdateSchema),
	async (c) => {
		throw new Error("TODO");
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
		},
	}),
	validator(
		"param",
		z.object({
			feedSlug: slugSchema,
		})
	),
	async (c) => {
		throw new Error("TODO");
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
		throw new Error("TODO");
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
		throw new Error("TODO");
	}
);

export { feedController };
