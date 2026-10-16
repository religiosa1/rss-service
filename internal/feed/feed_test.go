package feed

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"io"
	"os"
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"
)

// testFeed is the feed used to generate testdata/jpmonette.* with the
// node.js version of the service (jpmonette/feed v5.1.0).
func testFeed() Feed {
	return Feed{
		ID:          "full",
		Title:       "Full feed",
		Link:        "/feed/full",
		Description: "desc",
		Language:    "en",
		Image:       "https://example.com/logo.png",
		Favicon:     "https://example.com/favicon.ico",
		Copyright:   "CC0",
		Generator:   "rss-service",
		Updated:     time.Date(2025, 1, 2, 0, 0, 0, 0, time.UTC),
		Author:      &Person{Name: "John Doe", Email: "john@example.com", Link: "https://example.com/john"},
		Items: []Item{
			{
				ID:    "b",
				Title: "B",
				Link:  "https://example.com/b",
				Date:  time.Date(2025, 1, 2, 0, 0, 0, 0, time.UTC),
			},
			{
				ID:           "a",
				Title:        "A",
				Link:         "https://example.com/a",
				Description:  "summary <b>a</b>",
				Content:      "<p>content ]]> a</p>",
				Image:        "https://example.com/a.jpg",
				Date:         time.Date(2025, 1, 1, 10, 30, 5, 123_000_000, time.UTC),
				Authors:      []Person{{Name: "John Doe", Link: "https://example.com/"}, {Name: "Jane", Email: "jane@example.com"}},
				Contributors: []Person{{Name: "Jane Doe", Avatar: "https://example.com/jane.png"}},
			},
		},
	}
}

// jpmonette/feed takes the extension as is, we use a proper mime type.
var xmlDifferences = strings.NewReplacer(`type="image/jpg"`, `type="image/jpeg"`)

func TestAtomMatchesJpmonette(t *testing.T) {
	got, err := testFeed().Atom()
	if err != nil {
		t.Fatal(err)
	}
	assertSameXML(t, xmlDifferences.Replace(readTestdata(t, "jpmonette.atom.xml")), string(got))
}

func TestRSSMatchesJpmonette(t *testing.T) {
	got, err := testFeed().RSS()
	if err != nil {
		t.Fatal(err)
	}
	assertSameXML(t, xmlDifferences.Replace(readTestdata(t, "jpmonette.rss.xml")), string(got))
}

// JSON Feed 1.1 output must be a superset of jpmonette's 1.0 one.
func TestJSONMatchesJpmonette(t *testing.T) {
	got, err := testFeed().JSON()
	if err != nil {
		t.Fatal(err)
	}
	var want, gotDoc map[string]any
	if err := json.Unmarshal([]byte(readTestdata(t, "jpmonette.json")), &want); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(got, &gotDoc); err != nil {
		t.Fatal(err)
	}
	if gotDoc["version"] != "https://jsonfeed.org/version/1.1" {
		t.Errorf("version = %v", gotDoc["version"])
	}
	delete(want, "version")
	assertJSONSubset(t, "$", want, gotDoc)

	items := gotDoc["items"].([]any)
	if authors := items[1].(map[string]any)["authors"].([]any); len(authors) != 2 {
		t.Errorf("expected all item authors in 1.1 authors, got %v", authors)
	}
}

func TestJSONWithoutItems(t *testing.T) {
	got, err := Feed{ID: "x", Title: "x"}.JSON()
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Contains(got, []byte(`"items": []`)) {
		t.Errorf("items must be an empty array, got %s", got)
	}
}

func TestImageType(t *testing.T) {
	cases := map[string]string{
		"https://example.com/a.png?x=1": "image/png",
		"https://example.com/a.JPG":     "image/jpeg",
		"https://example.com/a.heic2":   "image/heic2",
		"https://example.com/a":         "",
	}
	for in, want := range cases {
		if got := imageType(in); got != want {
			t.Errorf("imageType(%q) = %q, want %q", in, got, want)
		}
	}
}

func readTestdata(t *testing.T, name string) string {
	t.Helper()
	data, err := os.ReadFile("testdata/" + name)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func assertJSONSubset(t *testing.T, path string, want, got any) {
	t.Helper()
	switch want := want.(type) {
	case map[string]any:
		gotMap, ok := got.(map[string]any)
		if !ok {
			t.Errorf("%s: want object, got %v", path, got)
			return
		}
		for key, value := range want {
			assertJSONSubset(t, path+"."+key, value, gotMap[key])
		}
	case []any:
		gotSlice, ok := got.([]any)
		if !ok || len(gotSlice) != len(want) {
			t.Errorf("%s: want %v, got %v", path, want, got)
			return
		}
		for i := range want {
			assertJSONSubset(t, path+"[]", want[i], gotSlice[i])
		}
	default:
		if want != got {
			t.Errorf("%s: want %v, got %v", path, want, got)
		}
	}
}

// node is a normalized XML element: whitespace-only text dropped, CDATA
// merged with text, attributes sorted.
type node struct {
	Name     string
	Attrs    []string
	Text     string
	Children []node
}

func assertSameXML(t *testing.T, want, got string) {
	t.Helper()
	wantTree, gotTree := parseXML(t, want), parseXML(t, got)
	if !reflect.DeepEqual(wantTree, gotTree) {
		t.Errorf("XML mismatch\nwant:\n%s\ngot:\n%s", want, got)
	}
}

func parseXML(t *testing.T, doc string) node {
	t.Helper()
	dec := xml.NewDecoder(strings.NewReader(doc))
	root := node{}
	stack := []*node{&root}
	for {
		tok, err := dec.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		top := stack[len(stack)-1]
		switch tok := tok.(type) {
		case xml.StartElement:
			n := node{Name: tok.Name.Space + ":" + tok.Name.Local}
			for _, attr := range tok.Attr {
				n.Attrs = append(n.Attrs, attr.Name.Space+":"+attr.Name.Local+"="+attr.Value)
			}
			slices.Sort(n.Attrs)
			top.Children = append(top.Children, n)
			stack = append(stack, &top.Children[len(top.Children)-1])
		case xml.EndElement:
			top.Text = strings.TrimSpace(top.Text)
			stack = stack[:len(stack)-1]
		case xml.CharData:
			top.Text += string(tok)
		}
	}
	root.Text = strings.TrimSpace(root.Text)
	return root
}

func TestXMLDropsInvalidChars(t *testing.T) {
	f := Feed{
		Title: "feed\x00",
		Items: []Item{{
			ID:      "a",
			Title:   "bad\vtitle",
			Content: "content\x01 ]]> with\ttab",
			Authors: []Person{{Name: "x\x1f", Email: "x@example.com"}},
		}},
	}
	for name, render := range map[string]func() ([]byte, error){"atom": f.Atom, "rss": f.RSS} {
		data, err := render()
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		dec := xml.NewDecoder(bytes.NewReader(data))
		for {
			if _, err := dec.Token(); err == io.EOF {
				break
			} else if err != nil {
				t.Fatalf("%s: invalid XML: %v\n%s", name, err, data)
			}
		}
		if !bytes.Contains(data, []byte("badtitle")) || !bytes.Contains(data, []byte("with\ttab")) {
			t.Errorf("%s: unexpected text:\n%s", name, data)
		}
	}
}
