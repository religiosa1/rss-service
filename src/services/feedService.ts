import { Feed } from "feed";
import { generatorValue } from "../globalContext.ts";
import { getFeedItems } from "../repositories/feedItemRepository.ts";
import { readFeed } from "../repositories/feedRepository.ts";
import { coerceNullish } from "../utils/coerceNullish.ts";
import { raise } from "../utils/errors.ts";

export async function getFeed(feedSlug: string, type: "atom" | "rss" | "json" = "atom"): Promise<string> {
	const dbFeed = (await readFeed(feedSlug)) ?? raise(404, "Unable to retrieve modified feed from DB");
	const feed = new Feed({
		title: dbFeed.title,
		description: dbFeed.description ?? undefined,
		id: dbFeed.slug,
		link: dbFeed.link,
		language: dbFeed.language ?? undefined,
		image: dbFeed.image ?? undefined,
		favicon: dbFeed.favicon ?? undefined,
		copyright: dbFeed.copyright ?? "unspecified",
		updated: new Date(dbFeed.updatedAt),
		generator: generatorValue,
		author: dbFeed.author ? coerceNullish(dbFeed.author) : undefined,
	});

	const feedItems = await getFeedItems(feedSlug);
	for (const item of feedItems) {
		feed.addItem({
			title: item.title,
			id: item.slug,
			link: item.link,
			description: item.description ?? undefined,
			content: item.content ?? undefined,
			date: new Date(item.date),
			image: item.image ?? undefined,
			author: item.authors?.map(coerceNullish) ?? undefined,
			contributor: item.contributors?.map(coerceNullish) ?? undefined,
		});
	}

	switch (type) {
		case "json":
			return feed.json1();
		case "rss":
			return feed.rss2();
		default:
			return feed.atom1();
	}
}
