import { db } from "./index.ts";

/** Run migrations on a local database */
export async function migrate() {
	// Using async import to avoid actually importing the migrator if it was
	// skipped during startup (if we're running with HTTP database for example)
	// or we want to save those 5ms during startup
	const { migrate: drizzleMigrate } = await import("drizzle-orm/libsql/migrator");
	return drizzleMigrate(db, { migrationsFolder: "./drizzle" });
}
