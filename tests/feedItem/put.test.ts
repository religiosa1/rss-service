import { describe, it } from "node:test";
import { app } from "../../src/app.ts";
import { API_KEY_HEADER_NAME, MAX_FEED_ITEMS } from "../../src/constants.ts";
import type { FeedItemModel, FeedItemUpdateModel } from "../../src/models/feedItem.ts";
import * as feedItemRepository from "../../src/repositories/feedItemRepository.ts";
import * as feedRepository from "../../src/repositories/feedRepository.ts";
import { DateMocker, type Jsonify, responseToPayload } from "../helpers.ts";
import { makeMockFeedItem, mockFeedPayload } from "../mocks.ts";
import { setupTestEnvironment } from "../setup.ts";

describe("PUT /feed/:feedSlug/items/", () => {
	setupTestEnvironment();

	it("allows to create multiple feedItems in one hit", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		const item1 = makeMockFeedItem("test");
		const item2 = makeMockFeedItem("test2");

		const res = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify([item1, item2]),
		});
		const resItems = await res.json();
		t.assert.equal(resItems.length, 2);
		t.assert.deepEqual(resItems.map(responseToPayload), [item1, item2]);
		t.assert.equal(res.status, 200);
	});

	it("allows old items to be present in payload and doesn't update them if values are the same", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		const insertedItem = makeMockFeedItem("test");
		const modifiedItem = makeMockFeedItem("test2");
		const woChangeItem = makeMockFeedItem("test3");
		await feedItemRepository.createFeedItem(mockFeedPayload.slug, modifiedItem);
		await feedItemRepository.createFeedItem(mockFeedPayload.slug, woChangeItem);

		using dateMocker = new DateMocker();
		const oldDate = dateMocker.getCurrentTime();
		const newDate = dateMocker.advanceTime(1000);
		const res = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify([
				insertedItem,
				{ ...modifiedItem, description: "new description" },
				woChangeItem,
			] satisfies FeedItemUpdateModel[]),
		});
		const items: Jsonify<FeedItemModel[]> = await res.json();
		t.assert.equal(items.length, 3);
		t.assert.equal(items[0].slug, insertedItem.slug);
		t.assert.equal(items[0].createdAt, newDate.toISOString(), "just inserted -- new date");
		t.assert.equal(items[0].modifiedAt, newDate.toISOString());

		t.assert.equal(items[1].slug, modifiedItem.slug);
		t.assert.equal(items[1].createdAt, oldDate.toISOString(), "is modified, but creation date should not change");
		t.assert.equal(items[1].modifiedAt, newDate.toISOString(), "is modified -- should be new date");

		t.assert.equal(items[2].slug, woChangeItem.slug);
		t.assert.equal(items[2].createdAt, oldDate.toISOString());
		t.assert.equal(items[2].modifiedAt, oldDate.toISOString(), "is not modified -- should be old date");

		t.assert.equal(res.status, 200);
	});

	it("returns 400 status if feed slug is invalid in path", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		const res = await app.request(`/feed/!!!/items`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify([makeMockFeedItem("test")]),
		});
		t.assert.equal(res.status, 400);
	});

	it("returns 400 status if payload contains malformed items", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		const res = await app.request(`/feed/!!!/items`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify([{ ...makeMockFeedItem("test"), description: 123 }]),
		});
		t.assert.equal(res.status, 400);
	});

	it("returns 404 if feed with provided feedSlug doesn't exist", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		const res = await app.request(`/feed/bad-slug/items`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify([makeMockFeedItem("test")]),
		});
		t.assert.equal(res.status, 404);
	});

	it("returns 409 on duplicated slugs in the payload", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		const res = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify([makeMockFeedItem("test"), makeMockFeedItem("test")]),
		});
		t.assert.equal(res.status, 409);
	});

	it("returns 413 if payload has more items than MAX_FEED_ITEMS", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		const res = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(Array.from({ length: MAX_FEED_ITEMS + 1 }, (_, i) => makeMockFeedItem("test" + i))),
		});
		t.assert.equal(res.status, 413);
	});

	it("returns 401 on unauthorized requests", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		const testKey = "test-key";
		const initialResp = await makeRequest(undefined);
		t.assert.equal(initialResp.status, 401);
		const authorizedResp = await makeRequest(testKey);
		t.assert.equal(authorizedResp.status, 200);

		async function makeRequest(key: string | undefined) {
			return await app.request(
				`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items`,
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						...(key
							? {
									[API_KEY_HEADER_NAME]: key,
								}
							: {}),
					},
					body: JSON.stringify([makeMockFeedItem("test1")]),
				},
				{
					API_KEY: testKey,
				} satisfies NodeJS.ProcessEnv
			);
		}
	});
}); // PUT /feed/:feedSlug/items
