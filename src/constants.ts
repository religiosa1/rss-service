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
