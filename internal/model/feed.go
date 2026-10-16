// Package model holds the API payloads and responses, shared with the store.
package model

import (
	"net/url"
	"regexp"

	"github.com/invopop/validation"
)

// Sizes shared between payload validation and the DB.
const (
	SlugLength      = 512
	TitleLength     = 512
	DescLength      = 8192
	CopyrightLength = 512
	// URLLength is the max url length in webkit-based browsers.
	URLLength = 2083
)

const (
	// MaxFeedItems is the max amount of items returned in a feed or a list request.
	MaxFeedItems = 100
	// MaxFeedItemsArchived is the amount of extra older items kept per feed,
	// in case some item gets updated to an older date.
	MaxFeedItemsArchived = MaxFeedItems * 2
)

var slugRe = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

var slugRules = []validation.Rule{validation.NilOrNotEmpty, validation.RuneLength(1, SlugLength), validation.Match(slugRe)}

// ValidateSlug validates a feed or a feed item slug from a request path.
func ValidateSlug(slug string) error {
	return validation.Validate(slug, append([]validation.Rule{validation.Required}, slugRules...)...)
}

var errURL = validation.NewError("invalid_url", "must be a valid absolute URL")

// isURL accepts absolute URLs only, unlike is.URL, which is fine with "example.com".
var isURL = validation.By(func(value any) error {
	value, isNil := validation.Indirect(value)
	str, ok := value.(string)
	if isNil || !ok || str == "" {
		return nil
	}
	u, err := url.Parse(str)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return errURL
	}
	return nil
})

// Feed is a feed as returned by the API.
type Feed struct {
	ID          int64   `json:"id" db:"id"`
	Slug        string  `json:"slug" db:"slug"`
	Title       string  `json:"title" db:"title"`
	Description *string `json:"description" db:"description" extensions:"x-nullable"`
	Image       *string `json:"image" db:"image" extensions:"x-nullable"`
	Favicon     *string `json:"favicon" db:"favicon" extensions:"x-nullable"`
	Language    *string `json:"language" db:"language" extensions:"x-nullable"`
	Copyright   *string `json:"copyright" db:"copyright" extensions:"x-nullable"`
	Author      *Author `json:"author" db:"author" extensions:"x-nullable"`
	Link        string  `json:"link" db:"-"`
	// UpdatedAt is the date of the latest item in the feed, or the creation date
	// if there're no items.
	UpdatedAt  Timestamp `json:"updatedAt" db:"updated_at" format:"date-time"`
	CreatedAt  Timestamp `json:"createdAt" db:"created_at" format:"date-time"`
	ModifiedAt Timestamp `json:"modifiedAt" db:"modified_at" format:"date-time"`
} // @name FeedSchema

// FeedInput is the create (POST) and update (PATCH) payload of a feed.
type FeedInput struct {
	Slug        Optional[string] `json:"slug"`
	Title       Optional[string] `json:"title"`
	Description Optional[string] `json:"description" extensions:"x-nullable"`
	Image       Optional[string] `json:"image" format:"uri" extensions:"x-nullable"`
	Favicon     Optional[string] `json:"favicon" format:"uri" extensions:"x-nullable"`
	Language    Optional[string] `json:"language" extensions:"x-nullable"`
	Copyright   Optional[string] `json:"copyright" extensions:"x-nullable"`
	Author      Optional[Author] `json:"author" extensions:"x-nullable"`
} // @name FeedUpdateSchema

// ValidateCreate validates the payload as a new feed: required fields must be present.
func (f FeedInput) ValidateCreate() error {
	return f.validate(required)
}

// ValidatePatch validates the payload as a partial update.
func (f FeedInput) ValidatePatch() error {
	return f.validate(notNull)
}

func (f FeedInput) validate(requiredRule validation.Rule) error {
	return validation.ValidateStruct(&f,
		validation.Field(&f.Slug, append([]validation.Rule{requiredRule}, slugRules...)...),
		validation.Field(&f.Title, requiredRule, validation.RuneLength(0, TitleLength)),
		validation.Field(&f.Description, validation.RuneLength(0, DescLength)),
		validation.Field(&f.Image, validation.RuneLength(0, URLLength), isURL),
		validation.Field(&f.Favicon, validation.RuneLength(0, URLLength), isURL),
		validation.Field(&f.Language, validation.RuneLength(2, 128)),
		validation.Field(&f.Copyright, validation.RuneLength(0, CopyrightLength)),
		validation.Field(&f.Author),
	)
}
