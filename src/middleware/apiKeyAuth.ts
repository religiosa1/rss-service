import { createMiddleware } from "hono/factory";
import { API_KEY_HEADER_NAME } from "../constants.ts";
import { createHash, timingSafeEqual } from "node:crypto";
import { HTTPException } from "hono/http-exception";

const API_KEY_HASH = process.env.API_KEY
	? createHash("sha256").update(process.env.API_KEY).digest("hex") //
	: null;

export const apiKeyAuth = createMiddleware(async (c, next) => {
	if (API_KEY_HASH) {
		const val = c.req.header(API_KEY_HEADER_NAME);
		const isEqualKey =
			!!val &&
			timingSafeEqual(
				Buffer.from(API_KEY_HASH), //
				Buffer.from(createHash("sha256").update(val).digest("hex"))
			);
		if (!isEqualKey) {
			throw new HTTPException(401);
		}
	}
	await next();
});
