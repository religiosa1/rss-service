import { describe, it } from "node:test";
import { app } from "../../src/app.ts";
import { API_KEY_HEADER_NAME } from "../../src/constants.ts";
import * as feedItemRepository from "../../src/repositories/feedItemRepository.ts";
import * as feedRepository from "../../src/repositories/feedRepository.ts";
import { makeMockFeedItem, mockFeedPayload } from "../mocks.ts";
import { setupTestEnvironment } from "../setup.ts";

describe("PATCH /feed/:feedSlug/items/:feedItemSlug", () => {
	setupTestEnvironment();

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
		t.assert.equal(resp.status, 200);
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
		t.assert.equal(resp.status, 200);
		const respPayload = await resp.json();
		t.assert.snapshot(respPayload);
	});

	it("returns 409 on attempts to change a feed item slug to an already existing in the feed slug", async (t) => {
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
		t.assert.equal(resp.status, 409);
	});

	it("returns 400 on invalid feedSlug param", async (t) => {
		const resp = await app.request(`/feed/!!!/items/test1`, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(makeMockFeedItem("test1")),
		});
		t.assert.equal(resp.status, 400);
	});

	it("returns 400 on invalid feedItemSlug param", async (t) => {
		const resp = await app.request(`/feed/test/items/!!!`, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(makeMockFeedItem("test1")),
		});
		t.assert.equal(resp.status, 400);
	});

	it("returns 400 on invalid fields in body", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		await feedItemRepository.createFeedItem(mockFeedPayload.slug, makeMockFeedItem("test1"));
		const resp = await app.request(`/feed/${mockFeedPayload.slug}/items/test1`, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ description: 123 }),
		});
		t.assert.equal(resp.status, 400);
	});

	it("returns 404 on non-existing feedSlug param", async (t) => {
		const resp = await app.request(`/feed/bad-slug/items/blah`, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(makeMockFeedItem("test1")),
		});
		t.assert.equal(resp.status, 404);
	});

	it("returns 404 on non-existing feedItemSlug param", async (t) => {
		await feedRepository.createFeed(mockFeedPayload);
		const resp = await app.request(`/feed/${encodeURIComponent(mockFeedPayload.slug)}/items/bad-slug`, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(makeMockFeedItem("test1")),
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
