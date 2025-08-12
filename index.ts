import { Hono } from "hono";
import { logger } from "hono/logger";
import { openAPISpecs } from "hono-openapi";
import { serve } from "@hono/node-server";
import { Scalar } from "@scalar/hono-api-reference";
import { migrate } from "./src/db/index.ts";
import { feedController } from "./src/controllers/feedController.ts";
import { feedItemController } from "./src/controllers/feedItemController.ts";
import { port } from "./src/globalContext.ts";
import { openApiSpecs } from "./src/openApiSpecs.ts";

const app = new Hono();

console.log("Running migrations...");
await migrate();

console.log(`RSS Server is running on port ${port}`);

app.use(logger());

if (!process.env.DISABLE_OPEN_API) {
	app.get("/openapi", openAPISpecs(app, openApiSpecs));
	if (!process.env.DISABLE_SCALAR) {
		// Scalar web-UI to see/test API
		app.get("/scalar", Scalar({ url: "/openapi", hideModels: true }));
	}
}

app.route("/feed", feedController);
app.route("/feed/:feedSlug/items", feedItemController);

serve({
	fetch: (req: Request) => {
		const url = new URL(req.url);
		url.protocol = req.headers.get("x-forwarded-proto") ?? url.protocol;
		return app.fetch(new Request(url, req));
	},
	port: port,
});
