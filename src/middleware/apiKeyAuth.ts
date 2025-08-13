import { createMiddleware } from "hono/factory";
import { API_KEY_HEADER_NAME } from "../constants.ts";
import { createHash, timingSafeEqual } from "node:crypto";
import { HTTPException } from "hono/http-exception";

export const apiKeyAuth = createMiddleware(async (c, next) => {
	const apiKey = c.env?.API_KEY;

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
