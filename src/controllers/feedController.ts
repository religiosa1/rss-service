import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { dedent } from "ts-dedent";
import { match } from "ts-pattern";
import z from "zod";
import type { AppEnv } from "../app.ts";
import { apiKeyAuth } from "../middleware/apiKeyAuth.ts";
import { validator } from "../middleware/validator.ts";
import { apiKeyAuthSecurity } from "../models/apiKeyAuthSecurity.ts";
import { errorResponseOpenApiSchema, validationErrorResponseOpenApiSchema } from "../models/errorResponse.ts";
import { feedSchema, feedUpdateSchema } from "../models/feed.ts";
import { slugSchema } from "../models/slug.ts";
import * as feedRepository from "../repositories/feedRepository.ts";
import * as feedService from "../services/feedService.ts";

export const feedController = new Hono<AppEnv>();

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
					"application/json": { schema: resolver(z.array(feedSchema)) },
				},
			},
			400: {
				description: "Bad request",
				content: validationErrorResponseOpenApiSchema,
			},
			401: {
				description: "Unauthorized",
				content: errorResponseOpenApiSchema,
			},
			409: {
				description: "Feed with this slug already exists",
				content: errorResponseOpenApiSchema,
			},
		},
	}),
	apiKeyAuth,
	validator("json", feedUpdateSchema),
	async (c) => {
		const payload = c.req.valid("json");
		const item = await feedRepository.createFeed(payload);
		c.var.logger.info({ payload }, `Created feed ${payload.slug}`);

		return c.json(item, 201);
	}
);

feedController.get(
	"/:feedSlug",
	describeRoute({
		summary: "Get a feed in one of the feed formats",
		operationId: "getFeedRss",
		tags,
		responses: {
			200: {
				description: "Successful response",
				content: {
					"application/atom+xml": {},
					"application/rss+xml": {},
					"application/feed+json": {},
				},
			},
			400: {
				description: "Bad request",
				content: validationErrorResponseOpenApiSchema,
			},
			404: {
				description: "No such feed",
				content: errorResponseOpenApiSchema,
			},
		},
	}),
	validator(
		"param",
		z.object({
			feedSlug: slugSchema,
		})
	),
	validator(
		"query",
		z.object({
			type: z.enum(["atom", "rss", "json"]).default("atom").describe("Feed output format"),
		})
	),
	async (c) => {
		const { feedSlug } = c.req.valid("param");
		const { type } = c.req.valid("query");
		const data = await feedService.getFeed(feedSlug, type);

		const contentType: string =
			match(type)
				.with("json", () => "application/feed+json")
				.with("rss", () => "application/rss+xml")
				.otherwise(() => "application/atom+xml") + //
			"; charset=utf-8";

		return c.text(data, 200, {
			"Content-Type": contentType,
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
				content: validationErrorResponseOpenApiSchema,
			},
			401: {
				description: "Unauthorized",
				content: errorResponseOpenApiSchema,
			},
			404: {
				description: "Feed with the provided slug doesn't exist",
				content: errorResponseOpenApiSchema,
			},
			409: {
				description: "Updated slug value already exists",
				content: errorResponseOpenApiSchema,
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
		c.var.logger.info({ feedSlug, payload }, `Patched feed ${feedSlug}${payload.slug ? ` -> ${payload.slug}` : ""}`);
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
			400: {
				description: "Malformed slug",
				content: validationErrorResponseOpenApiSchema,
			},
			401: {
				description: "Unauthorized",
				content: errorResponseOpenApiSchema,
			},
			404: {
				description: "Feed with the provided slug doesn't exist",
				content: errorResponseOpenApiSchema,
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
		c.var.logger.info({ feedSlug }, `Deleted feed ${feedSlug}`);
		return c.body(null, 204);
	}
);
