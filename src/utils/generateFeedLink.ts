import { attempt } from "./errors.ts";

export function generateFeedLink(feedSlug: string, publicUrl = process.env.PUBLIC_URL): string {
	const feedComp = `feed/${encodeURIComponent(feedSlug)}`;

	const [baseUrl] = attempt(() => new URL(publicUrl!));
	const baseUrlString = baseUrl ? baseUrl.origin + baseUrl.pathname : publicUrl ?? "";

	return baseUrlString.endsWith("/")
		? baseUrlString + feedComp //
		: baseUrlString + "/" + feedComp;
}
