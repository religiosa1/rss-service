import { Hono } from "hono";
import { logger } from "hono/logger";
import { openAPISpecs } from "hono-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { migrate } from "./db/index.ts";
import { feedController } from "./controllers/feedController.ts";
import { feedItemController } from "./controllers/feedItemController.ts";
import { port } from "./globalContext.ts";
import { openApiSpecs } from "./openApiSpecs.ts";
import type { serve } from "@hono/node-server";

const app = new Hono();

if (!process.env.DB_SKIP_MIGRATIONS) {
	console.log("Running migrations...");
	const ts = performance.now();
	await migrate();
	console.log(`migrations done in ${(performance.now() - ts).toPrecision(3)}ms`);
}

app.use(logger());

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

export default {
	fetch: (req: Request) => {
		const url = new URL(req.url);
		url.protocol = req.headers.get("x-forwarded-proto") ?? url.protocol;
		return app.fetch(new Request(url, req));
	},
	port: port,
} satisfies Parameters<typeof serve>[0];
