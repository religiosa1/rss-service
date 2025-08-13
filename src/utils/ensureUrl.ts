import { pathToFileURL } from "node:url";

/**
 * Ensures that provided string is a url.
 *
 * If it's not, interpreting it as a path and converting to a file url.
 */
export function ensureUrl(pathOrUrl: string): string {
	// ':' is not allowed in file names, but it's present in url's and :memory: for sqlite
	const isUrl = pathOrUrl.includes(":");
	if (isUrl) {
		return pathOrUrl;
	}
	return pathToFileURL(pathOrUrl).toString();
}
