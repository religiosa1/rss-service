import { describe, it } from "node:test";
import { app } from "../../src/app.ts";
import { MAX_FEED_ITEMS } from "../../src/constants.ts";
import type { FeedItemModel } from "../../src/models/feedItem.ts";
import * as feedItemRepository from "../../src/repositories/feedItemRepository.ts";
import * as feedRepository from "../../src/repositories/feedRepository.ts";
import { DateMocker } from "../helpers.ts";
import { makeMockFeedItem, mockFeedPayload } from "../mocks.ts";
import { setupTestEnvironment } from "../setup.ts";

describe("GET /feed/:feedSlug/items/!all", () => {
	setupTestEnvironment();

	it("retrieves all feed items", async (t) => {
		using dateMocker = new DateMocker();
		await feedRepository.createFeed(mockFeedPayload);
		for (let i = 0; i < MAX_FEED_ITEMS + 5; i++) {
			const date = dateMocker.advanceTime(3000);
			await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test" + i, date));
		}
		const res = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items/!all`);
		const responsePayload: Array<FeedItemModel & { archived: boolean }> = await res.json();
		t.assert.equal(res.status, 200);
		t.assert.equal(responsePayload.length, MAX_FEED_ITEMS + 5);
		t.assert.equal(responsePayload.at(-1)?.id, 1);
		t.assert.equal(responsePayload.at(0)?.id, MAX_FEED_ITEMS + 5);
		t.assert.equal(
			responsePayload.slice(0, MAX_FEED_ITEMS).every((i) => !i.archived),
			true
		);
		t.assert.equal(
			responsePayload.slice(MAX_FEED_ITEMS).every((i) => i.archived),
			true
		);
	});

	it("returns 400 status if feed slug is invalid in path", async (t) => {
		const res = await app.request(`/feed/!!!/items/!all`);
		t.assert.equal(res.status, 400);
	});

	it("returns 404 on non-existing slug value", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		const res = await app.request(`/feed/bad-slug/items/!all`);
		t.assert.equal(res.status, 404);
	});
}); // GET /feed/:feedSlug/items/all
