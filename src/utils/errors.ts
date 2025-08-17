import { LibsqlError } from "@libsql/client";
import { DrizzleQueryError } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export function raise(statusCode: ContentfulStatusCode, message?: string): never;
export function raise(
	statusCode: ContentfulStatusCode,
	options?: ConstructorParameters<typeof HTTPException>[1]
): never;
export function raise(
	statusCode: ContentfulStatusCode,
	optionsOrMessage?: string | ConstructorParameters<typeof HTTPException>[1]
): never {
	const options =
		typeof optionsOrMessage === "string"
			? {
					message: optionsOrMessage,
				}
			: optionsOrMessage;
	throw new HTTPException(statusCode, options);
}

/** Maps some known DB errors to the correct HTTP statuses */
export function mapDbError(error: unknown): never {
	if (error instanceof DrizzleQueryError && error.cause instanceof LibsqlError) {
		// Check for unique constraint violation
		if (error.cause.code === "SQLITE_CONSTRAINT_UNIQUE") {
			throw new HTTPException(409, {
				cause: error,
			});
		}
	}
	throw error;
}

export type ResultTuple<T> = [T, undefined] | [undefined, NonNullable<unknown>];
export function attempt<T>(action: () => T): ResultTuple<T> {
	try {
		const result = action();
		return [result, undefined];
	} catch (e) {
		return [undefined, e ?? new Error("Nullish error", { cause: e })];
	}
}
