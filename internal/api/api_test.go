package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/religiosa1/rss-service/internal/model"
	"github.com/religiosa1/rss-service/internal/store"
)

const testAPIKey = "test-key"

func TestMain(m *testing.M) {
	slog.SetDefault(slog.New(slog.DiscardHandler))
	os.Exit(m.Run())
}

type testServer struct {
	t       *testing.T
	handler http.Handler
}

func newTestServer(t *testing.T, cfg Config) *testServer {
	t.Helper()
	db, err := store.Open(filepath.Join(t.TempDir(), "test.db"), store.Options{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	mux := http.NewServeMux()
	New(db, cfg).Register(mux)
	return &testServer{t: t, handler: mux}
}

func newAuthTestServer(t *testing.T) *testServer {
	return newTestServer(t, Config{APIKey: testAPIKey, Generator: "rss-service"})
}

// do sends an authorized request; body is JSON-encoded, unless it's a string.
func (s *testServer) do(method, path string, body any) *httptest.ResponseRecorder {
	s.t.Helper()
	return s.doWithKey(method, path, body, testAPIKey)
}

func (s *testServer) doWithKey(method, path string, body any, apiKey string) *httptest.ResponseRecorder {
	s.t.Helper()
	var reader *bytes.Reader
	switch body := body.(type) {
	case nil:
		reader = bytes.NewReader(nil)
	case string:
		reader = bytes.NewReader([]byte(body))
	default:
		data, err := json.Marshal(body)
		if err != nil {
			s.t.Fatal(err)
		}
		reader = bytes.NewReader(data)
	}
	req := httptest.NewRequest(method, path, reader)
	if apiKey != "" {
		req.Header.Set(APIKeyHeader, apiKey)
	}
	rec := httptest.NewRecorder()
	s.handler.ServeHTTP(rec, req)
	return rec
}

// mustDo sends an authorized request and checks the response status.
func (s *testServer) mustDo(method, path string, body any, wantStatus int) *httptest.ResponseRecorder {
	s.t.Helper()
	rec := s.do(method, path, body)
	if rec.Code != wantStatus {
		s.t.Fatalf("%s %s: status %d, want %d; body: %s", method, path, rec.Code, wantStatus, rec.Body)
	}
	return rec
}

func decode[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()
	var v T
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
		t.Fatalf("decoding %s: %v", rec.Body, err)
	}
	return v
}

var testFeed = map[string]any{"slug": "test", "title": "test title", "description": "qwerty"}

func testItem(slug, date string) map[string]any {
	return map[string]any{
		"slug":        slug,
		"title":       "feed item title",
		"link":        "http://example.com/" + slug,
		"date":        date,
		"description": "feed item description",
		"content":     "blah",
	}
}

func TestStatusCodes(t *testing.T) {
	s := newAuthTestServer(t)
	s.mustDo("POST", "/feed", testFeed, http.StatusCreated)
	s.mustDo("POST", "/feed", map[string]any{"slug": "other", "title": "other"}, http.StatusCreated)
	s.mustDo("POST", "/feed/test/items", testItem("item", "2025-01-01T10:30:00.000Z"), http.StatusCreated)
	s.mustDo("POST", "/feed/test/items", testItem("item2", "2025-01-01T10:30:00.000Z"), http.StatusCreated)

	tooMany := make([]any, model.MaxFeedItems+1)
	for i := range tooMany {
		tooMany[i] = testItem(fmt.Sprint(i), "2025-01-01T10:30:00.000Z")
	}

	cases := []struct {
		method, path string
		body         any
		want         int
	}{
		{"GET", "/", nil, 200},
		{"GET", "/feed", nil, 200},
		{"GET", "/feed/test", nil, 200},
		{"GET", "/feed/!!!", nil, 400},
		{"GET", "/feed/missing", nil, 404},
		{"GET", "/feed/test?type=xml", nil, 400},
		{"POST", "/feed", map[string]any{"slug": "x"}, 400},
		{"POST", "/feed", map[string]any{"slug": "x", "title": "x", "image": "not-url"}, 400},
		{"POST", "/feed", testFeed, 409},
		{"POST", "/feed", "{not json", 400},
		{"PATCH", "/feed/!!!", map[string]any{"title": "x"}, 400},
		{"PATCH", "/feed/test", map[string]any{"title": nil}, 400},
		{"PATCH", "/feed/test", map[string]any{"slug": "other"}, 409},
		{"PATCH", "/feed/missing", map[string]any{"title": "x"}, 404},
		{"DELETE", "/feed/missing", nil, 404},

		{"GET", "/feed/test/items", nil, 200},
		{"GET", "/feed/!!!/items", nil, 400},
		{"GET", "/feed/missing/items", nil, 404},
		{"GET", "/feed/test/items/!all", nil, 200},
		{"GET", "/feed/!!!/items/!all", nil, 400},
		{"GET", "/feed/missing/items/!all", nil, 404},
		{"POST", "/feed/!!!/items", testItem("x", "2025-01-01T10:30:00Z"), 400},
		{"POST", "/feed/test/items", map[string]any{"slug": "x", "title": "x"}, 400},
		{"POST", "/feed/test/items", testItem("x", "not a date"), 400},
		{"POST", "/feed/missing/items", testItem("x", "2025-01-01T10:30:00Z"), 404},
		{"POST", "/feed/test/items", testItem("item", "2025-01-01T10:30:00Z"), 409},
		{"POST", "/feed/other/items", testItem("item", "2025-01-01T10:30:00Z"), 201},
		{"PUT", "/feed/!!!/items", []any{testItem("x", "2025-01-01T10:30:00Z")}, 400},
		{"PUT", "/feed/test/items", []any{map[string]any{"slug": "x"}}, 400},
		{"PUT", "/feed/test/items", []any{}, 400},
		{"PUT", "/feed/missing/items", []any{testItem("x", "2025-01-01T10:30:00Z")}, 404},
		{"PUT", "/feed/test/items", []any{testItem("x", "2025-01-01T10:30:00Z"), testItem("x", "2025-01-01T10:30:00Z")}, 409},
		{"PUT", "/feed/test/items", tooMany, 413},
		{"PATCH", "/feed/!!!/items/item", map[string]any{"title": "x"}, 400},
		{"PATCH", "/feed/test/items/!!!", map[string]any{"title": "x"}, 400},
		{"PATCH", "/feed/test/items/item", map[string]any{"link": "nope"}, 400},
		{"PATCH", "/feed/test/items/item", map[string]any{"slug": "item2"}, 409},
		{"PATCH", "/feed/missing/items/item", map[string]any{"title": "x"}, 404},
		{"PATCH", "/feed/test/items/missing", map[string]any{"title": "x"}, 404},
		{"DELETE", "/feed/!!!/items/item", nil, 400},
		{"DELETE", "/feed/test/items/!!!", nil, 400},
		{"DELETE", "/feed/missing/items/item", nil, 404},
		{"DELETE", "/feed/test/items/missing", nil, 404},
		{"DELETE", "/feed/!!!/items/!all", nil, 400},
		{"DELETE", "/feed/missing/items/!all", nil, 404},
	}
	for _, c := range cases {
		rec := s.do(c.method, c.path, c.body)
		if rec.Code != c.want {
			t.Errorf("%s %s: status %d, want %d; body: %s", c.method, c.path, rec.Code, c.want, rec.Body)
			continue
		}
		if c.want >= 400 {
			response := decode[ErrorResponse](t, rec)
			if response.Success || response.Status != c.want || response.Message == "" {
				t.Errorf("%s %s: unexpected error body %s", c.method, c.path, rec.Body)
			}
		}
	}
}

func TestUnauthorized(t *testing.T) {
	s := newAuthTestServer(t)
	s.mustDo("POST", "/feed", testFeed, http.StatusCreated)
	s.mustDo("POST", "/feed/test/items", testItem("item", "2025-01-01T10:30:00Z"), http.StatusCreated)

	requests := []struct {
		method, path string
		body         any
	}{
		{"POST", "/feed", map[string]any{"slug": "x", "title": "x"}},
		{"PATCH", "/feed/test", map[string]any{"title": "x"}},
		{"DELETE", "/feed/test", nil},
		{"POST", "/feed/test/items", testItem("x", "2025-01-01T10:30:00Z")},
		{"PUT", "/feed/test/items", []any{testItem("x", "2025-01-01T10:30:00Z")}},
		{"PATCH", "/feed/test/items/item", map[string]any{"title": "x"}},
		{"DELETE", "/feed/test/items/item", nil},
		{"DELETE", "/feed/test/items/!all", nil},
	}
	for _, key := range []string{"", "wrong-key"} {
		for _, r := range requests {
			if rec := s.doWithKey(r.method, r.path, r.body, key); rec.Code != http.StatusUnauthorized {
				t.Errorf("%s %s with key %q: status %d, want 401", r.method, r.path, key, rec.Code)
			}
		}
	}
	// nothing got changed
	items := decode[[]model.FeedItem](t, s.mustDo("GET", "/feed/test/items", nil, http.StatusOK))
	if len(items) != 1 || items[0].Title != "feed item title" {
		t.Errorf("unauthorized requests modified data: %+v", items)
	}
}

func TestNoAPIKeyConfigured(t *testing.T) {
	s := newTestServer(t, Config{})
	if rec := s.doWithKey("POST", "/feed", testFeed, ""); rec.Code != http.StatusCreated {
		t.Errorf("status %d, want 201 without API_KEY configured", rec.Code)
	}
}

func TestFeedResponse(t *testing.T) {
	s := newAuthTestServer(t)
	rec := s.mustDo("POST", "/feed", testFeed, http.StatusCreated)

	created := decode[map[string]any](t, rec)
	wantKeys := []string{"author", "copyright", "createdAt", "description", "favicon", "id", "image",
		"language", "link", "modifiedAt", "slug", "title", "updatedAt"}
	gotKeys := slices.Sorted(func(yield func(string) bool) {
		for key := range created {
			if !yield(key) {
				return
			}
		}
	})
	if !slices.Equal(gotKeys, wantKeys) {
		t.Errorf("keys = %v, want %v", gotKeys, wantKeys)
	}
	if created["author"] != nil || created["image"] != nil || created["link"] != "/feed/test" || created["description"] != "qwerty" {
		t.Errorf("unexpected feed %v", created)
	}
	if created["updatedAt"] != created["createdAt"] {
		t.Errorf("updatedAt of empty feed must be its creation date: %v", created)
	}
	if date, _ := created["createdAt"].(string); len(date) != len("2025-01-01T10:30:00.000Z") || !strings.HasSuffix(date, "Z") {
		t.Errorf("createdAt must be in JS ISO format: %v", date)
	}

	s.mustDo("POST", "/feed/test/items", testItem("a", "2025-01-01T10:30:15Z"), http.StatusCreated)
	s.mustDo("POST", "/feed/test/items", testItem("b", "2025-01-01T10:30:05Z"), http.StatusCreated)
	feeds := decode[[]map[string]any](t, s.mustDo("GET", "/feed", nil, http.StatusOK))
	if len(feeds) != 1 || feeds[0]["updatedAt"] != "2025-01-01T10:30:15.000Z" {
		t.Errorf("updatedAt must be the date of the latest item: %v", feeds)
	}
}

func TestEmptyListsAreArrays(t *testing.T) {
	s := newAuthTestServer(t)
	if body := s.mustDo("GET", "/feed", nil, http.StatusOK).Body.String(); strings.TrimSpace(body) != "[]" {
		t.Errorf("GET /feed = %s", body)
	}
	s.mustDo("POST", "/feed", testFeed, http.StatusCreated)
	for _, path := range []string{"/feed/test/items", "/feed/test/items/!all"} {
		if body := s.mustDo("GET", path, nil, http.StatusOK).Body.String(); strings.TrimSpace(body) != "[]" {
			t.Errorf("GET %s = %s", path, body)
		}
	}
}

func TestPatchFeed(t *testing.T) {
	s := newAuthTestServer(t)
	s.mustDo("POST", "/feed", testFeed, http.StatusCreated)
	author := map[string]any{"name": "John Doe", "email": "john.doe@example.com", "link": "https://example.com"}

	feed := decode[map[string]any](t, s.mustDo("PATCH", "/feed/test", map[string]any{"slug": "renamed", "author": author}, http.StatusOK))
	if feed["slug"] != "renamed" || feed["description"] != "qwerty" || !reflect.DeepEqual(feed["author"], author) {
		t.Errorf("unexpected patched feed %v", feed)
	}
	s.mustDo("GET", "/feed/test", nil, http.StatusNotFound)

	feed = decode[map[string]any](t, s.mustDo("PATCH", "/feed/renamed", map[string]any{"author": nil}, http.StatusOK))
	if feed["author"] != nil || feed["description"] != "qwerty" {
		t.Errorf("null must remove only the author: %v", feed)
	}

	s.mustDo("DELETE", "/feed/renamed", nil, http.StatusNoContent)
	s.mustDo("GET", "/feed/renamed", nil, http.StatusNotFound)
}

func TestPatchFeedItem(t *testing.T) {
	s := newAuthTestServer(t)
	s.mustDo("POST", "/feed", testFeed, http.StatusCreated)
	item := testItem("item", "2025-01-01T10:30:00Z")
	item["authors"] = []any{map[string]any{"name": "John"}}
	created := decode[map[string]any](t, s.mustDo("POST", "/feed/test/items", item, http.StatusCreated))

	patched := decode[map[string]any](t, s.mustDo("PATCH", "/feed/test/items/item",
		map[string]any{"slug": "renamed", "content": nil, "date": "2025-02-01T00:00:00+01:00"}, http.StatusOK))
	if patched["slug"] != "renamed" || patched["content"] != nil || patched["description"] != "feed item description" ||
		patched["date"] != "2025-01-31T23:00:00.000Z" || !reflect.DeepEqual(patched["authors"], created["authors"]) {
		t.Errorf("unexpected patched item %v", patched)
	}
	s.mustDo("DELETE", "/feed/test/items/item", nil, http.StatusNotFound)
	s.mustDo("DELETE", "/feed/test/items/renamed", nil, http.StatusNoContent)
}

func TestValidationErrorBody(t *testing.T) {
	s := newAuthTestServer(t)
	rec := s.do("POST", "/feed", map[string]any{
		"slug":   "test",
		"title":  "x",
		"author": map[string]any{"link": "not a url"},
	})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d", rec.Code)
	}
	response := decode[ValidationErrorResponse](t, rec)
	if len(response.Error.Issues) != 1 {
		t.Fatalf("issues: %+v", response.Error.Issues)
	}
	issue := response.Error.Issues[0]
	if !reflect.DeepEqual(issue.Path, []any{"body", "author", "link"}) || issue.Code != "invalid_url" || issue.Message == "" {
		t.Errorf("unexpected issue %+v", issue)
	}

	s.mustDo("POST", "/feed", testFeed, http.StatusCreated)
	rec = s.do("PUT", "/feed/test/items", []any{testItem("ok", "2025-01-01T10:30:00Z"), map[string]any{"slug": "bad", "title": "x", "date": "2025-01-01T10:30:00Z"}})
	response = decode[ValidationErrorResponse](t, rec)
	if len(response.Error.Issues) != 1 || !reflect.DeepEqual(response.Error.Issues[0].Path, []any{"body", float64(1), "link"}) {
		t.Errorf("unexpected issues %+v", response.Error.Issues)
	}

	rec = s.do("GET", "/feed/!!!", nil)
	response = decode[ValidationErrorResponse](t, rec)
	if len(response.Error.Issues) != 1 || !reflect.DeepEqual(response.Error.Issues[0].Path, []any{"path", "feedSlug"}) {
		t.Errorf("unexpected issues %+v", response.Error.Issues)
	}
}

func TestUpsert(t *testing.T) {
	s := newAuthTestServer(t)
	s.mustDo("POST", "/feed", testFeed, http.StatusCreated)
	s.mustDo("POST", "/feed/test/items", testItem("same", "2025-01-01T10:30:00Z"), http.StatusCreated)
	s.mustDo("POST", "/feed/test/items", testItem("changed", "2025-01-01T10:30:00Z"), http.StatusCreated)

	changed := testItem("changed", "2025-01-01T10:30:00Z")
	changed["title"] = "new title"
	same := testItem("same", "2025-01-01T10:30:00Z")
	delete(same, "content")
	rec := s.mustDo("PUT", "/feed/test/items", []any{same, changed, testItem("new", "2025-01-01T10:30:00Z")}, http.StatusOK)

	result := decode[store.UpsertResult](t, rec)
	slugs := func(items []model.FeedItem) []string {
		var result []string
		for _, item := range items {
			result = append(result, item.Slug)
		}
		return result
	}
	if !slices.Equal(slugs(result.Inserted), []string{"new"}) ||
		!slices.Equal(slugs(result.Updated), []string{"changed"}) ||
		!slices.Equal(slugs(result.WithoutChange), []string{"same"}) {
		t.Errorf("unexpected upsert result %s", rec.Body)
	}
	if *result.WithoutChange[0].Content != "blah" {
		t.Errorf("missing content must keep the existing value: %s", rec.Body)
	}

	rec = s.mustDo("PUT", "/feed/test/items", []any{same}, http.StatusOK)
	if result := decode[store.UpsertResult](t, rec); len(result.Inserted) != 0 || len(result.Updated) != 0 || len(result.WithoutChange) != 1 {
		t.Errorf("unexpected upsert result %s", rec.Body)
	}
	if !strings.Contains(rec.Body.String(), `"inserted":[]`) {
		t.Errorf("empty result lists must be arrays: %s", rec.Body)
	}
}

func TestListAllFeedItems(t *testing.T) {
	s := newAuthTestServer(t)
	s.mustDo("POST", "/feed", testFeed, http.StatusCreated)
	items := make([]any, model.MaxFeedItems)
	for i := range items {
		items[i] = testItem(fmt.Sprint(i), fmt.Sprintf("2025-01-01T10:%02d:00Z", i%60))
	}
	s.mustDo("PUT", "/feed/test/items", items, http.StatusOK)
	s.mustDo("POST", "/feed/test/items", testItem("latest", "2026-01-01T00:00:00Z"), http.StatusCreated)

	all := decode[[]ArchivableFeedItem](t, s.mustDo("GET", "/feed/test/items/!all", nil, http.StatusOK))
	if len(all) != model.MaxFeedItems+1 || all[0].Slug != "latest" || all[0].Archived || !all[len(all)-1].Archived {
		t.Errorf("unexpected list: %d items, first %+v", len(all), all[0])
	}

	count := decode[DeleteAllResponse](t, s.mustDo("DELETE", "/feed/test/items/!all", nil, http.StatusOK))
	if count.Count != int64(model.MaxFeedItems+1) {
		t.Errorf("deleted %d", count.Count)
	}
}

func TestGetFeed(t *testing.T) {
	s := newAuthTestServer(t)
	s.mustDo("POST", "/feed", testFeed, http.StatusCreated)
	item := testItem("test1", "2025-01-01T10:30:05Z")
	item["authors"] = []any{map[string]any{"name": "John Doe", "link": "https://example.com/"}}
	s.mustDo("POST", "/feed/test/items", item, http.StatusCreated)

	cases := map[string]struct{ contentType, contains string }{
		"":     {"application/atom+xml; charset=utf-8", `<generator>rss-service</generator>`},
		"atom": {"application/atom+xml; charset=utf-8", `<rights>unspecified</rights>`},
		"rss":  {"application/rss+xml; charset=utf-8", `<guid isPermaLink="false">test1</guid>`},
		"json": {"application/feed+json; charset=utf-8", `"id": "test1"`},
	}
	for feedType, c := range cases {
		path := "/feed/test"
		if feedType != "" {
			path += "?type=" + feedType
		}
		rec := s.mustDo("GET", path, nil, http.StatusOK)
		if got := rec.Header().Get("Content-Type"); got != c.contentType {
			t.Errorf("type %q: content type %q, want %q", feedType, got, c.contentType)
		}
		if body := rec.Body.String(); !strings.Contains(body, c.contains) {
			t.Errorf("type %q: body doesn't contain %q:\n%s", feedType, c.contains, body)
		}
	}
}

func TestFeedLink(t *testing.T) {
	cases := map[string]string{
		"http://example.com":              "http://example.com/feed/foo",
		"http://example.com/some-path":    "http://example.com/some-path/feed/foo",
		"http://example.com/some-path/":   "http://example.com/some-path/feed/foo",
		"http://example.com/?foo=bar#baz": "http://example.com/feed/foo",
		"http://example.com/#baz":         "http://example.com/feed/foo",
		"":                                "/feed/foo",
		"/some-path":                      "/some-path/feed/foo",
	}
	for publicURL, want := range cases {
		s := &Server{cfg: Config{PublicURL: publicURL}}
		if got := s.feedLink("foo"); got != want {
			t.Errorf("feedLink with %q = %q, want %q", publicURL, got, want)
		}
	}
}
