import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import z from "zod";
import packageJson from "../../package.json" with { type: "json" };

export const healthCheckController = new Hono().get(
	"/",
	describeRoute({
		summary: "Healthcheck endpoint",
		operationId: "healthcheck",
		responses: {
			200: {
				description: "Successful response",
				content: {
					"application/json": {
						schema: resolver(
							z.object({
								name: z.literal(packageJson.name),
								version: z.string(),
							})
						),
					},
				},
			},
		},
	}),
	(c) => {
		return c.json({
			name: packageJson.name,
			version: packageJson.version,
		});
	}
);
