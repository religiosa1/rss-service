import { mock } from "node:test";
import { fixedDateStr } from "./setup.ts";

/** Transform Date objects in paylod to string -- to align with JSON response */
export type Jsonify<T extends object> = {
	[K in keyof T]: Date extends T[K] ? (T[K] extends Date ? string : Exclude<T[K], Date> | string) : T[K];
};

/** Helper utility for advancing mocked date-time, to verify modifiedAt modifications in moddels */
export class DateMocker {
	private lastTime = new Date(fixedDateStr);

	advanceTime(stepMs: number): Date {
		if (!Number.isInteger(stepMs) || stepMs <= 0) {
			throw new TypeError("Cannot advance timers, stepMs must be a positivve integer");
		}
		this.lastTime = new Date(this.lastTime.getTime() + stepMs);
		mock.timers.setTime(this.lastTime.getTime());
		return this.lastTime;
	}

	[Symbol.dispose]() {
		mock.timers.setTime(new Date(fixedDateStr).getTime());
	}
}
