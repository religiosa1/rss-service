import { Hono } from "hono";
import { logger } from "hono/logger";
import { openAPISpecs } from "hono-openapi";
import { serve } from "@hono/node-server";
import { Scalar } from "@scalar/hono-api-reference";
import packageJson from "./package.json" with { type: "json" };
import { migrate } from "./src/db/index.ts";
import { feedController } from "./src/controllers/feedController.ts";
import { feedItemController } from "./src/controllers/feedItemController.ts";
import { API_KEY_SECURITY_SCHEMA_NAME } from "./src/models/apiKeyAuthSecurity.ts";
import { API_KEY_HEADER_NAME } from "./src/constants.ts";

const app = new Hono();

console.log("Running migrations...");
await migrate();

const DEFAULT_PORT = 3000;
const port = parseInt(process.env.PORT ?? "", 10) || DEFAULT_PORT;
console.log(`RSS Server is running on port ${port}`);

app.use(logger());

if (!process.env.DISABLE_OPEN_API) {
	app.get(
		"/openapi",
		openAPISpecs(app, {
			documentation: {
				info: {
					title: packageJson.name,
					version: packageJson.version,
					description: packageJson.description,
				},
				components: {
					securitySchemes: {
						[API_KEY_SECURITY_SCHEMA_NAME]: {
							type: "apiKey",
							in: "header",
							name: API_KEY_HEADER_NAME,
						},
					},
				},
				servers: [{ url: `http://localhost:${port}`, description: "Local Server" }],
			},
		})
	);
	if (!process.env.DISABLE_SCALAR) {
		// Scalar web-UI to see/test API
		app.get("/scalar", Scalar({ url: "/openapi" }));
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
	port,
});
