import assert from "node:assert/strict";
import test, { describe, it } from "node:test";
import type { AuthorModel } from "./author.ts";
import { type FeedItemModel, isFeedItemsValueEqual } from "./feedItem.ts";

const testDate = new Date("2025-01-01T10:30:00.000Z");

const mockFeedItem: Required<FeedItemModel> = {
	slug: "slug",
	title: "title",
	description: "description",
	content: "content",
	date: testDate,
	link: "link",
	id: 0,
	createdAt: testDate,
	modifiedAt: testDate,
	image: "image",
	authors: [
		{
			link: "link",
			name: "name",
			email: "email",
			avatar: "avatar",
		} satisfies Required<AuthorModel>,
	],
	contributors: [
		{
			link: "link",
			name: "name",
			email: "email",
			avatar: "avatar",
		} satisfies Required<AuthorModel>,
	],
};

const optionalFields: ReadonlyArray<keyof FeedItemModel> = ["image", "authors", "contributors"];
const allFields = Object.keys(mockFeedItem).filter(
	(key) => !["id", "createdAt", "modifiedAt"].includes(key) // those fields are omitted from comparison
) as ReadonlyArray<keyof FeedItemModel>;

describe("isFeedItemsValueEqual", () => {
	it("returns true if all of the field match", () => {
		const result = isFeedItemsValueEqual(mockFeedItem, { ...mockFeedItem });
		assert.equal(result, true);
	});

	it("returns true if optional field is undefined in source, but something else in target", () => {
		for (const field of optionalFields) {
			test(field, () => {
				const result1 = isFeedItemsValueEqual({ ...mockFeedItem, [field]: undefined }, { ...mockFeedItem });
				assert.equal(result1, true, `${field} value present`);
				const result2 = isFeedItemsValueEqual(
					{ ...mockFeedItem, [field]: undefined },
					{ ...mockFeedItem, [field]: null }
				);
				assert.equal(result2, true, `${field} value is null`);
			});
		}
	});

	it("returns false if optional field is null in source, but something else in target", () => {
		for (const field of optionalFields) {
			test(field, () => {
				const result1 = isFeedItemsValueEqual({ ...mockFeedItem, [field]: null }, { ...mockFeedItem });
				assert.equal(result1, false, `${field}: value present`);
			});
		}
	});

	it("returns false if any of the fields are different", () => {
		for (const field of allFields) {
			test(field, () => {
				const result1 = isFeedItemsValueEqual(mockFeedItem, modifyField(mockFeedItem, field));
				assert.equal(result1, false, `${field}: value present`);
			});
		}
	});

	it("if optional field is null in source, it can be either null or undefined in target", () => {
		for (const field of optionalFields) {
			test(field, () => {
				const result1 = isFeedItemsValueEqual({ ...mockFeedItem, [field]: null }, { ...mockFeedItem, [field]: null });
				assert.equal(result1, true, "value is null");
				const result2 = isFeedItemsValueEqual(
					{ ...mockFeedItem, [field]: null },
					{ ...mockFeedItem, [field]: undefined }
				);
				assert.equal(result2, true, "value is undefined");
			});
		}
	});
});

function modifyField(item: Required<FeedItemModel>, field: keyof FeedItemModel): FeedItemModel {
	const currentValue = item[field];
	switch (typeof currentValue) {
		case "string":
			return { ...item, [field]: "modified" };
		case "number":
			return { ...item, [field]: 32167 };
		case "object":
			if (currentValue instanceof Date) {
				return { ...item, [field]: new Date("1989-01-01T10:30:00.000Z") };
			}
			if (Array.isArray(currentValue)) {
				return { ...item, [field]: [] };
			}
			throw new Error(`unknown object type ${currentValue}`);
		default:
			throw new Error(`unknown field type to modify ${typeof currentValue}`);
	}
}
