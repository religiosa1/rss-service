import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { before, beforeEach, mock } from "node:test";
import { resetDbConnection } from "../src/db/db.ts";
import { migrate } from "../src/db/index.ts";
import { fixedDateStr } from "./mocks.ts";

export function setupTestEnvironment() {
	before(() => {
		const fixedDate = new Date(fixedDateStr);

		mock.timers.enable({
			apis: ["Date"],
		});
		mock.timers.setTime(fixedDate.getTime());
	});

	beforeEach(async (t) => {
		// ensuring each test works with a clean in memory version of db.
		// Initial idea was to run this in :memory:, but there's a bug with libsql
		// https://github.com/tursodatabase/libsql-client-ts/issues/140
		// So we're opting for temporary files instead.
		const tmpDbFile = mkTmpDbFile();
		resetDbConnection(tmpDbFile);
		await migrate();

		if ("after" in t) {
			t.after(() => {
				unlinkSync(tmpDbFile);
			});
		}
	});
}

function mkTmpDbFile(): string {
	const randomId = Math.random().toString(36).substring(2, 15);
	return path.join(tmpdir(), `test-${randomId}.db`);
}
