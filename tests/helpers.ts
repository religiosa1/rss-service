import { mock } from "node:test";
import type { FeedItemModel, FeedItemUpdateModel } from "../src/models/feedItem.ts";
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

/** Helper function, transforming returned response to initial payload, so we can compare them */
export function responseToPayload(item: Jsonify<FeedItemModel> | FeedItemModel): FeedItemUpdateModel {
	return {
		slug: item.slug,
		title: item.title,
		description: item.description,
		link: item.link,
		content: item.content,
		date: new Date(item.date),
	};
}
