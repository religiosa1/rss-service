// Package feed renders Atom 1.0, RSS 2.0 and JSON Feed 1.1 documents.
//
// Element mapping follows github.com/jpmonette/feed, used by the node.js
// version of the service, so readers see the same ids, links and dates.
package feed

import (
	"mime"
	"net/url"
	"path"
	"strings"
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

// xmlSafe returns a copy of the feed without characters forbidden in XML 1.0.
// encoding/xml writes them as is, and readers reject the whole document then.
func (f Feed) xmlSafe() Feed {
	f.ID = xmlText(f.ID)
	f.Title = xmlText(f.Title)
	f.Link = xmlText(f.Link)
	f.Description = xmlText(f.Description)
	f.Language = xmlText(f.Language)
	f.Image = xmlText(f.Image)
	f.Favicon = xmlText(f.Favicon)
	f.Copyright = xmlText(f.Copyright)
	f.Generator = xmlText(f.Generator)
	if f.Author != nil {
		author := f.Author.xmlSafe()
		f.Author = &author
	}
	items := make([]Item, len(f.Items))
	for i, item := range f.Items {
		item.ID = xmlText(item.ID)
		item.Title = xmlText(item.Title)
		item.Link = xmlText(item.Link)
		item.Description = xmlText(item.Description)
		item.Content = xmlText(item.Content)
		item.Image = xmlText(item.Image)
		item.Authors = xmlSafePeople(item.Authors)
		item.Contributors = xmlSafePeople(item.Contributors)
		items[i] = item
	}
	f.Items = items
	return f
}

func (p Person) xmlSafe() Person {
	return Person{Name: xmlText(p.Name), Email: xmlText(p.Email), Link: xmlText(p.Link), Avatar: xmlText(p.Avatar)}
}

func xmlSafePeople(people []Person) []Person {
	if people == nil {
		return nil
	}
	safe := make([]Person, len(people))
	for i, p := range people {
		safe[i] = p.xmlSafe()
	}
	return safe
}

// xmlText drops characters outside of the XML 1.0 Char production:
// https://www.w3.org/TR/xml/#charsets
func xmlText(s string) string {
	return strings.Map(func(r rune) rune {
		switch {
		case r == '\t', r == '\n', r == '\r',
			0x20 <= r && r <= 0xD7FF,
			0xE000 <= r && r <= 0xFFFD,
			0x10000 <= r && r <= 0x10FFFF:
			return r
		default:
			return -1
		}
	}, s)
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
