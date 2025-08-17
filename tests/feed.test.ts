import assert from "node:assert/strict";
import { unlinkSync } from "node:fs";
import { before, beforeEach, describe, it } from "node:test";
import { app } from "../src/app.ts";
import { API_KEY_HEADER_NAME } from "../src/constants.ts";
import { resetDbConnection } from "../src/db/db.ts";
import { migrate } from "../src/db/migrate.ts";
import type { FeedModel, FeedUpdateModel } from "../src/models/feed.ts";
import * as feedItemRepository from "../src/repositories/feedItemRepository.ts";
import * as feedRepository from "../src/repositories/feedRepository.ts";
import { DateMocker, type Jsonify, mkTmpDbFile, mockTimers } from "./helpers.ts";
import { makeMockFeedItem, mockAuthor, mockFeedPayload, mockFeedResult } from "./mocks.ts";

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

describe("feed", () => {
	describe("GET /feed", () => {
		it("returns a list of existing feeds", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			await feedRepository.createFeed({ ...mockFeedPayload, slug: "test2" });

			const res = await app.request("/feed");
			const responsePayload = await res.json();
			assert.deepEqual(responsePayload, [
				mockFeedResult,
				{ ...mockFeedResult, id: 2, slug: "test2", link: "/feed/test2" },
			]);
			assert.equal(res.status, 200);
		});

		it("returns an empty list, if no feed is present in the db", async () => {
			const res = await app.request("/feed");
			assert.deepEqual(await res.json(), []);
			assert.equal(res.status, 200);
		});

		it("updated field on the feed depends on the newest fieldItem date", async () => {
			using dateMocker = new DateMocker();
			await feedRepository.createFeed(mockFeedPayload);
			const initialPayload = await getFeed();
			assert.equal(initialPayload.updatedAt, dateMocker.getCurrentTime().toISOString());

			const secondDate = dateMocker.advanceTime(3000);
			await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test1", secondDate));
			const secondPayload = await getFeed();
			// we're using date from the feedItem now
			assert.equal(secondPayload.updatedAt, secondDate.toISOString());

			dateMocker.advanceTime(3000);
			// new item will be published "before", it's creation, so it createdAt will be newer, but actual date is older
			await feedItemRepository.createFeedItem(
				mockFeedPayload.slug,
				makeMockFeedItem("test2", new Date(secondDate.getTime() - 1000))
			);
			const thirdPayload = await getFeed();
			// we're still be using second date value, as it's date is newer
			assert.equal(thirdPayload.updatedAt, secondDate.toISOString());

			async function getFeed() {
				const res = await app.request("/feed");
				const payload: Jsonify<FeedModel>[] = await res.json();
				if (payload[0] == null) {
					throw new Error();
				}
				return payload[0];
			}
		});

		it("returns the provided author object", async () => {
			await feedRepository.createFeed({ ...mockFeedPayload, author: mockAuthor });
			const res = await app.request("/feed");
			const responsePayload = await res.json();
			assert.deepEqual(responsePayload[0].author, mockAuthor);
		});
	}); // GET /feed

	describe("GET /feed/:feedSlug", () => {
		it("returns a rss feed", async (t) => {
			await feedRepository.createFeed(mockFeedPayload);
			using dateMocker = new DateMocker();
			await feedItemRepository.createFeedItem(
				mockFeedPayload.slug,
				makeMockFeedItem("test1", dateMocker.advanceTime(1000))
			);
			await feedItemRepository.createFeedItem(
				mockFeedPayload.slug,
				makeMockFeedItem("test2", dateMocker.advanceTime(1000))
			);
			const res = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}`);
			assert.equal(res.status, 200);
			assert.equal(res.headers.get("Content-Type"), "application/rss+xml");
			t.assert.snapshot(await res.text());
		});

		it("returns 400 on invalid feedSlug param", async () => {
			const res = await app.request(`/feed/$$$`);
			assert.equal(res.status, 400);
		});

		it("returns 404 if non-existing feedSlug is specified", async () => {
			const res = await app.request(`/feed/bad-slug`);
			assert.equal(res.status, 404);
		});
	}); // GET /feed/:feedSlug

	describe("POST /feed", () => {
		it("creates a new feed item", async () => {
			const res = await app.request("/feed", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(mockFeedPayload),
			});
			const responsePayload = await res.json();
			assert.deepEqual(responsePayload, mockFeedResult);
			assert.equal(res.status, 201);
		});

		it("allows to create author object", async () => {
			const res = await app.request("/feed", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					...mockFeedPayload,
					author: mockAuthor,
				} satisfies FeedUpdateModel),
			});
			const responsePayload = await res.json();
			assert.deepEqual(responsePayload, { ...mockFeedResult, author: mockAuthor });
			assert.equal(res.status, 201);
		});

		it("returns 400 on missing required fields in payload", async () => {
			const res = await app.request("/feed", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ mockFeedPayload, slug: undefined }),
			});
			assert.equal(res.status, 400);
		});

		it("returns 400 on invalid fields", async () => {
			const res = await app.request("/feed", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ mockFeedPayload, slug: 123 }),
			});
			assert.equal(res.status, 400);
		});

		it("returns 409 on attempts to create a feed with an already existing slug", async () => {
			const initialResp = await app.request("/feed", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(mockFeedPayload),
			});
			assert.equal(initialResp.status, 201);
			const res = await app.request("/feed", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(mockFeedPayload),
			});
			assert.equal(res.status, 409);
		});

		it("returns 401 on unauthorized requests", async () => {
			const testKey = "test-key";
			const initialResp = await makeRequest(undefined);
			assert.equal(initialResp.status, 401);
			const authorizedResp = await makeRequest(testKey);
			assert.equal(authorizedResp.status, 201);

			function makeRequest(key: string | undefined) {
				return app.request(
					"/feed",
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
						body: JSON.stringify(mockFeedPayload),
					},
					{
						API_KEY: testKey,
					} satisfies NodeJS.ProcessEnv
				);
			}
		});
	}); // POST /feed

	describe("PATCH /feed/:feedSlug", () => {
		it("updates existing feed", async () => {
			using dateMocker = new DateMocker();
			await feedRepository.createFeed({ ...mockFeedPayload, author: mockAuthor });
			const newDescription = "other desc";
			const newDate = dateMocker.advanceTime(1000);
			const resp = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ description: newDescription } satisfies Partial<FeedUpdateModel>),
			});
			const responsePayload = await resp.json();
			assert.deepEqual(responsePayload, {
				...mockFeedResult,
				author: mockAuthor, // should be still in place, as we didn't pass it in payload
				description: newDescription,
				modifiedAt: newDate.toISOString(),
			} satisfies Jsonify<FeedModel>);
			assert.equal(resp.status, 200);
		});

		it("allows to rename the feed", async () => {
			using dateMocker = new DateMocker();
			await feedRepository.createFeed(mockFeedPayload);
			const newDate = dateMocker.advanceTime(1000);
			const newSlug = "new_slug";
			const resp = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ slug: newSlug } satisfies Partial<FeedUpdateModel>),
			});
			const responsePayload = await resp.json();
			assert.deepEqual(responsePayload, {
				...mockFeedResult,
				slug: newSlug,
				link: "/feed/new_slug",
				modifiedAt: newDate.toISOString(),
			} satisfies Jsonify<FeedModel>);
			assert.equal(resp.status, 200);
		});

		it("allows to add an author", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			const resp = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ author: mockAuthor } satisfies Partial<FeedUpdateModel>),
			});
			const responsePayload = await resp.json();
			assert.deepEqual(responsePayload.author, mockAuthor);
			assert.equal(resp.status, 200);
		});

		it("allows to delete an existing author", async () => {
			await feedRepository.createFeed({ ...mockFeedPayload, author: mockAuthor });
			const resp = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ author: null } satisfies Partial<FeedUpdateModel>),
			});
			const responsePayload = await resp.json();
			assert.equal(responsePayload.author, null);
			assert.equal(resp.status, 200);
		});

		it("allows to modify an existing author", async () => {
			await feedRepository.createFeed({ ...mockFeedPayload, author: mockAuthor });
			const resp = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ author: { name: "Jane Doe" } } satisfies Partial<FeedUpdateModel>),
			});
			const responsePayload = await resp.json();
			assert.deepEqual(responsePayload.author, { name: "Jane Doe" });
			assert.equal(resp.status, 200);
		});

		it("returns 400 on invalid feedSlug param", async () => {
			const res = await app.request(`/feed/!!!`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ slug: 123 }),
			});
			assert.equal(res.status, 400);
		});

		it("returns 400 on invalid fields", async () => {
			const res = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ slug: 123 }),
			});
			assert.equal(res.status, 400);
		});

		it("returns 409 on attempts to update a slug to already existing value", async () => {
			const newSlug = "test2";
			await feedRepository.createFeed(mockFeedPayload);
			await feedRepository.createFeed({ ...mockFeedPayload, slug: newSlug });

			const resp = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ slug: newSlug } satisfies Partial<FeedUpdateModel>),
			});
			assert.equal(resp.status, 409);
		});

		it("returns 404 if called with a non-existing feedSlug to update", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			const resp = await app.request("/feed/bad-slug", {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ description: "blah" } satisfies Partial<FeedUpdateModel>),
			});
			console.log("resp body", await resp.text());
			assert.equal(resp.status, 404);
		});

		it("returns 401 on authorized requests", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			const testKey = "test-key";
			const initialResp = await makeRequest(undefined);
			assert.equal(initialResp.status, 401);
			const authorizedResp = await makeRequest(testKey);
			assert.equal(authorizedResp.status, 200);

			function makeRequest(key: string | undefined) {
				return app.request(
					`/feed/${encodeURIComponent(mockFeedPayload.slug)}`,
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
						body: JSON.stringify({ description: "foo" }),
					},
					{
						API_KEY: testKey,
					} satisfies NodeJS.ProcessEnv
				);
			}
		});
	}); // PATCH /feed/:feedSlug

	describe("DELETE /feed/:feedSlug", () => {
		it("deletes an existing feed", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			const resp = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}`, {
				method: "DELETE",
			});
			assert.equal(resp.status, 204);
			const feed = await feedRepository.readFeed(mockFeedPayload.slug);
			assert.equal(feed, undefined);
		});

		it("returns 404 if called with a non-existing slug", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			const resp = await app.request(`/feed/bad-slug`, {
				method: "DELETE",
			});
			assert.equal(resp.status, 404);
		});

		it("returns 401 on authorized requests", async () => {
			await feedRepository.createFeed(mockFeedPayload);
			const testKey = "test-key";
			const initialResp = await makeRequest(undefined);
			assert.equal(initialResp.status, 401);
			const authorizedResp = await makeRequest(testKey);
			assert.equal(authorizedResp.status, 204);

			function makeRequest(key: string | undefined) {
				return app.request(
					`/feed/${encodeURIComponent(mockFeedPayload.slug)}`,
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
	}); // DELETE /feed/:feedSlug
});
