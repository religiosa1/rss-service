import { pathToFileURL } from "node:url";

const uriRe = /^\w{0,6}:\/\//;

/**
 * Ensures that provided string is a url (based on a dumb RE check).
 *
 * If it's not, interpreting it as a path and converting to a file url.
 */
export function ensureUrl(pathOrUrl: string): string {
	if (uriRe.test(pathOrUrl)) {
		return pathOrUrl;
	}
	return pathToFileURL(pathOrUrl).toString();
}
