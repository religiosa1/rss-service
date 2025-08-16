import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { partition } from "./partition.ts";

describe("partition", () => {
	describe("basic functionality", () => {
		it("partitions numbers into even and odd", () => {
			const numbers = [1, 2, 3, 4, 5, 6];
			const [even, odd] = partition(numbers, (n) => n % 2 === 0);

			assert.deepEqual(even, [2, 4, 6]);
			assert.deepEqual(odd, [1, 3, 5]);
		});

		it("partitions strings by length", () => {
			const words = ["cat", "elephant", "dog", "hippopotamus"];
			const [long, short] = partition(words, (word) => word.length > 3);

			assert.deepEqual(long, ["elephant", "hippopotamus"]);
			assert.deepEqual(short, ["cat", "dog"]);
		});

		it("partitions objects by property", () => {
			const users = [
				{ name: "Alice", active: true },
				{ name: "Bob", active: false },
				{ name: "Charlie", active: true },
				{ name: "David", active: false },
			];
			const [active, inactive] = partition(users, (user) => user.active);

			assert.deepEqual(active, [
				{ name: "Alice", active: true },
				{ name: "Charlie", active: true },
			]);
			assert.deepEqual(inactive, [
				{ name: "Bob", active: false },
				{ name: "David", active: false },
			]);
		});
	});

	describe("edge cases", () => {
		it("handles empty array", () => {
			const [positive, negative] = partition([], () => true);

			assert.deepEqual(positive, []);
			assert.deepEqual(negative, []);
		});

		it("handles all items matching predicate", () => {
			const numbers = [2, 4, 6, 8];
			const [even, odd] = partition(numbers, (n) => n % 2 === 0);

			assert.deepEqual(even, [2, 4, 6, 8]);
			assert.deepEqual(odd, []);
		});

		it("handles no items matching predicate", () => {
			const numbers = [1, 3, 5, 7];
			const [even, odd] = partition(numbers, (n) => n % 2 === 0);

			assert.deepEqual(even, []);
			assert.deepEqual(odd, [1, 3, 5, 7]);
		});

		it("handles single item array", () => {
			const [positive, negative] = partition([5], (n) => n > 0);

			assert.deepEqual(positive, [5]);
			assert.deepEqual(negative, []);
		});
	});

	describe("predicate with index and array parameters", () => {
		it("uses index parameter in predicate", () => {
			const items = ["a", "b", "c", "d"];
			const [evenIndex, oddIndex] = partition(items, (_item, index) => index % 2 === 0);

			assert.deepEqual(evenIndex, ["a", "c"]);
			assert.deepEqual(oddIndex, ["b", "d"]);
		});

		it("uses array parameter in predicate", () => {
			const numbers = [1, 2, 3];
			const [aboveAverage, belowAverage] = partition(numbers, (item, _index, array) => {
				const average = array.reduce((sum, n) => sum + n, 0) / array.length;
				return item > average;
			});

			assert.deepEqual(aboveAverage, [3]);
			assert.deepEqual(belowAverage, [1, 2]);
		});
	});

	describe("truthy/falsy predicate results", () => {
		it("treats truthy values as positive", () => {
			const items = [1, 2, 3, 4];
			const [positive, negative] = partition(items, (n) => (n > 2 ? "truthy" : null));

			assert.deepEqual(positive, [3, 4]);
			assert.deepEqual(negative, [1, 2]);
		});

		it("treats falsy values as negative", () => {
			const items = [0, 1, 2, ""];
			const [positive, negative] = partition(items, (item) => item);

			assert.deepEqual(positive, [1, 2]);
			assert.deepEqual(negative, [0, ""]);
		});
	});

	describe("type preservation", () => {
		it("preserves array element types", () => {
			const mixed: (string | number)[] = ["hello", 42, "world", 13];
			const [strings, numbers] = partition(mixed, (item) => typeof item === "string");

			// Type assertion to verify types are preserved
			const stringResult: string[] = strings;
			const numberResult: (string | number)[] = numbers;

			assert.deepEqual(stringResult, ["hello", "world"]);
			assert.deepEqual(numberResult, [42, 13]);
		});
	});

	describe("does not mutate original array", () => {
		it("leaves original array unchanged", () => {
			const original = [1, 2, 3, 4, 5];
			const originalCopy = [...original];

			partition(original, (n) => n % 2 === 0);

			assert.deepEqual(original, originalCopy);
		});
	});
});
