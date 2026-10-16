package model

import (
	"slices"

	"github.com/invopop/validation"
)

// FeedItem is a feed entry (post, article, etc.) as returned by the API.
type FeedItem struct {
	ID           int64     `json:"id" db:"id"`
	FeedID       int64     `json:"-" db:"feed_id"`
	Slug         string    `json:"slug" db:"slug"`
	Title        string    `json:"title" db:"title"`
	Date         Timestamp `json:"date" db:"date" format:"date-time"`
	Link         string    `json:"link" db:"link"`
	Description  *string   `json:"description" db:"description" extensions:"x-nullable"`
	Content      *string   `json:"content" db:"content" extensions:"x-nullable"`
	Image        *string   `json:"image" db:"image" extensions:"x-nullable"`
	Authors      Authors   `json:"authors" db:"authors" extensions:"x-nullable"`
	Contributors Authors   `json:"contributors" db:"contributors" extensions:"x-nullable"`
	CreatedAt    Timestamp `json:"createdAt" db:"created_at" format:"date-time"`
	ModifiedAt   Timestamp `json:"modifiedAt" db:"modified_at" format:"date-time"`
} // @name FeedItemSchema

// FeedItemInput is the create (POST, PUT) and update (PATCH) payload of a feed item.
type FeedItemInput struct {
	Slug         Optional[string]    `json:"slug"`
	Title        Optional[string]    `json:"title"`
	Date         Optional[Timestamp] `json:"date" format:"date-time"`
	Link         Optional[string]    `json:"link" format:"uri"`
	Description  Optional[string]    `json:"description" extensions:"x-nullable"`
	Content      Optional[string]    `json:"content" extensions:"x-nullable"`
	Image        Optional[string]    `json:"image" format:"uri" extensions:"x-nullable"`
	Authors      Optional[Authors]   `json:"authors" extensions:"x-nullable"`
	Contributors Optional[Authors]   `json:"contributors" extensions:"x-nullable"`
} // @name FeedItemUpdateSchema

// ValidateCreate validates the payload as a new item: required fields must be present.
func (i FeedItemInput) ValidateCreate() error {
	return i.validate(required)
}

// ValidatePatch validates the payload as a partial update.
func (i FeedItemInput) ValidatePatch() error {
	return i.validate(notNull)
}

// Validate implements validation.Validatable for lists of items, which are
// always full create payloads.
func (i FeedItemInput) Validate() error {
	return i.ValidateCreate()
}

func (i FeedItemInput) validate(requiredRule validation.Rule) error {
	return validation.ValidateStruct(&i,
		validation.Field(&i.Slug, append([]validation.Rule{requiredRule}, slugRules...)...),
		validation.Field(&i.Title, requiredRule, validation.RuneLength(0, TitleLength)),
		validation.Field(&i.Date, requiredRule),
		validation.Field(&i.Link, requiredRule, validation.NilOrNotEmpty, isURL),
		validation.Field(&i.Description, validation.RuneLength(0, DescLength)),
		validation.Field(&i.Image, validation.RuneLength(0, URLLength), isURL),
		validation.Field(&i.Authors),
		validation.Field(&i.Contributors),
	)
}

// Matches reports whether applying the payload to the item would change
// nothing. Fields absent in the payload are ignored; meta fields are not compared.
func (i FeedItemInput) Matches(item FeedItem) bool {
	return matchesValue(i.Slug, item.Slug) &&
		matchesValue(i.Title, item.Title) &&
		matchesFunc(i.Date, item.Date, func(a, b Timestamp) bool { return a.Equal(b.Time) }) &&
		matchesValue(i.Link, item.Link) &&
		matchesPtr(i.Description, item.Description) &&
		matchesPtr(i.Content, item.Content) &&
		matchesPtr(i.Image, item.Image) &&
		matchesAuthors(i.Authors, item.Authors) &&
		matchesAuthors(i.Contributors, item.Contributors)
}

func matchesValue[T comparable](o Optional[T], v T) bool {
	return matchesFunc(o, v, func(a, b T) bool { return a == b })
}

func matchesFunc[T any](o Optional[T], v T, equal func(a, b T) bool) bool {
	value, ok := o.Get()
	return !o.IsSet() || ok && equal(value, v)
}

func matchesPtr[T comparable](o Optional[T], v *T) bool {
	if !o.IsSet() {
		return true
	}
	value, ok := o.Get()
	if !ok || v == nil {
		return !ok && v == nil
	}
	return value == *v
}

func matchesAuthors(o Optional[Authors], v Authors) bool {
	if !o.IsSet() {
		return true
	}
	value, _ := o.Get()
	// null and missing are the same for comparison, as both are stored as NULL
	if value == nil || v == nil {
		return value == nil && v == nil
	}
	return slices.Equal(value, v)
}
