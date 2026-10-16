package feed

import (
	"encoding/xml"
	"net/http"
	"time"
)

type rssDoc struct {
	XMLName      xml.Name   `xml:"rss"`
	Version      string     `xml:"version,attr"`
	XmlnsDC      string     `xml:"xmlns:dc,attr,omitempty"`
	XmlnsContent string     `xml:"xmlns:content,attr,omitempty"`
	Channel      rssChannel `xml:"channel"`
}

type rssChannel struct {
	Title         string    `xml:"title"`
	Link          string    `xml:"link"`
	Description   string    `xml:"description"`
	LastBuildDate string    `xml:"lastBuildDate"`
	Docs          string    `xml:"docs"`
	Generator     string    `xml:"generator,omitempty"`
	Language      string    `xml:"language,omitempty"`
	Image         *rssImage `xml:"image"`
	Copyright     string    `xml:"copyright,omitempty"`
	Items         []rssItem `xml:"item"`
}

type rssImage struct {
	Title string `xml:"title"`
	URL   string `xml:"url"`
	Link  string `xml:"link"`
}

type rssItem struct {
	Title       rssCDATA      `xml:"title"`
	Link        string        `xml:"link"`
	GUID        rssGUID       `xml:"guid"`
	PubDate     string        `xml:"pubDate"`
	Description *rssCDATA     `xml:"description"`
	Content     *rssCDATA     `xml:"content:encoded"`
	Authors     []string      `xml:"author"`
	Enclosure   *rssEnclosure `xml:"enclosure"`
}

type rssCDATA struct {
	Body string `xml:",cdata"`
}

type rssGUID struct {
	IsPermaLink bool   `xml:"isPermaLink,attr"`
	Value       string `xml:",chardata"`
}

type rssEnclosure struct {
	URL    string `xml:"url,attr"`
	Length int    `xml:"length,attr"`
	Type   string `xml:"type,attr,omitempty"`
}

// RSS renders the feed as RSS 2.0.
func (f Feed) RSS() ([]byte, error) {
	f = f.xmlSafe()
	doc := rssDoc{
		Version: "2.0",
		Channel: rssChannel{
			Title:         f.Title,
			Link:          f.Link,
			Description:   f.Description,
			LastBuildDate: formatRSSDate(f.Updated),
			Docs:          "https://validator.w3.org/feed/docs/rss2.html",
			Generator:     f.Generator,
			Language:      f.Language,
			Copyright:     f.Copyright,
		},
	}
	if f.Image != "" {
		doc.Channel.Image = &rssImage{Title: f.Title, URL: f.Image, Link: f.Link}
	}

	for _, item := range f.Items {
		entry := rssItem{
			Title:   rssCDATA{item.Title},
			Link:    item.Link,
			GUID:    rssGUID{Value: item.ID},
			PubDate: formatRSSDate(item.Date),
		}
		if item.Description != "" {
			entry.Description = &rssCDATA{item.Description}
		}
		if item.Content != "" {
			entry.Content = &rssCDATA{item.Content}
			doc.XmlnsDC = "http://purl.org/dc/elements/1.1/"
			doc.XmlnsContent = "http://purl.org/rss/1.0/modules/content/"
		}
		// RSS author must be an email, optionally followed by the name
		for _, author := range item.Authors {
			if author.Email != "" && author.Name != "" {
				entry.Authors = append(entry.Authors, author.Email+" ("+author.Name+")")
			}
		}
		if item.Image != "" {
			entry.Enclosure = &rssEnclosure{URL: item.Image, Type: imageType(item.Image)}
		}
		doc.Channel.Items = append(doc.Channel.Items, entry)
	}

	return marshalXML(doc)
}

// formatRSSDate formats t as RFC 1123 with GMT zone, as JS Date.toUTCString().
func formatRSSDate(t time.Time) string {
	return t.UTC().Format(http.TimeFormat)
}
