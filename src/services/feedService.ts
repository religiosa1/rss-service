import { Feed } from "feed";
import { readFeed } from "../repositories/feed.ts";
import { generatorValue } from "../globalContext.ts";
import { getFeedItems } from "../repositories/feedItem.ts";
import { coerceNullish } from "../utils/coerceNullish.ts";
import { raise } from "../utils/errors.ts";

export async function getFeed(feedSlug: string): Promise<string> {
	const dbFeed = (await readFeed(feedSlug)) ?? raise(404, "Unable to retrieve modified feed from DB");
	const feed = new Feed({
		title: dbFeed.title,
		description: dbFeed.description,
		id: dbFeed.slug,
		link: dbFeed.link,
		language: dbFeed.language ?? undefined,
		image: dbFeed.image ?? undefined,
		favicon: dbFeed.favicon ?? undefined,
		copyright: dbFeed.copyright ?? "unspecified",
		updated: dbFeed.updatedAt,
		generator: generatorValue,
		author: dbFeed.author ? coerceNullish(dbFeed.author) : undefined,
	});

	const feedItems = await getFeedItems(feedSlug);
	for (const item of feedItems) {
		feed.addItem({
			title: item.title,
			id: item.slug,
			link: item.link,
			description: item.description,
			content: item.content,
			date: item.date,
			image: item.image ?? undefined,
			author: item.authors?.map(coerceNullish) ?? undefined,
			contributor: item.contributors?.map(coerceNullish) ?? undefined,
		});
	}

	return feed.rss2();
}
