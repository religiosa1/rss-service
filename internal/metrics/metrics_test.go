package metrics

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/prometheus/client_golang/prometheus/testutil"
)

func TestHandlerCountsPanicAs500(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /panic/{id}", func(http.ResponseWriter, *http.Request) { panic("boom") })

	func() {
		defer func() { _ = recover() }()
		Handler(mux).ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/panic/1", nil))
	}()

	if got := testutil.ToFloat64(requestsTotal.WithLabelValues("GET", "500", "false", "/panic/{id}")); got != 1 {
		t.Errorf("panicked requests counted = %v, want 1", got)
	}
}
