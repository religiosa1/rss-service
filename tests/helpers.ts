import { mock } from "node:test";
import { tmpdir } from "node:os";
import path from "node:path";

import { fixedDateStr } from "./mocks.ts";

/** Transform Date objects in payload to string -- to align with JSON response */
export type Jsonify<T extends object> = {
	[K in keyof T]: Date extends T[K] ? (T[K] extends Date ? string : Exclude<T[K], Date> | string) : T[K];
};

/** Helper utility for advancing mocked date-time, to verify modifiedAt modifications in models */
export class DateMocker {
	private lastTime = new Date(fixedDateStr);

	getCurrentTime() {
		return this.lastTime;
	}

	advanceTime(stepMs: number): Date {
		if (!Number.isInteger(stepMs) || stepMs <= 0) {
			throw new TypeError("Cannot advance timers, stepMs must be a positive integer");
		}
		this.lastTime = new Date(this.lastTime.getTime() + stepMs);
		mock.timers.setTime(this.lastTime.getTime());
		return this.lastTime;
	}

	[Symbol.dispose]() {
		mock.timers.setTime(new Date(fixedDateStr).getTime());
	}
}

export function mkTmpDbFile(): string {
	const randomId = Math.random().toString(36).substring(2, 15);
	return path.join(tmpdir(), `test-${randomId}.db`);
}

export function mockTimers() {
	const fixedDate = new Date(fixedDateStr);

	mock.timers.enable({
		apis: ["Date"],
	});
	mock.timers.setTime(fixedDate.getTime());
}
