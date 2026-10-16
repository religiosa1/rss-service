package api

import (
	"net/http"

	"github.com/religiosa1/rss-service/internal/feed"
	"github.com/religiosa1/rss-service/internal/model"
	"github.com/religiosa1/rss-service/internal/reqlog"
	"github.com/religiosa1/rss-service/internal/version"
)

// HealthCheckResponse is the healthcheck response body.
type HealthCheckResponse struct {
	Name    string `json:"name" example:"rss-service"`
	Version string `json:"version"`
} // @name HealthCheckResponse

// healthCheck godoc
//
//	@Summary	Healthcheck endpoint
//	@ID			healthcheck
//	@Produce	json
//	@Success	200	{object}	HealthCheckResponse
//	@Router		/ [get]
func (s *Server) healthCheck(w http.ResponseWriter, _ *http.Request) error {
	writeJSON(w, http.StatusOK, HealthCheckResponse{Name: "rss-service", Version: version.String()})
	return nil
}

// listFeeds godoc
//
//	@Summary	List existing feeds
//	@ID			listFeeds
//	@Tags		feed
//	@Produce	json
//	@Success	200	{array}	model.Feed
//	@Router		/feed [get]
func (s *Server) listFeeds(w http.ResponseWriter, r *http.Request) error {
	feeds, err := s.db.ListFeeds(r.Context())
	if err != nil {
		return err
	}
	for i := range feeds {
		feeds[i] = s.withLink(feeds[i])
	}
	writeJSON(w, http.StatusOK, feeds)
	return nil
}

// createFeed godoc
//
//	@Summary	Create a new feed
//	@ID			createFeed
//	@Tags		feed
//	@Security	ApiKeyAuth
//	@Accept		json
//	@Produce	json
//	@Param		payload	body		model.FeedInput	true	"Feed; slug and title are required"
//	@Success	201		{object}	model.Feed
//	@Failure	400		{object}	ValidationErrorResponse
//	@Failure	401		{object}	ErrorResponse
//	@Failure	409		{object}	ErrorResponse	"Feed with this slug already exists"
//	@Router		/feed [post]
func (s *Server) createFeed(w http.ResponseWriter, r *http.Request) error {
	var input model.FeedInput
	if err := decodeBody(w, r, &input); err != nil {
		return err
	}
	if err := input.ValidateCreate(); err != nil {
		return validationError("body", err)
	}
	created, err := s.db.CreateFeed(r.Context(), input)
	if err != nil {
		return err
	}
	reqlog.From(r.Context()).Info("created feed", "feedSlug", created.Slug, "payload", input)
	writeJSON(w, http.StatusCreated, s.withLink(created))
	return nil
}

// feedFormat is a feed format, selected with the type query param.
type feedFormat struct {
	contentType string
	render      func(feed.Feed) ([]byte, error)
}

var feedFormats = map[string]feedFormat{
	"atom": {"application/atom+xml; charset=utf-8", feed.Feed.Atom},
	"rss":  {"application/rss+xml; charset=utf-8", feed.Feed.RSS},
	"json": {"application/feed+json; charset=utf-8", feed.Feed.JSON},
}

// getFeed godoc
//
//	@Summary	Get a feed in one of the feed formats
//	@ID			getFeedRss
//	@Tags		feed
//	@Produce	application/atom+xml,application/rss+xml,application/feed+json
//	@Param		feedSlug	path		string	true	"Feed slug"
//	@Param		type		query		string	false	"Feed output format"	Enums(atom, rss, json)	default(atom)
//	@Success	200			{string}	string
//	@Failure	400			{object}	ValidationErrorResponse
//	@Failure	404			{object}	ErrorResponse	"No such feed"
//	@Router		/feed/{feedSlug} [get]
func (s *Server) getFeed(w http.ResponseWriter, r *http.Request) error {
	feedSlug, err := pathSlug(r, "feedSlug")
	if err != nil {
		return err
	}
	feedType := r.URL.Query().Get("type")
	if feedType == "" {
		feedType = "atom"
	}
	format, ok := feedFormats[feedType]
	if !ok {
		return &httpError{status: http.StatusBadRequest, message: "Bad request", issues: []Issue{{
			Code: "invalid_value", Path: []any{"query", "type"}, Message: "must be one of atom, rss, json",
		}}}
	}

	dbFeed, items, err := s.db.GetFeedWithItems(r.Context(), feedSlug)
	if err != nil {
		return err
	}
	body, err := format.render(s.buildFeed(s.withLink(dbFeed), items))
	if err != nil {
		return err
	}
	w.Header().Set("Content-Type", format.contentType)
	_, err = w.Write(body)
	return err
}

func (s *Server) buildFeed(dbFeed model.Feed, items []model.FeedItem) feed.Feed {
	doc := feed.Feed{
		ID:          dbFeed.Slug,
		Title:       dbFeed.Title,
		Link:        dbFeed.Link,
		Description: deref(dbFeed.Description),
		Language:    deref(dbFeed.Language),
		Image:       deref(dbFeed.Image),
		Favicon:     deref(dbFeed.Favicon),
		Copyright:   deref(dbFeed.Copyright),
		Generator:   s.cfg.Generator,
		Updated:     dbFeed.UpdatedAt.Time,
		Items:       make([]feed.Item, 0, len(items)),
	}
	if doc.Copyright == "" {
		doc.Copyright = "unspecified"
	}
	if dbFeed.Author != nil {
		author := feed.Person(*dbFeed.Author)
		doc.Author = &author
	}
	for _, item := range items {
		entry := feed.Item{
			ID:          item.Slug,
			Title:       item.Title,
			Link:        item.Link,
			Description: deref(item.Description),
			Content:     deref(item.Content),
			Image:       deref(item.Image),
			Date:        item.Date.Time,
		}
		for _, author := range item.Authors {
			entry.Authors = append(entry.Authors, feed.Person(author))
		}
		for _, contributor := range item.Contributors {
			entry.Contributors = append(entry.Contributors, feed.Person(contributor))
		}
		doc.Items = append(doc.Items, entry)
	}
	return doc
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// updateFeed godoc
//
//	@Summary		Update existing feed values
//	@Description	Updates the existing feed (by slug provided in path) with the values
//	@Description	provided in the payload. Fields missing in the payload are kept as is,
//	@Description	nullable fields set to null are removed.
//	@Description
//	@Description	Author patch is not deep: if author is present in the payload, it
//	@Description	replaces the existing one as a whole.
//	@ID				updateFeed
//	@Tags			feed
//	@Security		ApiKeyAuth
//	@Accept			json
//	@Produce		json
//	@Param			feedSlug	path		string			true	"Feed slug"
//	@Param			payload		body		model.FeedInput	true	"Feed fields to update"
//	@Success		200			{object}	model.Feed
//	@Failure		400			{object}	ValidationErrorResponse
//	@Failure		401			{object}	ErrorResponse
//	@Failure		404			{object}	ErrorResponse	"Feed with the provided slug doesn't exist"
//	@Failure		409			{object}	ErrorResponse	"Updated slug value already exists"
//	@Router			/feed/{feedSlug} [patch]
func (s *Server) updateFeed(w http.ResponseWriter, r *http.Request) error {
	feedSlug, err := pathSlug(r, "feedSlug")
	if err != nil {
		return err
	}
	var input model.FeedInput
	if err := decodeBody(w, r, &input); err != nil {
		return err
	}
	if err := input.ValidatePatch(); err != nil {
		return validationError("body", err)
	}
	updated, err := s.db.UpdateFeed(r.Context(), feedSlug, input)
	if err != nil {
		return err
	}
	reqlog.From(r.Context()).Info("patched feed", "feedSlug", feedSlug, "newSlug", updated.Slug, "payload", input)
	writeJSON(w, http.StatusOK, s.withLink(updated))
	return nil
}

// deleteFeed godoc
//
//	@Summary	Delete an existing feed
//	@ID			deleteFeed
//	@Tags		feed
//	@Security	ApiKeyAuth
//	@Param		feedSlug	path	string	true	"Feed slug"
//	@Success	204
//	@Failure	400	{object}	ValidationErrorResponse	"Malformed slug"
//	@Failure	401	{object}	ErrorResponse
//	@Failure	404	{object}	ErrorResponse	"Feed with the provided slug doesn't exist"
//	@Router		/feed/{feedSlug} [delete]
func (s *Server) deleteFeed(w http.ResponseWriter, r *http.Request) error {
	feedSlug, err := pathSlug(r, "feedSlug")
	if err != nil {
		return err
	}
	if err := s.db.DeleteFeed(r.Context(), feedSlug); err != nil {
		return err
	}
	reqlog.From(r.Context()).Info("deleted feed", "feedSlug", feedSlug)
	w.WriteHeader(http.StatusNoContent)
	return nil
}
