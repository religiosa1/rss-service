import { describe, it } from "node:test";
import { app } from "../../src/app.ts";
import { API_KEY_HEADER_NAME, MAX_FEED_ITEMS, MAX_FEED_ITEMS_ARCHIVED } from "../../src/constants.ts";
import { db, schema } from "../../src/db/index.ts";
import * as feedItemRepository from "../../src/repositories/feedItemRepository.ts";
import * as feedRepository from "../../src/repositories/feedRepository.ts";
import { DateMocker } from "../helpers.ts";
import { makeMockFeedItem, mockFeedPayload } from "../mocks.ts";
import { setupTestEnvironment } from "../setup.ts";

describe("POST /feed/:feedSlug/items/", () => {
	setupTestEnvironment();

	it("creates a new feed item", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		const res = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(makeMockFeedItem("test1")),
		});
		t.assert.equal(res.status, 201);
		const items = await feedItemRepository.getFeedItems(mockFeedPayload.slug);
		t.assert.equal(items.length, 1);
	});

	it("never creates more than MAX_FEED_ITEMS + MAX_FEED_ITEMS_ARCHIVED items", async (t) => {
		using dateMocker = new DateMocker();
		await feedRepository.createFeed(mockFeedPayload);
		for (let i = 0; i < MAX_FEED_ITEMS + MAX_FEED_ITEMS_ARCHIVED + 5; i++) {
			const date = dateMocker.advanceTime(3000);
			await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(makeMockFeedItem("test" + i, date)),
			});
		}
		const count = await db.$count(schema.feedItem);
		t.assert.equal(count, MAX_FEED_ITEMS + MAX_FEED_ITEMS_ARCHIVED);
	});

	it("returns 400 if feed slug is invalid in path", async (t) => {
		const res = await app.request(`/feed/!!!/items`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(makeMockFeedItem("test1")),
		});
		t.assert.equal(res.status, 400);
	});

	it("returns 400 on invalid fields in item", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		const res = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ ...makeMockFeedItem("test1"), description: 123 }),
		});
		t.assert.equal(res.status, 400);
	});

	it("returns 400 on missing required fields in item", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		// biome-ignore lint/suspicious/noExplicitAny: explicitly messing with the object
		const payload: any = makeMockFeedItem("test1");
		delete payload.title;
		const res = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});
		t.assert.equal(res.status, 400);
	});

	it("returns 404 on bad feed slug in path", async (t) => {
		const res = await app.request(`/feed/bad-slug/items`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(makeMockFeedItem("test1")),
		});
		t.assert.equal(res.status, 404);
	});

	it("returns 409 on attempts to create an item with already existing slug in the feed", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		const initialResp = await create();
		t.assert.equal(initialResp.status, 201);
		const secondResp = await create();
		t.assert.equal(secondResp.status, 409);

		async function create() {
			return await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(makeMockFeedItem("test1")),
			});
		}
	});

	it("items with the same slug can be inserted in different feeds", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		await feedRepository.createFeed({ ...mockFeedPayload, slug: "test2" });
		const initialResp = await create(mockFeedPayload.slug);
		t.assert.equal(initialResp.status, 201);
		const secondResp = await create("test2");
		t.assert.equal(secondResp.status, 201);

		async function create(feedSlug: string) {
			return await app.request(`/feed/${encodeURIComponent(feedSlug)}/items`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(makeMockFeedItem("test1")),
			});
		}
	});

	it("returns 401 on unauthorized requests", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		const testKey = "test-key";
		const initialResp = await makeRequest(undefined);
		t.assert.equal(initialResp.status, 401);
		const authorizedResp = await makeRequest(testKey);
		t.assert.equal(authorizedResp.status, 201);

		async function makeRequest(key: string | undefined) {
			return await app.request(
				`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...(key
							? {
									[API_KEY_HEADER_NAME]: key,
								}
							: {}),
					},
					body: JSON.stringify(makeMockFeedItem("test1")),
				},
				{
					API_KEY: testKey,
				} satisfies NodeJS.ProcessEnv
			);
		}
	});
}); // POST /feed/:feedSlug/items/
