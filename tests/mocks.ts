import type { FeedModel, FeedUpdateModel } from "../src/models/feed.ts";
import type { FeedItemUpdateModel } from "../src/models/feedItem.ts";
import type { Jsonify } from "./helpers.ts";
import { fixedDateStr } from "./setup.ts";

export const mockFeedPayload: FeedUpdateModel = {
	slug: "test",
	title: "test title",
	description: "qwerty",
};

export const mockFeedResult: Jsonify<FeedModel> = {
	author: null,
	copyright: null,
	createdAt: fixedDateStr,
	description: "qwerty",
	favicon: null,
	id: 1,
	image: null,
	language: null,
	link: "http://localhost:3000/feed/test",
	modifiedAt: fixedDateStr,
	slug: "test",
	title: "test title",
	updatedAt: fixedDateStr,
};

export function makeMockFeedItem(slug: string, date: Date = new Date(fixedDateStr)): FeedItemUpdateModel {
	return {
		slug,
		title: "feed item title",
		description: "feed item description",
		link: `http://example.com/${encodeURIComponent(slug)}`,
		content: "blah",
		date,
	};
}
export const mockFeedItemPayload: FeedItemUpdateModel = makeMockFeedItem("testFeedItem");
