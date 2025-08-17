import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deepEqual } from "./deepEqual.ts";

describe("deepEqual", () => {
	describe("primitive values", () => {
		it("returns true for identical primitives", () => {
			assert.equal(deepEqual(1, 1), true);
			assert.equal(deepEqual("hello", "hello"), true);
			assert.equal(deepEqual(true, true), true);
			assert.equal(deepEqual(false, false), true);
		});

		it("returns false for different primitives", () => {
			assert.equal(deepEqual(1, 2), false);
			assert.equal(deepEqual("hello", "world"), false);
			assert.equal(deepEqual(true, false), false);
			assert.equal(deepEqual(1, "1"), false);
		});

		it("handles strict equality for same reference", () => {
			const obj = { a: 1 };
			assert.equal(deepEqual(obj, obj), true);
		});
	});

	describe("null and undefined", () => {
		it("returns true for null === null", () => {
			assert.equal(deepEqual(null, null), true);
		});

		it("returns true for undefined === undefined", () => {
			assert.equal(deepEqual(undefined, undefined), true);
		});

		it("returns false for null vs undefined", () => {
			assert.equal(deepEqual(null, undefined), false);
		});

		it("returns false when one value is null", () => {
			assert.equal(deepEqual(null, {}), false);
			assert.equal(deepEqual({}, null), false);
		});

		it("returns false when one value is undefined", () => {
			assert.equal(deepEqual(undefined, {}), false);
			assert.equal(deepEqual({}, undefined), false);
		});
	});

	describe("objects", () => {
		it("returns true for empty objects", () => {
			assert.equal(deepEqual({}, {}), true);
		});

		it("returns true for objects with same properties", () => {
			assert.equal(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 }), true);
		});

		it("returns true for objects with same properties in different order", () => {
			assert.equal(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
		});

		it("returns false for objects with different properties", () => {
			assert.equal(deepEqual({ a: 1, b: 2 }, { a: 1, b: 3 }), false);
		});

		it("returns false for objects with different number of properties", () => {
			assert.equal(deepEqual({ a: 1 }, { a: 1, b: 2 }), false);
			assert.equal(deepEqual({ a: 1, b: 2 }, { a: 1 }), false);
		});

		it("returns false for objects with different keys", () => {
			assert.equal(deepEqual({ a: 1 }, { b: 1 }), false);
		});
	});

	describe("nested objects", () => {
		it("returns true for nested objects with same structure", () => {
			const obj1 = { a: { b: { c: 1 } } };
			const obj2 = { a: { b: { c: 1 } } };
			assert.equal(deepEqual(obj1, obj2), true);
		});

		it("returns false for nested objects with different values", () => {
			const obj1 = { a: { b: { c: 1 } } };
			const obj2 = { a: { b: { c: 2 } } };
			assert.equal(deepEqual(obj1, obj2), false);
		});

		it("returns false for nested objects with different structure", () => {
			const obj1 = { a: { b: 1 } };
			const obj2 = { a: { c: 1 } };
			assert.equal(deepEqual(obj1, obj2), false);
		});

		it("handles mixed nested structures", () => {
			const obj1 = { a: 1, b: { c: 2, d: { e: 3 } } };
			const obj2 = { a: 1, b: { c: 2, d: { e: 3 } } };
			assert.equal(deepEqual(obj1, obj2), true);
		});
	});

	describe("arrays", () => {
		it("returns true for empty arrays", () => {
			assert.equal(deepEqual([], []), true);
		});

		it("returns true for arrays with same elements", () => {
			assert.equal(deepEqual([1, 2, 3], [1, 2, 3]), true);
		});

		it("returns false for arrays with different elements", () => {
			assert.equal(deepEqual([1, 2, 3], [1, 2, 4]), false);
		});

		it("returns false for arrays with different length", () => {
			assert.equal(deepEqual([1, 2], [1, 2, 3]), false);
		});

		it("returns false for arrays with same elements in different order", () => {
			assert.equal(deepEqual([1, 2, 3], [3, 2, 1]), false);
		});

		it("handles nested arrays", () => {
			assert.equal(
				deepEqual(
					[
						[1, 2],
						[3, 4],
					],
					[
						[1, 2],
						[3, 4],
					]
				),
				true
			);
			assert.equal(
				deepEqual(
					[
						[1, 2],
						[3, 4],
					],
					[
						[1, 2],
						[3, 5],
					]
				),
				false
			);
		});
	});

	describe("mixed object types", () => {
		it("returns false when comparing object to array", () => {
			assert.equal(deepEqual({}, []), false);
			assert.equal(deepEqual([], {}), false);
		});

		it("returns false when comparing object to primitive", () => {
			assert.equal(deepEqual({}, ""), false);
			assert.equal(deepEqual(1, {}), false);
		});

		it("returns false when comparing objects with different prototypes", () => {
			class TestClass {}
			const instance = new TestClass();
			assert.equal(deepEqual({}, instance), false);
			assert.equal(deepEqual(instance, {}), false);
		});

		it("handles objects with array properties", () => {
			const obj1 = { a: [1, 2, 3], b: "test" };
			const obj2 = { a: [1, 2, 3], b: "test" };
			assert.equal(deepEqual(obj1, obj2), true);

			const obj3 = { a: [1, 2, 3], b: "test" };
			const obj4 = { a: [1, 2, 4], b: "test" };
			assert.equal(deepEqual(obj3, obj4), false);
		});

		it("handles arrays with object elements", () => {
			const arr1 = [{ a: 1 }, { b: 2 }];
			const arr2 = [{ a: 1 }, { b: 2 }];
			assert.equal(deepEqual(arr1, arr2), true);

			const arr3 = [{ a: 1 }, { b: 2 }];
			const arr4 = [{ a: 1 }, { b: 3 }];
			assert.equal(deepEqual(arr3, arr4), false);
		});
	});

	describe("edge cases", () => {
		it("handles objects with null values", () => {
			assert.equal(deepEqual({ a: null }, { a: null }), true);
			assert.equal(deepEqual({ a: null }, { a: undefined }), false);
		});

		it("handles objects with undefined values", () => {
			assert.equal(deepEqual({ a: undefined }, { a: undefined }), true);
			assert.equal(deepEqual({ a: undefined }, { a: null }), false);
		});

		it("handles complex nested structures", () => {
			const complex1 = {
				a: 1,
				b: {
					c: [1, 2, { d: "test" }],
					e: null,
					f: undefined,
				},
				g: [{ h: true }, { i: false }],
			};
			const complex2 = {
				a: 1,
				b: {
					c: [1, 2, { d: "test" }],
					e: null,
					f: undefined,
				},
				g: [{ h: true }, { i: false }],
			};
			assert.equal(deepEqual(complex1, complex2), true);

			const complex3 = {
				...complex1,
				b: { ...complex1.b, e: undefined },
			};
			assert.equal(deepEqual(complex1, complex3), false);
		});
	});
});
