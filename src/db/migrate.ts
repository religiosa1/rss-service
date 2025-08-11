import { migrate as drizzleMigrate } from "drizzle-orm/libsql/migrator";
import { db } from "./db.ts";

export async function migrate() {
	// This will run migrations on the database, skipping the ones already applied
	return drizzleMigrate(db, { migrationsFolder: "./drizzle" });
}
