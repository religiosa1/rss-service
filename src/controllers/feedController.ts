import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { dedent } from "ts-dedent";
import z from "zod";

import { apiKeyAuth } from "../middleware/apiKeyAuth.ts";
import { apiKeyAuthSecurity } from "../models/apiKeyAuthSecurity.ts";
import { feedSchema, feedUpdateSchema } from "../models/feed.ts";
import { slugSchema } from "../models/slug.ts";
import * as feedRepository from "../repositories/feedRepository.ts";
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
		summary: "Get a feed in AtomXML format",
		operationId: "getFeedRss",
		tags,
		responses: {
			200: {
				description: "Successful response",
				content: {
					"application/atom+xml": {},
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
			"Content-Type": "application/atom+xml; charset=utf-8",
		});
	}
);

feedController.patch(
	"/:feedSlug",
	describeRoute({
		summary: "Update existing feed values",
		operationId: "updateFeed",
		description: dedent`
			Updates the existing feed model (by slug provided in path) with the values
			provided in the payload. Please notice, that if you provide author value,
			if it contains null/undefined in place of some of its fields, it means 
			"remove the provided field", i.e. field patch is not deep, and if author
			is present in the payload it must contain of the old fields in it.

			If you pass author as null it will be removed, if you don't pass author
			field at all, the existing value will not be changed.
		`,
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
