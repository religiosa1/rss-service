import type { AuthorModel } from "../src/models/author.ts";
import type { FeedModel, FeedUpdateModel } from "../src/models/feed.ts";
import type { FeedItemUpdateModel } from "../src/models/feedItem.ts";
import type { Jsonify } from "./helpers.ts";

export const fixedDateStr = "2025-01-01T10:30:00.000Z";

export const mockAuthor: AuthorModel = {
	name: "John Doe",
	email: "john.doe@example.com",
	link: "https://example.com",
	avatar: "https://example.com/favicon.png",
};

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
	link: "/feed/test",
	modifiedAt: fixedDateStr,
	slug: "test",
	title: "test title",
	updatedAt: fixedDateStr,
};

export function makeMockFeedItem(slug: string, date: Date = new Date(fixedDateStr)): FeedItemUpdateModel {
	return {
		slug,
		title: "feed item title",
		link: `http://example.com/${encodeURIComponent(slug)}`,
		date,
		description: "feed item description",
		content: "blah",
	};
}
export const mockFeedItemPayload: FeedItemUpdateModel = makeMockFeedItem("testFeedItem");
