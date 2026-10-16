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
		rw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		start := time.Now()
		mux.ServeHTTP(rw, r)

		// ServeMux sets the pattern on the request it was given
		_, route, _ := strings.Cut(r.Pattern, " ")
		values := []string{
			r.Method,
			strconv.Itoa(rw.status),
			strconv.FormatBool(rw.status >= 200 && rw.status < 300),
			route,
		}
		requestDuration.WithLabelValues(values...).Observe(time.Since(start).Seconds())
		requestsTotal.WithLabelValues(values...).Inc()
	})
}

type statusWriter struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

func (w *statusWriter) WriteHeader(code int) {
	if !w.wroteHeader {
		w.status = code
		w.wroteHeader = true
	}
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusWriter) Write(b []byte) (int, error) {
	w.wroteHeader = true
	return w.ResponseWriter.Write(b)
}

func (w *statusWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}
