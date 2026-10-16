// Package feed renders Atom 1.0, RSS 2.0 and JSON Feed 1.1 documents.
//
// Element mapping follows github.com/jpmonette/feed, used by the node.js
// version of the service, so readers see the same ids, links and dates.
package feed

import (
	"mime"
	"net/url"
	"path"
	"time"
)

// Feed is the format-agnostic feed. Empty strings mean the value is not set.
type Feed struct {
	ID          string
	Title       string
	Link        string
	Description string
	Language    string
	Image       string
	Favicon     string
	Copyright   string
	Generator   string
	Updated     time.Time
	Author      *Person
	Items       []Item
}

type Item struct {
	ID           string
	Title        string
	Link         string
	Description  string
	Content      string
	Image        string
	Date         time.Time
	Authors      []Person
	Contributors []Person
}

type Person struct {
	Name   string
	Email  string
	Link   string
	Avatar string
}

// isoLayout matches JS Date.toISOString().
// NOTE: same as model.isoLayout, duplicated to keep this package dependency-free.
const isoLayout = "2006-01-02T15:04:05.000Z07:00"

func formatISO(t time.Time) string {
	return t.UTC().Format(isoLayout)
}

// imageType guesses the mime type of an image by its url extension.
func imageType(imageURL string) string {
	u, err := url.Parse(imageURL)
	if err != nil {
		return ""
	}
	ext := path.Ext(u.Path)
	if ext == "" {
		return ""
	}
	if mimeType := mime.TypeByExtension(ext); mimeType != "" {
		return mimeType
	}
	// what jpmonette/feed does for every extension
	return "image/" + ext[1:]
}
