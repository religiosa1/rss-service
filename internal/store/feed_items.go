package store

import (
	"context"
	"slices"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/religiosa1/rss-service/internal/model"
)

const itemsOrder = ` ORDER BY date DESC, id`

// ListFeedItems returns the non-archived items of the feed, latest first.
func (db *DB) ListFeedItems(ctx context.Context, feedSlug string) ([]model.FeedItem, error) {
	feedID, err := getFeedID(ctx, db, feedSlug)
	if err != nil {
		return nil, err
	}
	return listItems(ctx, db, feedID)
}

// GetFeedWithItems returns the feed along with its non-archived items.
func (db *DB) GetFeedWithItems(ctx context.Context, feedSlug string) (model.Feed, []model.FeedItem, error) {
	// NOTE: not in a tx, as _txlock=immediate makes every tx take the write lock
	feed, err := db.GetFeed(ctx, feedSlug)
	if err != nil {
		return model.Feed{}, nil, err
	}
	items, err := listItems(ctx, db, feed.ID)
	return feed, items, err
}

func listItems(ctx context.Context, q sqlx.QueryerContext, feedID int64) ([]model.FeedItem, error) {
	items := []model.FeedItem{}
	err := sqlx.SelectContext(ctx, q, &items, `SELECT * FROM feed_item WHERE feed_id = ?`+itemsOrder+` LIMIT ?`,
		feedID, model.MaxFeedItems)
	return items, err
}

// ListAllFeedItems returns all items of the feed, archived included, latest
// first: items beyond MaxFeedItems are archived.
func (db *DB) ListAllFeedItems(ctx context.Context, feedSlug string) ([]model.FeedItem, error) {
	feedID, err := getFeedID(ctx, db, feedSlug)
	if err != nil {
		return nil, err
	}
	items := []model.FeedItem{}
	err = db.SelectContext(ctx, &items, `SELECT * FROM feed_item WHERE feed_id = ?`+itemsOrder, feedID)
	return items, err
}

// CreateFeedItem inserts the item, returning TooOldError if it's older than
// the whole feed archive.
func (db *DB) CreateFeedItem(ctx context.Context, feedSlug string, input model.FeedItemInput) (item model.FeedItem, err error) {
	err = db.inTx(ctx, func(tx *sqlx.Tx) error {
		feedID, err := getFeedID(ctx, tx, feedSlug)
		if err != nil {
			return err
		}
		item, err = insertItem(ctx, tx, feedID, input, model.NewTimestamp(time.Now()))
		if err != nil {
			return err
		}
		return pruneArchive(ctx, tx, feedID, []model.FeedItem{item})
	})
	return item, err
}

// UpdateFeedItem applies fields present in input to the item.
func (db *DB) UpdateFeedItem(ctx context.Context, feedSlug, itemSlug string, input model.FeedItemInput) (model.FeedItem, error) {
	feedID, err := getFeedID(ctx, db, feedSlug)
	if err != nil {
		return model.FeedItem{}, err
	}
	return updateItem(ctx, db, feedID, itemSlug, input, model.NewTimestamp(time.Now()))
}

// UpsertResult splits the upserted items by what happened to them.
type UpsertResult struct {
	Inserted      []model.FeedItem `json:"inserted"`
	Updated       []model.FeedItem `json:"updated"`
	WithoutChange []model.FeedItem `json:"withoutChange"`
} // @name MultiUpsertSchema

// UpsertFeedItems inserts new items and patches existing ones (matched by
// slug), leaving the items without changes as is. Slugs must be unique in
// inputs, otherwise ErrDuplicate is returned on insert. Nothing is changed and
// TooOldError is returned, if any new item is older than the whole feed archive.
func (db *DB) UpsertFeedItems(ctx context.Context, feedSlug string, inputs []model.FeedItemInput) (UpsertResult, error) {
	result := UpsertResult{
		Inserted:      []model.FeedItem{},
		Updated:       []model.FeedItem{},
		WithoutChange: []model.FeedItem{},
	}
	slugs := make([]string, len(inputs))
	for i, input := range inputs {
		slugs[i], _ = input.Slug.Get()
	}

	ts := model.NewTimestamp(time.Now())
	err := db.inTx(ctx, func(tx *sqlx.Tx) error {
		feedID, err := getFeedID(ctx, tx, feedSlug)
		if err != nil {
			return err
		}
		existing, err := getItemsBySlug(ctx, tx, feedID, slugs)
		if err != nil {
			return err
		}
		for i, input := range inputs {
			current, ok := existing[slugs[i]]
			switch {
			case !ok:
				item, err := insertItem(ctx, tx, feedID, input, ts)
				if err != nil {
					return err
				}
				result.Inserted = append(result.Inserted, item)
			case input.Matches(current):
				result.WithoutChange = append(result.WithoutChange, current)
			default:
				item, err := updateItem(ctx, tx, feedID, slugs[i], input, ts)
				if err != nil {
					return err
				}
				result.Updated = append(result.Updated, item)
			}
		}
		// updates don't change the amount of items
		if len(result.Inserted) == 0 {
			return nil
		}
		return pruneArchive(ctx, tx, feedID, result.Inserted)
	})
	return result, err
}

func (db *DB) DeleteFeedItem(ctx context.Context, feedSlug, itemSlug string) error {
	feedID, err := getFeedID(ctx, db, feedSlug)
	if err != nil {
		return err
	}
	res, err := db.ExecContext(ctx, `DELETE FROM feed_item WHERE feed_id = ? AND slug = ?`, feedID, itemSlug)
	return checkAffected(res, err)
}

// DeleteAllFeedItems deletes all items of the feed, archived included, and
// returns their amount.
func (db *DB) DeleteAllFeedItems(ctx context.Context, feedSlug string) (int64, error) {
	feedID, err := getFeedID(ctx, db, feedSlug)
	if err != nil {
		return 0, err
	}
	res, err := db.ExecContext(ctx, `DELETE FROM feed_item WHERE feed_id = ?`, feedID)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func (db *DB) inTx(ctx context.Context, fn func(tx *sqlx.Tx) error) error {
	tx, err := db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

func getFeedID(ctx context.Context, q sqlx.QueryerContext, feedSlug string) (int64, error) {
	var id int64
	err := sqlx.GetContext(ctx, q, &id, `SELECT id FROM feed WHERE slug = ?`, feedSlug)
	return id, mapError(err)
}

func getItemsBySlug(ctx context.Context, q sqlx.QueryerContext, feedID int64, slugs []string) (map[string]model.FeedItem, error) {
	query, args, err := sqlx.In(`SELECT * FROM feed_item WHERE feed_id = ? AND slug IN (?)`, feedID, slugs)
	if err != nil {
		return nil, err
	}
	var items []model.FeedItem
	if err := sqlx.SelectContext(ctx, q, &items, query, args...); err != nil {
		return nil, err
	}
	bySlug := make(map[string]model.FeedItem, len(items))
	for _, item := range items {
		bySlug[item.Slug] = item
	}
	return bySlug, nil
}

func insertItem(ctx context.Context, q sqlx.QueryerContext, feedID int64, input model.FeedItemInput, ts model.Timestamp) (model.FeedItem, error) {
	var item model.FeedItem
	err := sqlx.GetContext(ctx, q, &item, `INSERT INTO feed_item
		(feed_id, slug, title, date, link, description, content, image, authors, contributors, created_at, modified_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		RETURNING *`,
		feedID, input.Slug, input.Title, input.Date, input.Link,
		input.Description, input.Content, input.Image,
		input.Authors, input.Contributors, ts, ts,
	)
	return item, mapError(err)
}

func updateItem(ctx context.Context, q sqlx.QueryerContext, feedID int64, slug string, input model.FeedItemInput, ts model.Timestamp) (model.FeedItem, error) {
	var set updateSet
	set.addIfSet("slug", input.Slug)
	set.addIfSet("title", input.Title)
	set.addIfSet("date", input.Date)
	set.addIfSet("link", input.Link)
	set.addIfSet("description", input.Description)
	set.addIfSet("content", input.Content)
	set.addIfSet("image", input.Image)
	set.addIfSet("authors", input.Authors)
	set.addIfSet("contributors", input.Contributors)
	set.add("modified_at", ts)

	query, args := set.query("feed_item", "feed_id = ? AND slug = ?", feedID, slug)
	var item model.FeedItem
	err := sqlx.GetContext(ctx, q, &item, query+" RETURNING *", args...)
	return item, mapError(err)
}

// TooOldError is returned when inserted items are older than the whole feed
// archive, so they would be removed right away.
type TooOldError struct {
	Slugs []string
}

func (e *TooOldError) Error() string {
	return "items are older than the feed archive: " + strings.Join(e.Slugs, ", ")
}

// pruneArchive keeps only MaxFeedItems + MaxFeedItemsArchived latest items in
// the feed. Returns TooOldError if any of the just inserted items got pruned.
func pruneArchive(ctx context.Context, q sqlx.QueryerContext, feedID int64, inserted []model.FeedItem) error {
	var removed []int64
	err := sqlx.SelectContext(ctx, q, &removed, `DELETE FROM feed_item WHERE feed_id = ? AND id NOT IN (
		SELECT id FROM feed_item WHERE feed_id = ?`+itemsOrder+` LIMIT ?
	) RETURNING id`, feedID, feedID, model.MaxFeedItems+model.MaxFeedItemsArchived)
	if err != nil {
		return err
	}
	var tooOld []string
	for _, item := range inserted {
		if slices.Contains(removed, item.ID) {
			tooOld = append(tooOld, item.Slug)
		}
	}
	if len(tooOld) > 0 {
		return &TooOldError{Slugs: tooOld}
	}
	return nil
}
