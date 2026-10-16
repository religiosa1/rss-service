package feed

import (
	"bytes"
	"encoding/xml"
)

type atomFeed struct {
	XMLName   xml.Name    `xml:"feed"`
	Xmlns     string      `xml:"xmlns,attr"`
	ID        string      `xml:"id"`
	Title     string      `xml:"title"`
	Updated   string      `xml:"updated"`
	Generator string      `xml:"generator,omitempty"`
	Author    *atomPerson `xml:"author"`
	Links     []atomLink  `xml:"link"`
	Subtitle  string      `xml:"subtitle,omitempty"`
	Logo      string      `xml:"logo,omitempty"`
	Icon      string      `xml:"icon,omitempty"`
	Rights    string      `xml:"rights,omitempty"`
	Entries   []atomEntry `xml:"entry"`
}

type atomEntry struct {
	Title        atomText     `xml:"title"`
	ID           string       `xml:"id"`
	Links        []atomLink   `xml:"link"`
	Updated      string       `xml:"updated"`
	Summary      *atomText    `xml:"summary"`
	Content      *atomText    `xml:"content"`
	Authors      []atomPerson `xml:"author"`
	Contributors []atomPerson `xml:"contributor"`
}

type atomText struct {
	Type string `xml:"type,attr"`
	Body string `xml:",cdata"`
}

type atomLink struct {
	Rel  string `xml:"rel,attr,omitempty"`
	Href string `xml:"href,attr"`
	Type string `xml:"type,attr,omitempty"`
}

type atomPerson struct {
	Name  string `xml:"name"`
	Email string `xml:"email,omitempty"`
	URI   string `xml:"uri,omitempty"`
}

// Atom renders the feed as Atom 1.0.
func (f Feed) Atom() ([]byte, error) {
	f = f.xmlSafe()
	doc := atomFeed{
		Xmlns:     "http://www.w3.org/2005/Atom",
		ID:        f.ID,
		Title:     f.Title,
		Updated:   formatISO(f.Updated),
		Generator: f.Generator,
		Subtitle:  f.Description,
		Logo:      f.Image,
		Icon:      f.Favicon,
		Rights:    f.Copyright,
	}
	if f.Author != nil {
		author := newAtomPerson(*f.Author)
		doc.Author = &author
	}
	if f.Link != "" {
		doc.Links = append(doc.Links, atomLink{Rel: "alternate", Href: f.Link})
	}

	for _, item := range f.Items {
		entry := atomEntry{
			Title:   atomText{Type: "html", Body: item.Title},
			ID:      item.ID,
			Links:   []atomLink{{Href: item.Link}},
			Updated: formatISO(item.Date),
		}
		if item.Image != "" {
			entry.Links = append(entry.Links, atomLink{Rel: "enclosure", Href: item.Image, Type: imageType(item.Image)})
		}
		if item.Description != "" {
			entry.Summary = &atomText{Type: "html", Body: item.Description}
		}
		if item.Content != "" {
			entry.Content = &atomText{Type: "html", Body: item.Content}
		}
		for _, author := range item.Authors {
			entry.Authors = append(entry.Authors, newAtomPerson(author))
		}
		for _, contributor := range item.Contributors {
			entry.Contributors = append(entry.Contributors, newAtomPerson(contributor))
		}
		doc.Entries = append(doc.Entries, entry)
	}

	return marshalXML(doc)
}

func newAtomPerson(p Person) atomPerson {
	return atomPerson{Name: p.Name, Email: p.Email, URI: p.Link}
}

func marshalXML(doc any) ([]byte, error) {
	var buf bytes.Buffer
	buf.WriteString(xml.Header)
	enc := xml.NewEncoder(&buf)
	enc.Indent("", "    ")
	if err := enc.Encode(doc); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
