import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.ts";
import { DEFAULT_DB_NAME } from "../../drizzle.config.ts";
import { pathToFileURL } from "node:url";

export const db = drizzle(pathToFileURL(process.env.DB_FILE_NAME ?? DEFAULT_DB_NAME).toString(), {
	schema,
	casing: "snake_case",
});
