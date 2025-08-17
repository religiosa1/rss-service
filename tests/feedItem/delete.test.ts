import { describe, it } from "node:test";
import { app } from "../../src/app.ts";
import { API_KEY_HEADER_NAME } from "../../src/constants.ts";
import { db, schema } from "../../src/db/index.ts";
import * as feedItemRepository from "../../src/repositories/feedItemRepository.ts";
import * as feedRepository from "../../src/repositories/feedRepository.ts";
import { makeMockFeedItem, mockFeedPayload } from "../mocks.ts";
import { setupTestEnvironment } from "../setup.ts";

describe("DELETE /feed/:feedSlug/items/:feedItemSlug", () => {
	setupTestEnvironment();

	it("deletes a feed item", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test1"));
		await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test2"));
		const initialCount = await db.$count(schema.feedItem);
		t.assert.equal(initialCount, 2);

		const resp = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items/test1`, {
			method: "DELETE",
		});
		t.assert.equal(resp.status, 204);
		const count = await db.$count(schema.feedItem);
		t.assert.equal(count, 1);
	});

	it("returns 400 on invalid feedSlug param", async (t) => {
		const resp = await app.request(`/feed/!!!/items/test1`, {
			method: "DELETE",
		});
		t.assert.equal(resp.status, 400);
	});

	it("returns 400 on invalid feedItemSlug param", async (t) => {
		const resp = await app.request(`/feed/test/items/!!!`, {
			method: "DELETE",
		});
		t.assert.equal(resp.status, 400);
	});

	it("returns 404 on non-existing feedSlug param", async (t) => {
		const resp = await app.request(`/feed/bad-slug/items/blah`, {
			method: "DELETE",
		});
		t.assert.equal(resp.status, 404);
	});

	it("returns 404 on non-existing feedItemSlug param", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		const resp = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items/bad-slug`, {
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
		t.assert.equal(authorizedResp.status, 204);

		function makeRequest(key: string | undefined) {
			return app.request(
				`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items/test1`,
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
}); // DELETE /feed/:feedSlug/items/:feedItemSlug
