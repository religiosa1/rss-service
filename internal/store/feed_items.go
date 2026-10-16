package store

import (
	"context"
	"fmt"
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
	items := []model.FeedItem{}
	err = db.SelectContext(ctx, &items, `SELECT * FROM feed_item WHERE feed_id = ?`+itemsOrder+` LIMIT ?`,
		feedID, model.MaxFeedItems)
	return items, err
}

// ListArchivedFeedItems returns the items beyond the MaxFeedItems limit, latest first.
func (db *DB) ListArchivedFeedItems(ctx context.Context, feedSlug string) ([]model.FeedItem, error) {
	feedID, err := getFeedID(ctx, db, feedSlug)
	if err != nil {
		return nil, err
	}
	items := []model.FeedItem{}
	err = db.SelectContext(ctx, &items, `SELECT * FROM feed_item WHERE feed_id = ?`+itemsOrder+` LIMIT -1 OFFSET ?`,
		feedID, model.MaxFeedItems)
	return items, err
}

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
		return removeOldArchivedItems(ctx, tx, feedID)
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
// slug), leaving the items without changes as is. Slugs must be unique in inputs.
func (db *DB) UpsertFeedItems(ctx context.Context, feedSlug string, inputs []model.FeedItemInput) (UpsertResult, error) {
	result := UpsertResult{
		Inserted:      []model.FeedItem{},
		Updated:       []model.FeedItem{},
		WithoutChange: []model.FeedItem{},
	}
	slugs := make([]string, len(inputs))
	seen := make(map[string]int, len(inputs))
	for i, input := range inputs {
		slugs[i], _ = input.Slug.Get()
		seen[slugs[i]]++
	}
	for slug, count := range seen {
		if count > 1 {
			return result, fmt.Errorf("%w: slug %s is present %d times in the provided items", ErrDuplicate, slug, count)
		}
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
		return removeOldArchivedItems(ctx, tx, feedID)
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
	slug, _ := input.Slug.Get()
	title, _ := input.Title.Get()
	date, _ := input.Date.Get()
	link, _ := input.Link.Get()
	var item model.FeedItem
	err := sqlx.GetContext(ctx, q, &item, `INSERT INTO feed_item
		(feed_id, slug, title, date, link, description, content, image, authors, contributors, created_at, modified_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		RETURNING *`,
		feedID, slug, title, date, link,
		input.Description.Ptr(), input.Content.Ptr(), input.Image.Ptr(),
		input.Authors.Ptr(), input.Contributors.Ptr(), ts, ts,
	)
	return item, mapError(err)
}

func updateItem(ctx context.Context, q sqlx.QueryerContext, feedID int64, slug string, input model.FeedItemInput, ts model.Timestamp) (model.FeedItem, error) {
	var set updateSet
	addValue(&set, "slug", input.Slug)
	addValue(&set, "title", input.Title)
	addValue(&set, "date", input.Date)
	addValue(&set, "link", input.Link)
	addNullable(&set, "description", input.Description)
	addNullable(&set, "content", input.Content)
	addNullable(&set, "image", input.Image)
	addNullable(&set, "authors", input.Authors)
	addNullable(&set, "contributors", input.Contributors)
	set.add("modified_at", ts)

	query, args := set.query("feed_item", "feed_id = ? AND slug = ?", feedID, slug)
	var item model.FeedItem
	err := sqlx.GetContext(ctx, q, &item, query+" RETURNING *", args...)
	return item, mapError(err)
}

// removeOldArchivedItems keeps only MaxFeedItems + MaxFeedItemsArchived latest items in the feed.
func removeOldArchivedItems(ctx context.Context, e sqlx.ExecerContext, feedID int64) error {
	_, err := e.ExecContext(ctx, `DELETE FROM feed_item WHERE feed_id = ? AND id NOT IN (
		SELECT id FROM feed_item WHERE feed_id = ?`+itemsOrder+` LIMIT ?
	)`, feedID, feedID, model.MaxFeedItems+model.MaxFeedItemsArchived)
	return err
}
