import { mock } from "node:test";

export const fixedDateStr = "2025-01-01T10:30:00.000Z";

export async function globalSetup() {
	process.env.DB_FILE_NAME = ":memory:";
}

export function mockTimers() {
	const fixedDate = new Date(fixedDateStr);

	mock.timers.enable({
		apis: ["Date"],
	});
	mock.timers.setTime(fixedDate.getTime());
}
