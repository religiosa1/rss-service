export const port = parseInt(process.env.PORT ?? "", 10) || 3000;
export const publicUrl = process.env.PUBLIC_URL || `http://localhost:${port}/`;

// validating provided url: (TODO: just concat that and remove url validation)
new URL("/", publicUrl);

/** Value used in "generator" field of RSS feeds. */
export const generatorValue = process.env.RSS_GENERATOR ?? "rss-service";
