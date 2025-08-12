import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.ts";
import { DEFAULT_DB_NAME } from "../../drizzle.config.ts";
import { ensureUrl } from "../utils/ensureUrl.ts";

export const db = drizzle({
	connection: {
		url: ensureUrl(process.env.DB_FILE_NAME ?? DEFAULT_DB_NAME),
		// for HTTP version of Turso, not required otherwise
		authToken: process.env.DB_AUTH_TOKEN,
	},
	schema,
	casing: "snake_case",
});
