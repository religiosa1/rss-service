import { defineConfig } from "drizzle-kit";
import { ensureUrl } from "./src/utils/ensureUrl.ts";

export const DEFAULT_DB_NAME = "./data.db";

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dialect: "sqlite",
	casing: "snake_case",
	dbCredentials: {
		url: ensureUrl(process.env.DB_FILE_NAME ?? DEFAULT_DB_NAME),
	},
});
