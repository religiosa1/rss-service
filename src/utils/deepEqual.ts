export function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (a == null || b == null) return a === b;
	if (typeof a !== "object" || typeof b !== "object") return a === b;

	if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;

	const keysA = Object.keys(a);
	const keysB = Object.keys(b);

	if (keysA.length !== keysB.length) return false;

	for (const key of keysA) {
		if (!keysB.includes(key)) return false;

		const valueA = (a as any)[key];
		const valueB = (b as any)[key];

		if (typeof valueA === "object" && typeof valueB === "object") {
			if (!deepEqual(valueA, valueB)) return false;
		} else if (valueA !== valueB) {
			return false;
		}
	}

	return true;
}
