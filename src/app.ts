/**
 * Hono app setup
 * @module src/app
 */

import { Hono } from "hono";
import { logger } from "hono/logger";

import { feedController } from "./controllers/feedController.ts";
import { feedItemController } from "./controllers/feedItemController.ts";
import { describeRoute } from "hono-openapi";

export const app = new Hono();

if (process.env.NODE_ENV !== "test") {
	app.use(logger());
}

if (!process.env.DISABLE_OPEN_API) {
	const { openAPISpecs } = await import("hono-openapi");
	const { openApiSpecs } = await import("./openApiSpecs.ts");
	app.get("/openapi", openAPISpecs(app, openApiSpecs));
	if (!process.env.DISABLE_SCALAR) {
		const { Scalar } = await import("@scalar/hono-api-reference");
		// Scalar web-UI to see/test API
		app.get("/scalar", Scalar({ url: "/openapi", hideModels: true }));
	}
}

if (process.env.NODE_ENV !== "test" && !process.env.DISABLE_PROMETHEUS) {
	const { prometheus } = await import("@hono/prometheus");
	const { printMetrics, registerMetrics } = prometheus();
	app.use("*", registerMetrics);
	app.get(
		"/metrics",
		describeRoute({
			summary: "Prometheus Rate-Error-Duration metrics",
		}),
		printMetrics
	);
}

app.get("/", (c) => c.body(null, 200)); // healthcheck endpoint
app.route("/feed", feedController);
app.route("/feed/:feedSlug/items", feedItemController);
