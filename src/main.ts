/**
 * runtime-agnostic entrypoint
 *
 * (runtimes may require their own wrapper around this module's export)
 * @module src/main
 */

import { migrate } from "./db/index.ts";
import { port } from "./globalContext.ts";
import type { serve } from "@hono/node-server";
import { app } from "./app.ts";

if (!process.env.DB_SKIP_MIGRATIONS) {
	console.log("Running migrations...");
	const ts = performance.now();
	await migrate();
	console.log(`migrations done in ${(performance.now() - ts).toPrecision(3)}ms`);
}

export default {
	fetch: (req: Request) => {
		const url = new URL(req.url);
		url.protocol = req.headers.get("x-forwarded-proto") ?? url.protocol;
		return app.fetch(new Request(url, req));
	},
	port: port,
} satisfies Parameters<typeof serve>[0];
