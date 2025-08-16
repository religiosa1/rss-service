export function partition<T, S extends T>(
	items: T[],
	predicate: (item: T, index: number, array: T[]) => item is S
): [positiveBucket: S[], negativeBucket: T[]];

export function partition<T>(
	items: T[],
	predicate: (item: T, index: number, array: T[]) => unknown
): [positiveBucket: T[], negativeBucket: T[]];

export function partition<T>(
	items: T[],
	predicate: (item: T, index: number, array: T[]) => unknown
): [positiveBucket: T[], negativeBucket: T[]] {
	const positiveBucket: T[] = [];
	const negativeBucket: T[] = [];
	for (let i = 0; i < items.length; i++) {
		const item = items[i]!;
		const targetBucket = predicate(item, i, items) ? positiveBucket : negativeBucket;
		targetBucket.push(item);
	}
	return [positiveBucket, negativeBucket];
}
