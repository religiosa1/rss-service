package api

import (
	"net/http"

	"github.com/invopop/validation"
	"github.com/religiosa1/rss-service/internal/model"
	"github.com/religiosa1/rss-service/internal/reqlog"
	"github.com/religiosa1/rss-service/internal/store"
)

// listFeedItems godoc
//
//	@Summary		Get a list of feed items
//	@Description	Get a list of all non-archived entries in the feed. The list is never
//	@Description	bigger than 100 items long.
//	@ID				getListOfFeedItems
//	@Tags			feed-item
//	@Produce		json
//	@Param			feedSlug	path		string	true	"Feed slug"
//	@Success		200			{array}		model.FeedItem
//	@Failure		400			{object}	ValidationErrorResponse
//	@Failure		404			{object}	ErrorResponse	"Feed with the provided slug doesn't exist"
//	@Router			/feed/{feedSlug}/items [get]
func (s *Server) listFeedItems(w http.ResponseWriter, r *http.Request) error {
	feedSlug, err := pathSlug(r, "feedSlug")
	if err != nil {
		return err
	}
	items, err := s.db.ListFeedItems(r.Context(), feedSlug)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, items)
	return nil
}

// ArchivableFeedItem is a feed item with its archive status.
type ArchivableFeedItem struct {
	model.FeedItem
	Archived bool `json:"archived"`
} // @name ArchivableFeedItemSchema

// listAllFeedItems godoc
//
//	@Summary		Get a list of both non-archived and archived feed items
//	@Description	Get a list of all non-archived and archived entries in the feed.
//	@Description	The list is never bigger than 300 items long.
//	@ID				getListOfAllFeedItems
//	@Tags			feed-item
//	@Produce		json
//	@Param			feedSlug	path		string	true	"Feed slug"
//	@Success		200			{array}		ArchivableFeedItem
//	@Failure		400			{object}	ValidationErrorResponse
//	@Failure		404			{object}	ErrorResponse	"Feed with the provided slug doesn't exist"
//	@Router			/feed/{feedSlug}/items/__all [get]
func (s *Server) listAllFeedItems(w http.ResponseWriter, r *http.Request) error {
	feedSlug, err := pathSlug(r, "feedSlug")
	if err != nil {
		return err
	}
	items, err := s.db.ListAllFeedItems(r.Context(), feedSlug)
	if err != nil {
		return err
	}
	result := make([]ArchivableFeedItem, len(items))
	for i, item := range items {
		result[i] = ArchivableFeedItem{FeedItem: item, Archived: i >= model.MaxFeedItems}
	}
	writeJSON(w, http.StatusOK, result)
	return nil
}

// createFeedItem godoc
//
//	@Summary		Create a new entry in the feed
//	@Description	Creates a new entry (post, article, etc.) in a feed. At any given time
//	@Description	a feed contains 100 entries, when you're adding an entry beyond that
//	@Description	limit, the oldest entry moves to archive, which contains 200 additional
//	@Description	entries. Any older entry from archive is deleted.
//	@ID				createFeedItem
//	@Tags			feed-item
//	@Security		ApiKeyAuth
//	@Accept			json
//	@Produce		json
//	@Param			feedSlug	path		string				true	"Feed slug"
//	@Param			payload		body		model.FeedItemInput	true	"Feed item; slug, title, date and link are required"
//	@Success		201			{object}	model.FeedItem
//	@Failure		400			{object}	ValidationErrorResponse
//	@Failure		401			{object}	ErrorResponse
//	@Failure		404			{object}	ErrorResponse	"Feed with the provided slug doesn't exist"
//	@Failure		409			{object}	ErrorResponse	"Feed entry item with the same slug already exists in the feed"
//	@Failure		422			{object}	ErrorResponse	"Item is older than the whole feed archive"
//	@Router			/feed/{feedSlug}/items [post]
func (s *Server) createFeedItem(w http.ResponseWriter, r *http.Request) error {
	feedSlug, err := pathSlug(r, "feedSlug")
	if err != nil {
		return err
	}
	var input model.FeedItemInput
	if err := decodeBody(w, r, &input); err != nil {
		return err
	}
	if err := input.ValidateCreate(); err != nil {
		return validationError("body", err)
	}
	item, err := s.db.CreateFeedItem(r.Context(), feedSlug, input)
	if err != nil {
		return err
	}
	reqlog.From(r.Context()).Info("created feed item", "feedSlug", feedSlug, "feedItemSlug", item.Slug, "payload", input)
	writeJSON(w, http.StatusCreated, item)
	return nil
}

// upsertFeedItems godoc
//
//	@Summary		Upsert many feed items
//	@Description	Upsert many feed items. This endpoint allows you to get all the current feed
//	@Description	items from the source and post them to the service, the service will figure
//	@Description	out whether it's a new item, requires modification (based on provided fields)
//	@Description	or should be left without changes. Resulting modification status is included
//	@Description	in the response payload.
//	@Description
//	@Description	Each item will be patched, meaning, if there's an existing item, but you
//	@Description	provided only some of its fields, only these fields will be updated.
//	@Description	Still, you must provide all of the required fields, such as slug, title,
//	@Description	etc., so in case item doesn't exist, it can be created.
//	@ID				upsertFeedItems
//	@Tags			feed-item
//	@Security		ApiKeyAuth
//	@Accept			json
//	@Produce		json
//	@Param			feedSlug	path		string					true	"Feed slug"
//	@Param			payload		body		[]model.FeedItemInput	true	"1 to 100 feed items"
//	@Success		200			{object}	store.UpsertResult
//	@Failure		400			{object}	ValidationErrorResponse
//	@Failure		401			{object}	ErrorResponse
//	@Failure		404			{object}	ErrorResponse	"Feed with the provided slug doesn't exist"
//	@Failure		409			{object}	ErrorResponse	"Duplicated slugs in the payload"
//	@Failure		413			{object}	ErrorResponse	"More items provided than can be displayed in the feed"
//	@Failure		422			{object}	ErrorResponse	"Item is older than the whole feed archive"
//	@Router			/feed/{feedSlug}/items [put]
func (s *Server) upsertFeedItems(w http.ResponseWriter, r *http.Request) error {
	feedSlug, err := pathSlug(r, "feedSlug")
	if err != nil {
		return err
	}
	var inputs []model.FeedItemInput
	if err := decodeBody(w, r, &inputs); err != nil {
		return err
	}
	if len(inputs) > model.MaxFeedItems {
		return newError(http.StatusRequestEntityTooLarge, "Too many items provided, max %d", model.MaxFeedItems)
	}
	if err := validation.Validate(inputs, validation.Required, validation.Each(validateItemCreate)); err != nil {
		return validationError("body", err)
	}
	if err := checkUniqueSlugs(inputs); err != nil {
		return err
	}
	// explicit type, so swag resolves store.UpsertResult in annotations through the import
	var result store.UpsertResult
	result, err = s.db.UpsertFeedItems(r.Context(), feedSlug, inputs)
	if err != nil {
		return err
	}
	reqlog.From(r.Context()).Info("upserted feed items",
		"feedSlug", feedSlug,
		"inserted", itemSlugs(result.Inserted),
		"updated", itemSlugs(result.Updated),
		"withoutChange", itemSlugs(result.WithoutChange),
	)
	writeJSON(w, http.StatusOK, result)
	return nil
}

var validateItemCreate = validation.By(func(value any) error {
	return value.(model.FeedItemInput).ValidateCreate()
})

func checkUniqueSlugs(inputs []model.FeedItemInput) error {
	seen := make(map[string]bool, len(inputs))
	for _, input := range inputs {
		slug, _ := input.Slug.Get()
		if seen[slug] {
			return newError(http.StatusConflict, "slug %s is not unique among the provided items", slug)
		}
		seen[slug] = true
	}
	return nil
}

func itemSlugs(items []model.FeedItem) []string {
	slugs := make([]string, len(items))
	for i, item := range items {
		slugs[i] = item.Slug
	}
	return slugs
}

// updateFeedItem godoc
//
//	@Summary		Update a feed entry item
//	@Description	Update an existing feed entry with new values. Only specified values
//	@Description	will be used. For nullable values you must specify null in the payload
//	@Description	to reset them, not specifying the field at all keeps the existing value.
//	@Description
//	@Description	Updates for authors and contributors must come as a full array, with
//	@Description	all old values present. Setting either value to null removes it.
//	@ID				updateFeedItem
//	@Tags			feed-item
//	@Security		ApiKeyAuth
//	@Accept			json
//	@Produce		json
//	@Param			feedSlug		path		string				true	"Feed slug"
//	@Param			feedItemSlug	path		string				true	"Feed item slug"
//	@Param			payload			body		model.FeedItemInput	true	"Feed item fields to update"
//	@Success		200				{object}	model.FeedItem
//	@Failure		400				{object}	ValidationErrorResponse
//	@Failure		401				{object}	ErrorResponse
//	@Failure		404				{object}	ErrorResponse	"Feed or entry with the provided slug doesn't exist"
//	@Failure		409				{object}	ErrorResponse	"Updated slug value already exists in the feed"
//	@Router			/feed/{feedSlug}/items/{feedItemSlug} [patch]
func (s *Server) updateFeedItem(w http.ResponseWriter, r *http.Request) error {
	feedSlug, err := pathSlug(r, "feedSlug")
	if err != nil {
		return err
	}
	itemSlug, err := pathSlug(r, "feedItemSlug")
	if err != nil {
		return err
	}
	var input model.FeedItemInput
	if err := decodeBody(w, r, &input); err != nil {
		return err
	}
	if err := input.ValidatePatch(); err != nil {
		return validationError("body", err)
	}
	item, err := s.db.UpdateFeedItem(r.Context(), feedSlug, itemSlug, input)
	if err != nil {
		return err
	}
	reqlog.From(r.Context()).Info("patched feed item",
		"feedSlug", feedSlug, "feedItemSlug", itemSlug, "newSlug", item.Slug, "payload", input)
	writeJSON(w, http.StatusOK, item)
	return nil
}

// DeleteAllResponse is the response of deleting all items in a feed.
type DeleteAllResponse struct {
	// Count is the amount of items deleted.
	Count int64 `json:"count"`
} // @name DeleteAllResponse

// deleteAllFeedItems godoc
//
//	@Summary		Delete all items in a feed
//	@Description	Deletes all items (both current and archived) in a feed.
//	@ID				deleteAllItemsInFeed
//	@Tags			feed-item
//	@Security		ApiKeyAuth
//	@Produce		json
//	@Param			feedSlug	path		string	true	"Feed slug"
//	@Success		200			{object}	DeleteAllResponse
//	@Failure		400			{object}	ValidationErrorResponse
//	@Failure		401			{object}	ErrorResponse
//	@Failure		404			{object}	ErrorResponse	"Feed with the provided slug doesn't exist"
//	@Router			/feed/{feedSlug}/items/__all [delete]
func (s *Server) deleteAllFeedItems(w http.ResponseWriter, r *http.Request) error {
	feedSlug, err := pathSlug(r, "feedSlug")
	if err != nil {
		return err
	}
	count, err := s.db.DeleteAllFeedItems(r.Context(), feedSlug)
	if err != nil {
		return err
	}
	reqlog.From(r.Context()).Info("deleted all feed items", "feedSlug", feedSlug, "count", count)
	writeJSON(w, http.StatusOK, DeleteAllResponse{Count: count})
	return nil
}

// deleteFeedItem godoc
//
//	@Summary		Delete an existing feed entry item
//	@Description	Deletes an existing feed entry. If archive contains some entries, one of
//	@Description	them will be added to the current feed instead of the deleted one (but
//	@Description	taking the oldest place). You can also use this endpoint to delete
//	@Description	archived entries as well.
//	@ID				deleteFeedItem
//	@Tags			feed-item
//	@Security		ApiKeyAuth
//	@Param			feedSlug		path	string	true	"Feed slug"
//	@Param			feedItemSlug	path	string	true	"Feed item slug"
//	@Success		204
//	@Failure		400	{object}	ValidationErrorResponse
//	@Failure		401	{object}	ErrorResponse
//	@Failure		404	{object}	ErrorResponse	"Feed or entry with the provided slug doesn't exist"
//	@Router			/feed/{feedSlug}/items/{feedItemSlug} [delete]
func (s *Server) deleteFeedItem(w http.ResponseWriter, r *http.Request) error {
	feedSlug, err := pathSlug(r, "feedSlug")
	if err != nil {
		return err
	}
	itemSlug, err := pathSlug(r, "feedItemSlug")
	if err != nil {
		return err
	}
	if err := s.db.DeleteFeedItem(r.Context(), feedSlug, itemSlug); err != nil {
		return err
	}
	reqlog.From(r.Context()).Info("deleted feed item", "feedSlug", feedSlug, "feedItemSlug", itemSlug)
	w.WriteHeader(http.StatusNoContent)
	return nil
}
