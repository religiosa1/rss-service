/**
 * Hono app setup
 * @module src/app
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requestId } from "hono/request-id";
import { routePath } from "hono/route";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { describeRoute } from "hono-openapi";
import { type PinoLogger, pinoLogger } from "hono-pino";
import { feedController } from "./controllers/feedController.ts";
import { feedItemController } from "./controllers/feedItemController.ts";
import { logger } from "./logger.ts";
import type { ErrorResponseModel } from "./models/errorResponse.ts";

export type AppEnv = {
	Variables: {
		logger: PinoLogger;
		requestId: string;
	};
};

export const app = new Hono<AppEnv>()
	.use(requestId()) //
	.use(
		pinoLogger({
			pino: logger,
		})
	)
	.onError((err, c) => {
		logger.error({ err }, `Error occurred in ${routePath(c)}`);
		const status: ContentfulStatusCode = err instanceof HTTPException ? err.status : 500;
		return c.json(
			{
				success: false,
				status,
				message: String(err),
			} satisfies ErrorResponseModel,
			status
		);
	});

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
