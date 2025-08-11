import { Feed } from "feed";
import { readFeed } from "../repositories/feed.ts";
import { generatorValue } from "../globalContext.ts";

export async function getFeed(feedSlug: string): Promise<string> {
	const dbFeed = await readFeed(feedSlug);
	const feed = new Feed({
		title: dbFeed.title,
		description: dbFeed.description,
		id: dbFeed.slug,
		link: dbFeed.link,
		language: dbFeed.language ?? undefined, // optional, used only in RSS 2.0, possible values: http://www.w3.org/TR/REC-html40/struct/dirlang.html#langcodes
		image: dbFeed.image ?? undefined,
		favicon: dbFeed.favicon ?? undefined,
		copyright: dbFeed.copyright ?? "unspecified",
		updated: dbFeed.updatedAt,
		generator: generatorValue, // optional, default = 'Feed for Node.js'
		// author: {
		// 	name: "John Doe",
		// 	email: "johndoe@example.com",
		// 	link: "https://example.com/johndoe",
		// },
	});

	// TODO feed-items

	return feed.rss2();
}
