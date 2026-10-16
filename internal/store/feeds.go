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
	_, err := db.ExecContext(ctx, `INSERT INTO feed
		(slug, title, description, image, favicon, language, copyright, author, created_at, modified_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		input.Slug, input.Title,
		input.Description, input.Image, input.Favicon, input.Language,
		input.Copyright, input.Author, ts, ts,
	)
	if err != nil {
		return model.Feed{}, mapError(err)
	}
	slug, _ := input.Slug.Get()
	return db.GetFeed(ctx, slug)
}

// UpdateFeed applies fields present in input to the feed.
func (db *DB) UpdateFeed(ctx context.Context, slug string, input model.FeedInput) (model.Feed, error) {
	var set updateSet
	set.addIfSet("slug", input.Slug)
	set.addIfSet("title", input.Title)
	set.addIfSet("description", input.Description)
	set.addIfSet("image", input.Image)
	set.addIfSet("favicon", input.Favicon)
	set.addIfSet("language", input.Language)
	set.addIfSet("copyright", input.Copyright)
	set.addIfSet("author", input.Author)
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
