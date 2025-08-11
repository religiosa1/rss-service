import { pathToFileURL } from "node:url";
import { defineConfig } from "drizzle-kit";

export const DEFAULT_DB_NAME = "./data.db";

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dialect: "sqlite",
	dbCredentials: {
		url: pathToFileURL(process.env.DB_FILE_NAME ?? DEFAULT_DB_NAME).toString(),
	},
});
