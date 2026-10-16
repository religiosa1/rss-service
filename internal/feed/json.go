package feed

import "encoding/json"

type jsonFeed struct {
	Version     string       `json:"version"`
	Title       string       `json:"title"`
	HomePageURL string       `json:"home_page_url,omitempty"`
	Description string       `json:"description,omitempty"`
	Icon        string       `json:"icon,omitempty"`
	Favicon     string       `json:"favicon,omitempty"`
	Language    string       `json:"language,omitempty"`
	Author      *jsonAuthor  `json:"author,omitempty"`
	Authors     []jsonAuthor `json:"authors,omitempty"`
	Items       []jsonItem   `json:"items"`
}

type jsonItem struct {
	ID           string       `json:"id"`
	URL          string       `json:"url,omitempty"`
	Title        string       `json:"title,omitempty"`
	ContentHTML  string       `json:"content_html,omitempty"`
	Summary      string       `json:"summary,omitempty"`
	Image        string       `json:"image,omitempty"`
	DateModified string       `json:"date_modified,omitempty"`
	Author       *jsonAuthor  `json:"author,omitempty"`
	Authors      []jsonAuthor `json:"authors,omitempty"`
}

type jsonAuthor struct {
	Name   string `json:"name,omitempty"`
	URL    string `json:"url,omitempty"`
	Avatar string `json:"avatar,omitempty"`
}

// JSON renders the feed as JSON Feed 1.1. Deprecated 1.0 "author" fields
// are kept along with "authors", as the spec suggests for compatibility.
func (f Feed) JSON() ([]byte, error) {
	doc := jsonFeed{
		Version:     "https://jsonfeed.org/version/1.1",
		Title:       f.Title,
		HomePageURL: f.Link,
		Description: f.Description,
		Icon:        f.Image,
		Favicon:     f.Favicon,
		Language:    f.Language,
		Items:       make([]jsonItem, 0, len(f.Items)),
	}
	if f.Author != nil {
		author := newJSONAuthor(*f.Author)
		doc.Author = &author
		doc.Authors = []jsonAuthor{author}
	}

	for _, item := range f.Items {
		entry := jsonItem{
			ID:           item.ID,
			URL:          item.Link,
			Title:        item.Title,
			ContentHTML:  item.Content,
			Image:        item.Image,
			DateModified: formatISO(item.Date),
		}
		// one of content_html or content_text is required
		if item.Content == "" {
			entry.ContentHTML = item.Description
		} else {
			entry.Summary = item.Description
		}
		for _, author := range item.Authors {
			entry.Authors = append(entry.Authors, newJSONAuthor(author))
		}
		if len(entry.Authors) > 0 {
			entry.Author = &entry.Authors[0]
		}
		doc.Items = append(doc.Items, entry)
	}

	return json.MarshalIndent(doc, "", "    ")
}

func newJSONAuthor(p Person) jsonAuthor {
	return jsonAuthor{Name: p.Name, URL: p.Link, Avatar: p.Avatar}
}
