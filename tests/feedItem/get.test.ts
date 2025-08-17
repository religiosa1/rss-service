import { describe, it } from "node:test";
import { app } from "../../src/app.ts";
import { MAX_FEED_ITEMS } from "../../src/constants.ts";
import * as feedItemRepository from "../../src/repositories/feedItemRepository.ts";
import * as feedRepository from "../../src/repositories/feedRepository.ts";
import { DateMocker } from "../helpers.ts";
import { makeMockFeedItem, mockFeedPayload } from "../mocks.ts";
import { setupTestEnvironment } from "../setup.ts";

describe("GET /feed/:feedSlug/items/", () => {
	setupTestEnvironment();

	it("retrieves a list of current items in a feed", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test1"));
		await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test2"));
		const res = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items`);
		t.assert.equal(res.status, 200);
		const responsePayload = await res.json();
		t.assert.snapshot(responsePayload);
	});

	it("retrieves only MAX_FEED_ITEMS, anything beyond that is considered archived", async (t) => {
		using dateMocker = new DateMocker();
		await feedRepository.createFeed(mockFeedPayload);
		for (let i = 0; i < MAX_FEED_ITEMS + 5; i++) {
			const date = dateMocker.advanceTime(3000);
			await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test" + i, date));
		}
		const res = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items`);
		const responsePayload = await res.json();
		t.assert.equal(res.status, 200);
		t.assert.equal(responsePayload.length, MAX_FEED_ITEMS);
		t.assert.equal(responsePayload.at(-1).id, 6);
		t.assert.equal(responsePayload.at(0).id, 5 + MAX_FEED_ITEMS);
	});

	it("returns empty list for empty feeds", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		const res = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items`);
		t.assert.equal(res.status, 200);
		t.assert.deepEqual(await res.json(), []);
	});

	it("returns 400 status if feed slug is invalid in path", async (t) => {
		const res = await app.request(`/feed/!!!/items`);
		t.assert.equal(res.status, 400);
	});

	it("returns 404 on non-existing slug value", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		const res = await app.request(`/feed/bad-slug/items`);
		t.assert.equal(res.status, 404);
	});
}); // GET /feed/:feedSlug/items/
