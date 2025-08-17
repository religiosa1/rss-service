import { attempt } from "./errors.ts";

export function generateFeedLink(feedSlug: string, publicUrl = process.env.PUBLIC_URL): string {
	const feedComp = `feed/${encodeURIComponent(feedSlug)}`;

	// biome-ignore lint/style/noNonNullAssertion: we expect url to throw on error and be caught by attempt
	const [baseUrl] = attempt(() => new URL(publicUrl!));
	const baseUrlString = baseUrl ? baseUrl.origin + baseUrl.pathname : (publicUrl ?? "");

	return baseUrlString.endsWith("/")
		? baseUrlString + feedComp //
		: baseUrlString + "/" + feedComp;
}
