import { describe, it } from "node:test";
import { app } from "../../src/app.ts";
import { API_KEY_HEADER_NAME } from "../../src/constants.ts";
import * as feedItemRepository from "../../src/repositories/feedItemRepository.ts";
import * as feedRepository from "../../src/repositories/feedRepository.ts";
import { makeMockFeedItem, mockFeedPayload } from "../mocks.ts";
import { setupTestEnvironment } from "../setup.ts";

describe("DELETE /feed/:feedSlug/items/!all", () => {
	setupTestEnvironment();

	it("deletes all items in the provided feed", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test1"));
		await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test2"));
		t.assert.equal((await feedItemRepository.getFeedItems(mockFeedPayload.slug)).length, 2);
		const resp = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items/!all`, {
			method: "DELETE",
		});
		const respData = await resp.json();
		t.assert.deepEqual(respData, { count: 2 });
		t.assert.equal(resp.status, 200);
		t.assert.equal((await feedItemRepository.getFeedItems(mockFeedPayload.slug)).length, 0);
	});

	it("doesn't delete items in other slugs", async (t) => {
		const feedSlug2 = mockFeedPayload.slug + "2";
		await feedRepository.createFeed(mockFeedPayload);
		await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test1"));
		await feedRepository.createFeed({ ...mockFeedPayload, slug: feedSlug2 });
		await feedItemRepository.createFeedItem(feedSlug2, makeMockFeedItem("test1"));
		const resp = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items/!all`, {
			method: "DELETE",
		});
		const respData = await resp.json();
		t.assert.deepEqual(respData, { count: 1 });
		t.assert.equal(resp.status, 200);
		t.assert.equal((await feedItemRepository.getFeedItems(mockFeedPayload.slug)).length, 0);
		t.assert.equal((await feedItemRepository.getFeedItems(feedSlug2)).length, 1);
	});

	it("returns 400 on invalid feed slug", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test1"));
		const resp = await app.request(`/feed/!!!/items/!all`, {
			method: "DELETE",
		});
		t.assert.equal(resp.status, 400);
	});

	it("returns 404 on non-existing feed slug", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test1"));
		const resp = await app.request(`/feed/bad-slug/items/!all`, {
			method: "DELETE",
		});
		t.assert.equal(resp.status, 404);
	});

	it("returns 401 on authorized requests", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test1"));
		const testKey = "test-key";
		const initialResp = await makeRequest(undefined);
		t.assert.equal(initialResp.status, 401);
		const authorizedResp = await makeRequest(testKey);
		t.assert.equal(authorizedResp.status, 200);

		function makeRequest(key: string | undefined) {
			return app.request(
				`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items/!all`,
				{
					method: "DELETE",
					headers: key
						? {
								[API_KEY_HEADER_NAME]: key,
							}
						: undefined,
				},
				{
					API_KEY: testKey,
				} satisfies NodeJS.ProcessEnv
			);
		}
	});
});
