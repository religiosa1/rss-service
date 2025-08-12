export type CoercedNullishUndefined<T extends object> = {
	[K in keyof T]: null extends T[K] ? (T[K] extends null ? undefined : Exclude<T[K], null> | undefined) : T[K];
};
export function coerceNullish<T extends object>(item: T): CoercedNullishUndefined<T> {
	return Object.fromEntries(Object.entries(item).map(([k, v]) => [k, v ?? undefined])) as CoercedNullishUndefined<T>;
}
