import assert from "node:assert/strict";
import { unlinkSync } from "node:fs";
import { before, beforeEach, describe, it } from "node:test";
import { app } from "../src/app.ts";
import { API_KEY_HEADER_NAME, MAX_FEED_ITEMS, MAX_FEED_ITEMS_ARCHIVED } from "../src/constants.ts";

import { db, resetDbConnection } from "../src/db/db.ts";
import { schema } from "../src/db/index.ts";
import { migrate } from "../src/db/migrate.ts";
import type { FeedItemModel, FeedItemUpdateModel } from "../src/models/feedItem.ts";
import * as feedItemRepository from "../src/repositories/feedItemRepository.ts";
import * as feedRepository from "../src/repositories/feedRepository.ts";

import { DateMocker, type Jsonify, mkTmpDbFile, mockTimers, responseToPayload } from "./helpers.ts";
import { makeMockFeedItem, mockFeedPayload } from "./mocks.ts";

before(() => {
	mockTimers();
});

beforeEach(async (t) => {
	// ensuring each test works with a clean in memory version of db.
	// Initial idea was to run this in :memory:, but there's a bug with libsql
	// https://github.com/tursodatabase/libsql-client-ts/issues/140
	// So we're opting for temporary files instead.
	const tmpDbFile = mkTmpDbFile();
	resetDbConnection(tmpDbFile);
	await migrate();

	if ("after" in t) {
		t.after(() => {
			unlinkSync(tmpDbFile);
		});
	}
});

describe("feed items", () => {
	describe("GET /feed/:feedSlug/items/", () => {
		it("retrieves a list of current items in a feed", async (t) => {
			await feedRepository.createFeed(mockFeedPayload);
			await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test1"));
			await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test2"));
			const res = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items`);
			assert.equal(res.status, 200);
			const responsePayload = await res.json();
			t.assert.snapshot(responsePayload);
		});

		it("retrieves only MAX_FEED_ITEMS, anything beyond that is considered archived", async () => {
			using dateMocker = new DateMocker();
			await feedRepository.createFeed(mockFeedPayload);
			for (let i = 0; i < MAX_FEED_ITEMS + 5; i++) {
				const date = dateMocker.advanceTime(3000);
				await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test" + i, date));
			}
			const res = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items`);
			const responsePayload = await res.json();
			assert.equal(res.status, 200);
			assert.equal(responsePayload.length, MAX_FEED_ITEMS);
			assert.equal(responsePayload.at(-1).id, 6);
			assert.equal(responsePayload.at(0).id, 5 + MAX_FEED_ITEMS);
		});

		it("returns empty list for empty feeds", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			const res = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items`);
			assert.equal(res.status, 200);
			assert.deepEqual(await res.json(), []);
		});

		it("returns 400 status if feed slug is invalid in path", async () => {
			const res = await app.request(`/feed/!!!/items`);
			assert.equal(res.status, 400);
		});

		it("returns 404 on non-existing slug value", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			const res = await app.request(`/feed/bad-slug/items`);
			assert.equal(res.status, 404);
		});
	}); // GET /feed/:feedSlug/items/

	describe("GET /feed/:feedSlug/items/all", () => {
		it("retrieves all feed items", async () => {
			using dateMocker = new DateMocker();
			await feedRepository.createFeed(mockFeedPayload);
			for (let i = 0; i < MAX_FEED_ITEMS + 5; i++) {
				const date = dateMocker.advanceTime(3000);
				await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test" + i, date));
			}
			const res = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items/all`);
			const responsePayload: Array<FeedItemModel & { archived: boolean }> = await res.json();
			assert.equal(res.status, 200);
			assert.equal(responsePayload.length, MAX_FEED_ITEMS + 5);
			assert.equal(responsePayload.at(-1)?.id, 1);
			assert.equal(responsePayload.at(0)?.id, MAX_FEED_ITEMS + 5);
			assert(responsePayload.slice(0, MAX_FEED_ITEMS).every((i) => !i.archived));
			assert(responsePayload.slice(MAX_FEED_ITEMS).every((i) => i.archived));
		});

		it("returns 400 status if feed slug is invalid in path", async () => {
			const res = await app.request(`/feed/!!!/items/all`);
			assert.equal(res.status, 400);
		});

		it("returns 404 on non-existing slug value", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			const res = await app.request(`/feed/bad-slug/items/all`);
			assert.equal(res.status, 404);
		});
	}); // GET /feed/:feedSlug/items/all

	describe("POST /feed/:feedSlug/items/", () => {
		it("creates a new feed item", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			const res = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(makeMockFeedItem("test1")),
			});
			assert.equal(res.status, 201);
			const items = await feedItemRepository.getFeedItems(mockFeedPayload.slug);
			assert.equal(items.length, 1);
		});

		it("never creates more than MAX_FEED_ITEMS + MAX_FEED_ITEMS_ARCHIVED items", async () => {
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
			assert.equal(count, MAX_FEED_ITEMS + MAX_FEED_ITEMS_ARCHIVED);
		});

		it("returns 400 if feed slug is invalid in path", async () => {
			const res = await app.request(`/feed/!!!/items`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(makeMockFeedItem("test1")),
			});
			assert.equal(res.status, 400);
		});

		it("returns 400 on invalid fields in item", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			const res = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ ...makeMockFeedItem("test1"), description: 123 }),
			});
			assert.equal(res.status, 400);
		});

		it("returns 400 on missing required fields in item", async () => {
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
			assert.equal(res.status, 400);
		});

		it("returns 404 on bad feed slug in path", async () => {
			const res = await app.request(`/feed/bad-slug/items`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(makeMockFeedItem("test1")),
			});
			assert.equal(res.status, 404);
		});

		it("returns 409 on attempts to create an item with already existing slug in the feed", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			const initialResp = await create();
			assert.equal(initialResp.status, 201);
			const secondResp = await create();
			assert.equal(secondResp.status, 409);

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

		it("items with the same slug can be inserted in different feeds", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			await feedRepository.createFeed({ ...mockFeedPayload, slug: "test2" });
			const initialResp = await create(mockFeedPayload.slug);
			assert.equal(initialResp.status, 201);
			const secondResp = await create("test2");
			assert.equal(secondResp.status, 201);

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

		it("returns 401 on unauthorized requests", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			const testKey = "test-key";
			const initialResp = await makeRequest(undefined);
			assert.equal(initialResp.status, 401);
			const authorizedResp = await makeRequest(testKey);
			assert.equal(authorizedResp.status, 201);

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

	describe("PUT /feed/:feedSlug/items/", () => {
		it("allows to create multiple feedItems in one hit", async () => {
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
			assert.equal(resItems.length, 2);
			assert.deepEqual(resItems.map(responseToPayload), [item1, item2]);
			assert.equal(res.status, 200);
		});

		it("allows old items to be present in payload and doesn't update them if values are the same", async () => {
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
			assert.equal(items.length, 3);
			assert.equal(items[0].slug, insertedItem.slug);
			assert.equal(items[0].createdAt, newDate.toISOString(), "just inserted -- new date");
			assert.equal(items[0].modifiedAt, newDate.toISOString());

			assert.equal(items[1].slug, modifiedItem.slug);
			assert.equal(items[1].createdAt, oldDate.toISOString(), "is modified, but creation date should not change");
			assert.equal(items[1].modifiedAt, newDate.toISOString(), "is modified -- should be new date");

			assert.equal(items[2].slug, woChangeItem.slug);
			assert.equal(items[2].createdAt, oldDate.toISOString());
			assert.equal(items[2].modifiedAt, oldDate.toISOString(), "is not modified -- should be old date");

			assert.equal(res.status, 200);
		});

		it("returns 400 status if feed slug is invalid in path", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			const res = await app.request(`/feed/!!!/items`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify([makeMockFeedItem("test")]),
			});
			assert.equal(res.status, 400);
		});

		it("returns 400 status if payload contains malformed items", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			const res = await app.request(`/feed/!!!/items`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify([{ ...makeMockFeedItem("test"), description: 123 }]),
			});
			assert.equal(res.status, 400);
		});

		it("returns 404 if feed with provided feedSlug doesn't exist", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			const res = await app.request(`/feed/bad-slug/items`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify([makeMockFeedItem("test")]),
			});
			assert.equal(res.status, 404);
		});

		it("returns 409 on duplicated slugs in the payload", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			const res = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify([makeMockFeedItem("test"), makeMockFeedItem("test")]),
			});
			assert.equal(res.status, 409);
		});

		it("returns 413 if payload has more items than MAX_FEED_ITEMS", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			const res = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(Array.from({ length: MAX_FEED_ITEMS + 1 }, (_, i) => makeMockFeedItem("test" + i))),
			});
			assert.equal(res.status, 413);
		});

		it("returns 401 on unauthorized requests", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			const testKey = "test-key";
			const initialResp = await makeRequest(undefined);
			assert.equal(initialResp.status, 401);
			const authorizedResp = await makeRequest(testKey);
			assert.equal(authorizedResp.status, 200);

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

	describe("PATCH /feed/:feedSlug/items/:feedItemSlug", () => {
		it("updates an existing feed item", async (t) => {
			await feedRepository.createFeed(mockFeedPayload);
			await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test1"));
			const resp = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items/test1`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ title: "another title", content: "qwerty" }),
			});
			assert.equal(resp.status, 200);
			const respPayload = await resp.json();
			t.assert.snapshot(respPayload);
		});

		it("allows to change feed item slug", async (t) => {
			await feedRepository.createFeed(mockFeedPayload);
			await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test1"));
			const resp = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items/test1`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ slug: "test2" }),
			});
			assert.equal(resp.status, 200);
			const respPayload = await resp.json();
			t.assert.snapshot(respPayload);
		});

		it("returns 409 on attempts to change a feed item slug to an already existing in the feed slug", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test1"));
			await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test2"));
			const resp = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items/test1`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ slug: "test2" }),
			});
			assert.equal(resp.status, 409);
		});

		it("returns 400 on invalid feedSlug param", async () => {
			const resp = await app.request(`/feed/!!!/items/test1`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(makeMockFeedItem("test1")),
			});
			assert.equal(resp.status, 400);
		});

		it("returns 400 on invalid feedItemSlug param", async () => {
			const resp = await app.request(`/feed/test/items/!!!`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(makeMockFeedItem("test1")),
			});
			assert.equal(resp.status, 400);
		});

		it("returns 400 on invalid fields in body", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test1"));
			const resp = await app.request(`/feed/${mockFeedPayload.slug}/items/test1`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ description: 123 }),
			});
			assert.equal(resp.status, 400);
		});

		it("returns 404 on non-existing feedSlug param", async () => {
			const resp = await app.request(`/feed/bad-slug/items/blah`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(makeMockFeedItem("test1")),
			});
			assert.equal(resp.status, 404);
		});

		it("returns 404 on non-existing feedItemSlug param", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			const resp = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items/bad-slug`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(makeMockFeedItem("test1")),
			});
			assert.equal(resp.status, 404);
		});

		it("returns 401 on authorized requests", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test1"));
			const testKey = "test-key";
			const initialResp = await makeRequest(undefined);
			assert.equal(initialResp.status, 401);
			const authorizedResp = await makeRequest(testKey);
			assert.equal(authorizedResp.status, 200);

			function makeRequest(key: string | undefined) {
				return app.request(
					`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items/test1`,
					{
						method: "PATCH",
						headers: {
							"Content-Type": "application/json",
							...(key
								? {
										[API_KEY_HEADER_NAME]: key,
									}
								: {}),
						},
						body: JSON.stringify({ description: "qwerty" }),
					},
					{
						API_KEY: testKey,
					} satisfies NodeJS.ProcessEnv
				);
			}
		});
	}); // PATCH /feed/:feedSlug/items/:feedItemSlug

	describe("DELETE /feed/:feedSlug/items/:feedItemSlug", () => {
		it("deletes a feed item", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test1"));
			await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test2"));
			const initialCount = await db.$count(schema.feedItem);
			assert.equal(initialCount, 2);

			const resp = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items/test1`, {
				method: "DELETE",
			});
			assert.equal(resp.status, 204);
			const count = await db.$count(schema.feedItem);
			assert.equal(count, 1);
		});

		it("returns 400 on invalid feedSlug param", async () => {
			const resp = await app.request(`/feed/!!!/items/test1`, {
				method: "DELETE",
			});
			assert.equal(resp.status, 400);
		});

		it("returns 400 on invalid feedItemSlug param", async () => {
			const resp = await app.request(`/feed/test/items/!!!`, {
				method: "DELETE",
			});
			assert.equal(resp.status, 400);
		});

		it("returns 404 on non-existing feedSlug param", async () => {
			const resp = await app.request(`/feed/bad-slug/items/blah`, {
				method: "DELETE",
			});
			assert.equal(resp.status, 404);
		});

		it("returns 404 on non-existing feedItemSlug param", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			const resp = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items/bad-slug`, {
				method: "DELETE",
			});
			assert.equal(resp.status, 404);
		});

		it("returns 401 on authorized requests", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test1"));
			const testKey = "test-key";
			const initialResp = await makeRequest(undefined);
			assert.equal(initialResp.status, 401);
			const authorizedResp = await makeRequest(testKey);
			assert.equal(authorizedResp.status, 204);

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
});
