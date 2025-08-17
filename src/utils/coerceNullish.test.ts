import * as assert from "node:assert";
import { describe, it } from "node:test";
import { coerceNullish } from "./coerceNullish.ts";

const expectTypeOf = <T>(_value: T) => ({
	toBe<V extends T>() {
		return undefined as V as unknown;
	},
});

describe("coerceNullish", () => {
	interface TestObj {
		nullOnly: null;
		nullOrUndefined: null | undefined;
		stringOrNull: string | null;
		nullishString: string | null | undefined;
		stringOrUndefined: string | undefined;
		stringOnly: string;
	}
	interface WantObj {
		nullOnly: undefined;
		nullOrUndefined: undefined;
		stringOrNull: string | undefined;
		nullishString: string | undefined;
		stringOrUndefined: string | undefined;
		stringOnly: string;
	}
	const testObj: TestObj = {
		nullOnly: null,
		nullOrUndefined: null,
		stringOrNull: null,
		nullishString: null,
		stringOrUndefined: "asdf",
		stringOnly: "asdf",
	};

	it("replaces all null values with undefined", () => {
		const got = coerceNullish(testObj);
		assert.deepEqual(got, {
			nullOnly: undefined,
			nullOrUndefined: undefined,
			stringOrNull: undefined,
			nullishString: undefined,
			stringOrUndefined: "asdf",
			stringOnly: "asdf",
		});
		expectTypeOf(got).toBe<WantObj>();
	});
});
