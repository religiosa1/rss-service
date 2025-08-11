export const API_KEY_HEADER_NAME = "X-API-Key";

// Common sizes constants for consistent validation between endpoints and DB

export const SLUG_LENGTH = 512;

const TITLE_LENGTH = 512;
export const FEED_TITLE_LENGTH = TITLE_LENGTH;
export const FEED_ITEM_TITLE_LENGTH = TITLE_LENGTH;

const DESC_LENGTH = 8192;
export const FEED_DESC_LENGTH = DESC_LENGTH;
export const FEED_ITEM_DESC_LENGTH = DESC_LENGTH;

export const COPYRIGHT_LENGTH = 512;

/** The max url length in webkit-based browsers */
export const URL_LENGTH = 2083;

/** Max amount of feed items returned in a RSS feed or REST-request */
export const MAX_FEED_ITEMS = 100;

/**
 * Additional amount of latest feedItems stored in the DB for feed, in case
 * some feed was modified or updated to be an older date, so we have some
 * buffer of data.
 *
 * Total amount of data stored will be MAX_FEED_ITEMS + MAX_FEED_ITEMS_ARCHIVED
 */
export const MAX_FEED_ITEMS_ARCHIVED = MAX_FEED_ITEMS * 2;
