export const port = parseInt(process.env.PORT ?? "", 10) || 3000;

/** Value used in "generator" field of RSS feeds. */
export const generatorValue = process.env.RSS_GENERATOR ?? "rss-service";
