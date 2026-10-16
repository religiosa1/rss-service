package model

import (
	"bytes"
	"encoding/json"
	"errors"
	"log/slog"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/invopop/validation"
)

func TestOptionalUnmarshal(t *testing.T) {
	var input FeedInput
	if err := json.Unmarshal([]byte(`{"title": "x", "description": null}`), &input); err != nil {
		t.Fatal(err)
	}
	if title, ok := input.Title.Get(); !ok || title != "x" {
		t.Errorf("title = %+v", input.Title)
	}
	if !input.Description.IsSet() || !input.Description.IsNull() {
		t.Errorf("description must be null: %+v", input.Description)
	}
	if input.Image.IsSet() {
		t.Errorf("image must be absent: %+v", input.Image)
	}
}

func TestTimestampJSON(t *testing.T) {
	var ts Timestamp
	if err := json.Unmarshal([]byte(`"2025-01-01T13:30:15.1234+03:00"`), &ts); err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(ts)
	if err != nil {
		t.Fatal(err)
	}
	if want := `"2025-01-01T10:30:15.123Z"`; string(data) != want {
		t.Errorf("got %s, want %s", data, want)
	}
}

func validationKeys(err error) []string {
	var errs validation.Errors
	if !errors.As(err, &errs) {
		return nil
	}
	var keys []string
	for key := range errs {
		keys = append(keys, key)
	}
	return keys
}

func TestFeedItemValidation(t *testing.T) {
	valid := FeedItemInput{
		Slug:  Some("a-b_1"),
		Title: Some(""),
		Date:  Some(NewTimestamp(time.Now())),
		Link:  Some("https://example.com/"),
	}
	if err := valid.ValidateCreate(); err != nil {
		t.Errorf("valid item: %v", err)
	}
	if err := (FeedItemInput{}).ValidatePatch(); err != nil {
		t.Errorf("empty patch: %v", err)
	}

	cases := map[string]FeedItemInput{
		"slug":    {Slug: Some("a/b")},
		"title":   {Title: Null[string]()},
		"link":    {Link: Some("example.com")},
		"image":   {Image: Some("not a url")},
		"authors": {Authors: Some(Authors{{Link: "nope"}})},
	}
	for field, input := range cases {
		keys := validationKeys(input.ValidatePatch())
		if len(keys) != 1 || keys[0] != field {
			t.Errorf("%s: got errors for %v", field, keys)
		}
	}

	empty := validationKeys(FeedItemInput{Slug: Some(""), Image: Some("")}.ValidatePatch())
	if slices.Sort(empty); !slices.Equal(empty, []string{"image", "slug"}) {
		t.Errorf("empty strings: got errors for %v", empty)
	}

	if keys := validationKeys((FeedItemInput{}).ValidateCreate()); len(keys) != 4 {
		t.Errorf("create without required fields: %v", keys)
	}
}

func TestFeedItemLogValue(t *testing.T) {
	var buf bytes.Buffer
	slog.New(slog.NewJSONHandler(&buf, nil)).Info("x", "payload", FeedItemInput{Slug: Some("a"), Content: Some("long content")})
	if strings.Contains(buf.String(), "long content") || !strings.Contains(buf.String(), `"contentLength":12`) {
		t.Errorf("unexpected log line %s", buf.String())
	}
}

func TestMatches(t *testing.T) {
	desc := "desc"
	item := FeedItem{
		Slug:        "a",
		Title:       "title",
		Date:        NewTimestamp(time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)),
		Link:        "https://example.com/",
		Description: &desc,
		Authors:     Authors{{Name: "John"}},
	}
	cases := map[string]struct {
		input FeedItemInput
		want  bool
	}{
		"empty":            {FeedItemInput{}, true},
		"same":             {FeedItemInput{Slug: Some("a"), Description: Some(desc), Authors: Some(Authors{{Name: "John"}})}, true},
		"same date":        {FeedItemInput{Date: Some(NewTimestamp(item.Date.In(time.FixedZone("x", 3600))))}, true},
		"null content":     {FeedItemInput{Content: Null[string]()}, true},
		"other title":      {FeedItemInput{Title: Some("other")}, false},
		"null description": {FeedItemInput{Description: Null[string]()}, false},
		"set content":      {FeedItemInput{Content: Some("x")}, false},
		"other authors":    {FeedItemInput{Authors: Some(Authors{{Name: "Jane"}})}, false},
		"empty authors":    {FeedItemInput{Authors: Some(Authors{})}, false},
	}
	for name, c := range cases {
		if got := c.input.Matches(item); got != c.want {
			t.Errorf("%s: got %v, want %v", name, got, c.want)
		}
	}
}
