package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"net/http"
	"slices"
	"strconv"
	"strings"

	"github.com/invopop/validation"
	"github.com/religiosa1/rss-service/internal/reqlog"
	"github.com/religiosa1/rss-service/internal/store"
)

// ErrorResponse is the body of every error response.
type ErrorResponse struct {
	Success bool   `json:"success" example:"false"`
	Status  int    `json:"status" example:"404"`
	Message string `json:"message"`
} // @name ErrorResponse

// ValidationErrorResponse is the body of a 400 response on invalid input.
type ValidationErrorResponse struct {
	ErrorResponse
	Error ValidationDetails `json:"error"`
} // @name ValidationErrorResponse

type ValidationDetails struct {
	Issues []Issue `json:"issues"`
}

// Issue is a single invalid value in the request.
type Issue struct {
	Code string `json:"code" example:"validation_length_out_of_range"`
	// Path to the invalid value: field names and array indexes,
	// starting with "body", "path" or "query".
	Path    []any  `json:"path" swaggertype:"array,string" example:"body,authors,0,link"`
	Message string `json:"message"`
}

// httpError is an error with a status code, rendered as ErrorResponse.
type httpError struct {
	status  int
	message string
	issues  []Issue
}

func (e *httpError) Error() string {
	return e.message
}

func newError(status int, format string, args ...any) *httpError {
	return &httpError{status: status, message: fmt.Sprintf(format, args...)}
}

// validationError converts validation errors to a 400 error, prefixing
// issue paths with the request part (body, path, query).
func validationError(part string, err error) error {
	if err == nil {
		return nil
	}
	issues := collectIssues([]any{part}, err)
	if len(issues) == 0 {
		// internal errors of the validation library
		return err
	}
	return &httpError{status: http.StatusBadRequest, message: "Bad request", issues: issues}
}

func collectIssues(path []any, err error) []Issue {
	var errs validation.Errors
	if errors.As(err, &errs) {
		var issues []Issue
		for _, key := range slices.Sorted(maps.Keys(errs)) {
			var segment any = key
			if index, convErr := strconv.Atoi(key); convErr == nil {
				segment = index
			}
			issues = append(issues, collectIssues(append(slices.Clone(path), segment), errs[key])...)
		}
		return issues
	}
	var validationErr validation.Error
	if errors.As(err, &validationErr) {
		return []Issue{{Code: validationErr.Code(), Path: path, Message: validationErr.Error()}}
	}
	return nil
}

// decodeError converts JSON decoding errors of the request body to a 400 error.
func decodeError(err error) error {
	var maxBytesErr *http.MaxBytesError
	if errors.As(err, &maxBytesErr) {
		return newError(http.StatusRequestEntityTooLarge, "Request body is too large")
	}
	path := []any{"body"}
	code := "invalid_json"
	var typeErr *json.UnmarshalTypeError
	if errors.As(err, &typeErr) {
		code = "invalid_type"
		if typeErr.Field != "" {
			for segment := range strings.SplitSeq(typeErr.Field, ".") {
				path = append(path, segment)
			}
		}
	}
	return &httpError{
		status:  http.StatusBadRequest,
		message: "Bad request",
		issues:  []Issue{{Code: code, Path: path, Message: err.Error()}},
	}
}

func writeError(w http.ResponseWriter, r *http.Request, err error) {
	var httpErr *httpError
	switch {
	case errors.As(err, &httpErr):
	case errors.Is(err, store.ErrNotFound):
		httpErr = newError(http.StatusNotFound, "Not found")
	case errors.Is(err, store.ErrDuplicate):
		httpErr = newError(http.StatusConflict, "%s", err)
	default:
		reqlog.From(r.Context()).Error("request failed", "err", err)
		httpErr = newError(http.StatusInternalServerError, "Internal Server Error")
	}

	response := ErrorResponse{Status: httpErr.status, Message: httpErr.message}
	if httpErr.issues != nil {
		writeJSON(w, httpErr.status, ValidationErrorResponse{ErrorResponse: response, Error: ValidationDetails{httpErr.issues}})
		return
	}
	writeJSON(w, httpErr.status, response)
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	// headers are already sent, nothing to do on error
	_ = json.NewEncoder(w).Encode(body)
}
