// Package reqlog gives each request an ID and a logger tagged with it, so
// everything logged while handling a request can be correlated.
package reqlog

import (
	"context"
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"
	"uuid"

	"github.com/religiosa1/rss-service/internal/httpstatus"
)

type loggerKey struct{}

// Handler takes the request ID from the X-Request-ID header (set by the
// reverse proxy) or generates one (UUIDv7, so IDs sort by time), returns it
// in X-Request-ID, puts a tagged logger into the request context, logs the
// completed request and recovers panics.
func Handler(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID")
		if !validID(id) {
			id = uuid.NewV7().String()
		}
		logger := logger.With("request_id", id, "method", r.Method, "path", r.URL.Path)
		w.Header().Set("X-Request-ID", id)
		rw := httpstatus.Wrap(w)
		start := time.Now()

		serve(rw, r.WithContext(context.WithValue(r.Context(), loggerKey{}, logger)), next, logger)

		level := slog.LevelInfo
		if rw.Status >= 500 {
			level = slog.LevelError
		}
		logger.Log(r.Context(), level, "request completed",
			"status", rw.Status, "duration", time.Since(start))
	})
}

// validID accepts IDs like nginx's $request_id or a UUID; anything else is
// replaced, so a client can't put arbitrary text into the logs.
func validID(id string) bool {
	if id == "" || len(id) > 64 {
		return false
	}
	for _, c := range id {
		switch {
		case 'a' <= c && c <= 'z', 'A' <= c && c <= 'Z', '0' <= c && c <= '9', c == '-', c == '_', c == '.':
		default:
			return false
		}
	}
	return true
}

// serve runs next, logging a panic with the request's logger instead of
// leaving it to net/http, which logs it without the request ID.
func serve(rw *httpstatus.Writer, r *http.Request, next http.Handler, logger *slog.Logger) {
	defer func() {
		v := recover()
		if v == nil {
			return
		}
		if v == http.ErrAbortHandler {
			panic(v)
		}
		logger.Error("panic", "panic", v, "stack", string(debug.Stack()))
		if rw.WroteHeader {
			// Too late for an error page, abort the response instead.
			panic(http.ErrAbortHandler)
		}
		rw.Header().Set("Content-Type", "application/json")
		rw.WriteHeader(http.StatusInternalServerError)
		if _, err := rw.Write([]byte(`{"success":false,"status":500,"message":"Internal Server Error"}`)); err != nil {
			logger.Warn("error writing response", "err", err)
		}
	}()
	next.ServeHTTP(rw, r)
}

// From returns the request's logger, or the default one outside a request.
func From(ctx context.Context) *slog.Logger {
	if logger, ok := ctx.Value(loggerKey{}).(*slog.Logger); ok {
		return logger
	}
	return slog.Default()
}
