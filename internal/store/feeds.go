package store

import (
	"context"
	"time"

	"github.com/religiosa1/rss-service/internal/model"
)

// feedSelect selects feeds along with their virtual updated_at value: date of
// the latest item or the feed creation date, if it has no items.
const feedSelect = `SELECT
	feed.id, feed.slug, feed.title, feed.description, feed.image, feed.favicon,
	feed.language, feed.copyright, feed.author, feed.created_at, feed.modified_at,
	COALESCE(MAX(feed_item.date), feed.created_at) AS updated_at
FROM feed
LEFT JOIN feed_item ON feed_item.feed_id = feed.id`

func (db *DB) ListFeeds(ctx context.Context) ([]model.Feed, error) {
	feeds := []model.Feed{}
	err := db.SelectContext(ctx, &feeds, feedSelect+` GROUP BY feed.id ORDER BY feed.id`)
	return feeds, err
}

func (db *DB) GetFeed(ctx context.Context, slug string) (model.Feed, error) {
	var feed model.Feed
	err := db.GetContext(ctx, &feed, feedSelect+` WHERE feed.slug = ? GROUP BY feed.id`, slug)
	return feed, mapError(err)
}

func (db *DB) CreateFeed(ctx context.Context, input model.FeedInput) (model.Feed, error) {
	ts := model.NewTimestamp(time.Now())
	slug, _ := input.Slug.Get()
	title, _ := input.Title.Get()
	_, err := db.ExecContext(ctx, `INSERT INTO feed
		(slug, title, description, image, favicon, language, copyright, author, created_at, modified_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		slug, title,
		input.Description.Ptr(), input.Image.Ptr(), input.Favicon.Ptr(), input.Language.Ptr(),
		input.Copyright.Ptr(), input.Author.Ptr(), ts, ts,
	)
	if err != nil {
		return model.Feed{}, mapError(err)
	}
	return db.GetFeed(ctx, slug)
}

// UpdateFeed applies fields present in input to the feed.
func (db *DB) UpdateFeed(ctx context.Context, slug string, input model.FeedInput) (model.Feed, error) {
	var set updateSet
	addValue(&set, "slug", input.Slug)
	addValue(&set, "title", input.Title)
	addNullable(&set, "description", input.Description)
	addNullable(&set, "image", input.Image)
	addNullable(&set, "favicon", input.Favicon)
	addNullable(&set, "language", input.Language)
	addNullable(&set, "copyright", input.Copyright)
	addNullable(&set, "author", input.Author)
	set.add("modified_at", model.NewTimestamp(time.Now()))

	query, args := set.query("feed", "slug = ?", slug)
	res, err := db.ExecContext(ctx, query, args...)
	if err := checkAffected(res, err); err != nil {
		return model.Feed{}, err
	}
	if newSlug, ok := input.Slug.Get(); ok {
		slug = newSlug
	}
	return db.GetFeed(ctx, slug)
}

// DeleteFeed deletes the feed, along with all of its items.
func (db *DB) DeleteFeed(ctx context.Context, slug string) error {
	res, err := db.ExecContext(ctx, `DELETE FROM feed WHERE slug = ?`, slug)
	return checkAffected(res, err)
}
