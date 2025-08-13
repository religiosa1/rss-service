import { before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { DateMocker, type Jsonify } from "./helpers.ts";
import { fixedDateStr, mockTimers } from "./setup.ts";
import { resetDbConnection } from "../src/db/db.ts";
import { migrate } from "../src/db/migrate.ts";
import { app } from "../src/app.ts";
import { API_KEY_HEADER_NAME } from "../src/constants.ts";
import * as feedRepository from "../src/repositories/feed.ts";

before(() => {
	mockTimers();
});

beforeEach(async () => {
	// ensurrring each test works with a clean in memory version of db.
	resetDbConnection(":memory:");
	await migrate();
});

describe("feed items", () => {
	describe("GET /feed/:feedSlug/items/", () => {
		it("retrieves a list of current items in a feed", () => {});

		it("retrieves only ${MAX_FEED_ITEMS}, anything beyond that is considered archived", () => {});
	}); // GET /feed/:feedSlug/items/

	describe("GET /feed/:feedSlug/items/all", () => {}); // GET /feed/:feedSlug/items/all

	describe("POST /feed/:feedSlug/items/", () => {}); // POST /feed/:feedSlug/items/

	describe("PATCH /feed/:feedSlug/items/:feedItemSlug", () => {}); // PATCH /feed/:feedSlug/items/:feedItemSlug

	describe("DELETE /feed/:feedSlug/items/:feedItemSlug", () => {}); // DELETE /feed/:feedSlug/items/:feedItemSlug
});
