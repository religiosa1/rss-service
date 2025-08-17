import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "hono/adapter";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { API_KEY_HEADER_NAME } from "../constants.ts";

export const apiKeyAuth = createMiddleware(async (c, next) => {
	const apiKey = env<NodeJS.ProcessEnv>(c, process.env.NODE_ENV === "test" ? "workerd" : undefined)?.API_KEY;

	if (apiKey) {
		const val = c.req.header(API_KEY_HEADER_NAME);
		const isEqualKey =
			!!val &&
			timingSafeEqual(
				Buffer.from(createHash("sha256").update(apiKey).digest("hex")), //
				Buffer.from(createHash("sha256").update(val).digest("hex"))
			);
		if (!isEqualKey) {
			throw new HTTPException(401);
		}
	}
	await next();
});
