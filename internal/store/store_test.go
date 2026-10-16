package store

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"testing"
	"time"

	"github.com/religiosa1/rss-service/internal/model"
)

func newTestDB(t *testing.T) *DB {
	t.Helper()
	db, err := Open(filepath.Join(t.TempDir(), "test.db"), Options{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func newTestFeed(t *testing.T, db *DB, slug string) model.Feed {
	t.Helper()
	feed, err := db.CreateFeed(t.Context(), model.FeedInput{Slug: model.Some(slug), Title: model.Some("title " + slug)})
	if err != nil {
		t.Fatal(err)
	}
	return feed
}

func itemInput(slug string, date time.Time) model.FeedItemInput {
	return model.FeedItemInput{
		Slug:  model.Some(slug),
		Title: model.Some("title " + slug),
		Date:  model.Some(model.NewTimestamp(date)),
		Link:  model.Some("https://example.com/" + slug),
	}
}

func itemSlugs(items []model.FeedItem) []string {
	var slugs []string
	for _, item := range items {
		slugs = append(slugs, item.Slug)
	}
	return slugs
}

// testdata/drizzle.db was created by the node.js version of the service.
func TestOpenDrizzleDB(t *testing.T) {
	data, err := os.ReadFile("testdata/drizzle.db")
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "drizzle.db")
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}
	db, err := Open("file://"+path, Options{})
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = db.Close() }()

	var userVersion, drizzleMigrations int
	if err := db.Get(&userVersion, "PRAGMA user_version"); err != nil || userVersion != 1 {
		t.Errorf("user_version = %d, %v", userVersion, err)
	}
	if err := db.Get(&drizzleMigrations, "SELECT count(*) FROM __drizzle_migrations"); err != nil || drizzleMigrations != 1 {
		t.Errorf("drizzle migrations = %d, %v", drizzleMigrations, err)
	}

	feeds, err := db.ListFeeds(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if len(feeds) != 2 {
		t.Fatalf("got %d feeds", len(feeds))
	}
	full := feeds[0]
	wantAuthor := model.Author{Name: "John Doe", Email: "john@example.com", Link: "https://example.com/john"}
	if full.Slug != "full" || *full.Language != "en" || full.Author == nil || *full.Author != wantAuthor {
		t.Errorf("unexpected feed %+v", full)
	}
	if want := time.Date(2025, 1, 2, 0, 0, 0, 0, time.UTC); !full.UpdatedAt.Equal(want) {
		t.Errorf("updatedAt = %v, want latest item date %v", full.UpdatedAt, want)
	}
	if empty := feeds[1]; empty.Author != nil || empty.Description != nil || !empty.UpdatedAt.Equal(empty.CreatedAt.Time) {
		t.Errorf("unexpected feed %+v", empty)
	}

	items, err := db.ListFeedItems(t.Context(), "full")
	if err != nil {
		t.Fatal(err)
	}
	if got := itemSlugs(items); !slices.Equal(got, []string{"b", "a"}) {
		t.Fatalf("items = %v", got)
	}
	a := items[1]
	wantAuthors := model.Authors{{Name: "John Doe", Link: "https://example.com/"}, {Name: "Jane", Email: "jane@example.com"}}
	if !slices.Equal(a.Authors, wantAuthors) || len(a.Contributors) != 1 || *a.Content != "<p>content ]]> a</p>" {
		t.Errorf("unexpected item %+v", a)
	}
	if want := time.Date(2025, 1, 1, 10, 30, 5, 123_000_000, time.UTC); !a.Date.Equal(want) {
		t.Errorf("date = %v, want %v", a.Date, want)
	}
	if b := items[0]; b.Authors != nil || b.Description != nil {
		t.Errorf("unexpected item %+v", b)
	}

	// new writes are readable by the same schema
	if _, err := db.CreateFeedItem(t.Context(), "empty", itemInput("new", time.Now())); err != nil {
		t.Fatal(err)
	}
}

func TestOpenTwiceKeepsSchema(t *testing.T) {
	path := filepath.Join(t.TempDir(), "test.db")
	for range 2 {
		db, err := Open(path, Options{})
		if err != nil {
			t.Fatal(err)
		}
		_ = db.Close()
	}
}

func TestFilePath(t *testing.T) {
	cases := map[string]string{
		"./data.db":                   "./data.db",
		"/app/data/rss.db":            "/app/data/rss.db",
		"file:///app/data/rss.db":     "/app/data/rss.db",
		"file://localhost/app/rss.db": "/app/rss.db",
		"file:data.db":                "data.db",
	}
	for in, want := range cases {
		if got, err := filePath(in); err != nil || got != want {
			t.Errorf("filePath(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	for _, in := range []string{"libsql://my-db.turso.io", "https://my-db.turso.io", ":memory:"} {
		if _, err := filePath(in); err == nil {
			t.Errorf("filePath(%q): expected an error", in)
		}
	}
}

func TestFeedCRUD(t *testing.T) {
	db := newTestDB(t)
	ctx := t.Context()
	newTestFeed(t, db, "a")

	if _, err := db.CreateFeed(ctx, model.FeedInput{Slug: model.Some("a"), Title: model.Some("dup")}); !errors.Is(err, ErrDuplicate) {
		t.Errorf("duplicate create: %v", err)
	}

	desc := "description"
	updated, err := db.UpdateFeed(ctx, "a", model.FeedInput{
		Slug:        model.Some("b"),
		Description: model.Some(desc),
		Author:      model.Some(model.Author{Name: "John"}),
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Slug != "b" || updated.Title != "title a" || *updated.Description != desc || updated.Author.Name != "John" {
		t.Errorf("unexpected update result %+v", updated)
	}

	updated, err = db.UpdateFeed(ctx, "b", model.FeedInput{Author: model.Null[model.Author]()})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Author != nil || updated.Description == nil {
		t.Errorf("null must reset only the provided field: %+v", updated)
	}

	if _, err := db.UpdateFeed(ctx, "a", model.FeedInput{Title: model.Some("x")}); !errors.Is(err, ErrNotFound) {
		t.Errorf("update of missing feed: %v", err)
	}
	newTestFeed(t, db, "c")
	if _, err := db.UpdateFeed(ctx, "c", model.FeedInput{Slug: model.Some("b")}); !errors.Is(err, ErrDuplicate) {
		t.Errorf("update to existing slug: %v", err)
	}

	if err := db.DeleteFeed(ctx, "b"); err != nil {
		t.Fatal(err)
	}
	if err := db.DeleteFeed(ctx, "b"); !errors.Is(err, ErrNotFound) {
		t.Errorf("second delete: %v", err)
	}
	if _, err := db.GetFeed(ctx, "b"); !errors.Is(err, ErrNotFound) {
		t.Errorf("get deleted: %v", err)
	}
}

func TestDeleteFeedCascades(t *testing.T) {
	db := newTestDB(t)
	newTestFeed(t, db, "a")
	if _, err := db.CreateFeedItem(t.Context(), "a", itemInput("x", time.Now())); err != nil {
		t.Fatal(err)
	}
	if err := db.DeleteFeed(t.Context(), "a"); err != nil {
		t.Fatal(err)
	}
	var count int
	if err := db.Get(&count, "SELECT count(*) FROM feed_item"); err != nil || count != 0 {
		t.Errorf("items left: %d, %v", count, err)
	}
}

func TestArchive(t *testing.T) {
	db := newTestDB(t)
	ctx := t.Context()
	newTestFeed(t, db, "a")
	start := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	total := model.MaxFeedItems + model.MaxFeedItemsArchived + 10
	for i := range total {
		if _, err := db.CreateFeedItem(ctx, "a", itemInput(fmt.Sprint(i), start.Add(time.Duration(i)*time.Hour))); err != nil {
			t.Fatal(err)
		}
	}

	items, err := db.ListFeedItems(ctx, "a")
	if err != nil {
		t.Fatal(err)
	}
	all, err := db.ListAllFeedItems(ctx, "a")
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != model.MaxFeedItems || len(all) != model.MaxFeedItems+model.MaxFeedItemsArchived {
		t.Fatalf("got %d items, %d in total", len(items), len(all))
	}
	if items[0].Slug != fmt.Sprint(total-1) || all[len(all)-1].Slug != "10" {
		t.Errorf("oldest items must be removed first: latest %s, oldest %s", items[0].Slug, all[len(all)-1].Slug)
	}

	count, err := db.DeleteAllFeedItems(ctx, "a")
	if err != nil || count != int64(model.MaxFeedItems+model.MaxFeedItemsArchived) {
		t.Errorf("deleted %d, %v", count, err)
	}
}

func TestFeedItemErrors(t *testing.T) {
	db := newTestDB(t)
	ctx := t.Context()
	newTestFeed(t, db, "a")
	input := itemInput("x", time.Now())

	if _, err := db.CreateFeedItem(ctx, "missing", input); !errors.Is(err, ErrNotFound) {
		t.Errorf("create in missing feed: %v", err)
	}
	if _, err := db.CreateFeedItem(ctx, "a", input); err != nil {
		t.Fatal(err)
	}
	if _, err := db.CreateFeedItem(ctx, "a", input); !errors.Is(err, ErrDuplicate) {
		t.Errorf("duplicate create: %v", err)
	}
	if _, err := db.UpdateFeedItem(ctx, "a", "missing", input); !errors.Is(err, ErrNotFound) {
		t.Errorf("update missing: %v", err)
	}
	if err := db.DeleteFeedItem(ctx, "a", "missing"); !errors.Is(err, ErrNotFound) {
		t.Errorf("delete missing: %v", err)
	}
	if _, err := db.ListFeedItems(ctx, "missing"); !errors.Is(err, ErrNotFound) {
		t.Errorf("list missing feed: %v", err)
	}
}

func TestUpdateFeedItem(t *testing.T) {
	db := newTestDB(t)
	ctx := t.Context()
	newTestFeed(t, db, "a")
	input := itemInput("x", time.Now())
	input.Description = model.Some("desc")
	input.Authors = model.Some(model.Authors{{Name: "John"}})
	created, err := db.CreateFeedItem(ctx, "a", input)
	if err != nil {
		t.Fatal(err)
	}

	updated, err := db.UpdateFeedItem(ctx, "a", "x", model.FeedItemInput{
		Title:   model.Some("new title"),
		Authors: model.Null[model.Authors](),
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Title != "new title" || updated.Authors != nil || *updated.Description != "desc" || updated.Link != created.Link {
		t.Errorf("unexpected update result %+v", updated)
	}
}

func TestUpsertFeedItems(t *testing.T) {
	db := newTestDB(t)
	ctx := t.Context()
	newTestFeed(t, db, "a")
	date := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	same := itemInput("same", date)
	same.Description = model.Some("desc")
	changed := itemInput("changed", date)
	for _, input := range []model.FeedItemInput{same, changed} {
		if _, err := db.CreateFeedItem(ctx, "a", input); err != nil {
			t.Fatal(err)
		}
	}

	// description missing in the payload is not a change
	same.Description = model.FeedItemInput{}.Description
	changed.Title = model.Some("new title")
	result, err := db.UpsertFeedItems(ctx, "a", []model.FeedItemInput{same, changed, itemInput("new", date)})
	if err != nil {
		t.Fatal(err)
	}
	if got := itemSlugs(result.Inserted); !slices.Equal(got, []string{"new"}) {
		t.Errorf("inserted = %v", got)
	}
	if got := itemSlugs(result.Updated); !slices.Equal(got, []string{"changed"}) || result.Updated[0].Title != "new title" {
		t.Errorf("updated = %v", result.Updated)
	}
	if got := itemSlugs(result.WithoutChange); !slices.Equal(got, []string{"same"}) || *result.WithoutChange[0].Description != "desc" {
		t.Errorf("withoutChange = %v", result.WithoutChange)
	}

	duplicate := itemInput("duplicate", date)
	_, err = db.UpsertFeedItems(ctx, "a", []model.FeedItemInput{duplicate, duplicate})
	if !errors.Is(err, ErrDuplicate) {
		t.Errorf("duplicated new slugs: %v", err)
	}
	if _, err := db.UpsertFeedItems(ctx, "missing", []model.FeedItemInput{same}); !errors.Is(err, ErrNotFound) {
		t.Errorf("missing feed: %v", err)
	}
}
