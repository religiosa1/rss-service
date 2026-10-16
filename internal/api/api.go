// Package api implements the REST API and the feed endpoints.
package api

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"

	"github.com/invopop/validation"
	"github.com/religiosa1/rss-service/internal/model"
	"github.com/religiosa1/rss-service/internal/store"
)

// APIKeyHeader is the header authorizing modification requests.
const APIKeyHeader = "X-API-Key"

// maxBodySize limits request bodies; MaxFeedItems items with long content fit.
const maxBodySize = 32 << 20

type Config struct {
	// APIKey authorizes modification requests; if empty, they're not authorized at all.
	APIKey string
	// PublicURL of the service, used in feed links.
	PublicURL string
	// Generator is the value of "generator" field in feeds.
	Generator string
}

type Server struct {
	db  *store.DB
	cfg Config
}

func New(db *store.DB, cfg Config) *Server {
	return &Server{db: db, cfg: cfg}
}

// Register adds the API routes to mux.
func (s *Server) Register(mux *http.ServeMux) {
	mux.Handle("GET /{$}", handle(s.healthCheck))

	mux.Handle("GET /feed", handle(s.listFeeds))
	mux.Handle("POST /feed", s.auth(handle(s.createFeed)))
	mux.Handle("GET /feed/{feedSlug}", handle(s.getFeed))
	mux.Handle("PATCH /feed/{feedSlug}", s.auth(handle(s.updateFeed)))
	mux.Handle("DELETE /feed/{feedSlug}", s.auth(handle(s.deleteFeed)))

	mux.Handle("GET /feed/{feedSlug}/items", handle(s.listFeedItems))
	mux.Handle("GET /feed/{feedSlug}/items/!all", handle(s.listAllFeedItems))
	mux.Handle("POST /feed/{feedSlug}/items", s.auth(handle(s.createFeedItem)))
	mux.Handle("PUT /feed/{feedSlug}/items", s.auth(handle(s.upsertFeedItems)))
	mux.Handle("PATCH /feed/{feedSlug}/items/{feedItemSlug}", s.auth(handle(s.updateFeedItem)))
	mux.Handle("DELETE /feed/{feedSlug}/items/!all", s.auth(handle(s.deleteAllFeedItems)))
	mux.Handle("DELETE /feed/{feedSlug}/items/{feedItemSlug}", s.auth(handle(s.deleteFeedItem)))
}

// handle converts errors returned by fn into error responses.
func handle(fn func(w http.ResponseWriter, r *http.Request) error) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := fn(w, r); err != nil {
			writeError(w, r, err)
		}
	})
}

// auth checks the API key, if it's configured.
func (s *Server) auth(next http.Handler) http.Handler {
	if s.cfg.APIKey == "" {
		return next
	}
	// comparing hashes, so the comparison time doesn't depend on the key length
	keyHash := sha256.Sum256([]byte(s.cfg.APIKey))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		provided := r.Header.Get(APIKeyHeader)
		providedHash := sha256.Sum256([]byte(provided))
		if provided == "" || subtle.ConstantTimeCompare(keyHash[:], providedHash[:]) != 1 {
			writeError(w, r, newError(http.StatusUnauthorized, "Unauthorized"))
			return
		}
		next.ServeHTTP(w, r)
	})
}

// pathSlug returns a validated slug path parameter.
func pathSlug(r *http.Request, name string) (string, error) {
	slug := r.PathValue(name)
	if err := model.ValidateSlug(slug); err != nil {
		return "", validationError("path", validation.Errors{name: err})
	}
	return slug, nil
}

func decodeBody(w http.ResponseWriter, r *http.Request, dest any) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)
	if err := json.NewDecoder(r.Body).Decode(dest); err != nil {
		return decodeError(err)
	}
	return nil
}

// feedLink returns the public url of the feed.
func (s *Server) feedLink(feedSlug string) string {
	base := s.cfg.PublicURL
	if u, err := url.Parse(base); err == nil && u.Scheme != "" && u.Host != "" {
		// dropping query and fragment
		base = u.Scheme + "://" + u.Host + u.Path
	}
	if !strings.HasSuffix(base, "/") {
		base += "/"
	}
	return base + "feed/" + url.PathEscape(feedSlug)
}
