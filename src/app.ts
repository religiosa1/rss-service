/**
 * Hono app setup
 * @module src/app
 */

import { Hono } from "hono";
import { logger } from "hono/logger";
import { openAPISpecs } from "hono-openapi";
import { Scalar } from "@scalar/hono-api-reference";

import { feedController } from "./controllers/feedController.ts";
import { feedItemController } from "./controllers/feedItemController.ts";
import { openApiSpecs } from "./openApiSpecs.ts";

export const app = new Hono();

if (process.env.NODE_ENV !== "test") {
	app.use(logger());
}

if (!process.env.DISABLE_OPEN_API) {
	app.get("/openapi", openAPISpecs(app, openApiSpecs));
	if (!process.env.DISABLE_SCALAR) {
		// Scalar web-UI to see/test API
		app.get("/scalar", Scalar({ url: "/openapi", hideModels: true }));
	}
}

app.get("/", (c) => c.body(null, 200)); // healthcheck endpoint
app.route("/feed", feedController);
app.route("/feed/:feedSlug/items", feedItemController);
