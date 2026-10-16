// Package metrics collects Prometheus RED metrics of HTTP requests, with the
// same names and labels as @hono/prometheus, used by the node.js version.
package metrics

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/religiosa1/rss-service/internal/httpstatus"
)

var labels = []string{"method", "status", "ok", "route"}

var (
	requestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name: "http_request_duration_seconds",
		Help: "Duration of HTTP requests in seconds",
		// OpenTelemetry recommendation for http request duration
		Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10},
	}, labels)
	requestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "http_requests_total",
		Help: "Total number of HTTP requests",
	}, labels)
)

// Handler records metrics of requests served by mux, labelled by the matched
// route pattern, so path params don't blow up label cardinality.
func Handler(mux *http.ServeMux) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rw := httpstatus.Wrap(w)
		start := time.Now()
		completed := false
		// Deferred without recover, so a panic still reaches reqlog with its
		// original stack, while the request is counted as the 500 reqlog responds with.
		defer func() {
			status := rw.Status
			if !completed && !rw.WroteHeader {
				status = http.StatusInternalServerError
			}
			// ServeMux sets the pattern on the request it was given
			_, route, _ := strings.Cut(r.Pattern, " ")
			values := []string{
				r.Method,
				strconv.Itoa(status),
				strconv.FormatBool(status >= 200 && status < 300),
				route,
			}
			requestDuration.WithLabelValues(values...).Observe(time.Since(start).Seconds())
			requestsTotal.WithLabelValues(values...).Inc()
		}()
		mux.ServeHTTP(rw, r)
		completed = true
	})
}
