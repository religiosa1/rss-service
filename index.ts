#!/usr/bin/env node
/**
 * node.js entrypoint
 * @module index
 */

import { serve } from "@hono/node-server";
import { logger } from "./src/logger.ts";
import app from "./src/main.ts";

serve(app, (info) => {
	const host = info.family === "IPv6" ? `[${info.address}]` : info.address;
	logger.info(`RSS Server is running on http://${host}:${info.port}/`);
	if (process.env.DISABLE_SCALAR !== "1" && process.env.DISABLE_OPEN_API !== "1") {
		logger.info(`Scalar/OpenAPI docs are available on http://${host}:${info.port}/scalar`);
	}
});
