import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.ts";
import { DEFAULT_DB_NAME } from "../../drizzle.config.ts";
import { ensureUrl } from "../utils/ensureUrl.ts";

export let db = makeInstance(ensureUrl(process.env.DB_FILE_NAME ?? DEFAULT_DB_NAME));

/** Reseting db connection -- for testing purposes */
export function resetDbConnection(connectionString = process.env.DB_FILE_NAME ?? DEFAULT_DB_NAME) {
	db.$client.close();
	db = makeInstance(connectionString);
}

function makeInstance(connectionString: string) {
	return drizzle({
		connection: {
			url: ensureUrl(connectionString),
			// for HTTP version of Turso, not required otherwise
			authToken: process.env.DB_AUTH_TOKEN,
		},
		casing: "snake_case",
		schema,
	});
}
