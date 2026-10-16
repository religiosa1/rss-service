package main

import (
	"net/http"

	"github.com/religiosa1/rss-service/internal/docs"
)

// scalarPage is the Scalar web-UI to see and test the API.
const scalarPage = `<!doctype html>
<html>
<head>
	<title>rss-service API Reference</title>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
	<div id="app"></div>
	<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
	<script>
		Scalar.createApiReference('#app', { url: '/openapi', hideModels: true })
	</script>
</body>
</html>`

// registerDocs adds the generated OpenAPI (swagger 2.0) spec route and,
// optionally, the Scalar UI.
func registerDocs(mux *http.ServeMux, withScalar bool) {
	spec := []byte(docs.SwaggerInfo.ReadDoc())
	mux.HandleFunc("GET /openapi", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(spec)
	})
	if withScalar {
		mux.HandleFunc("GET /scalar", func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write([]byte(scalarPage))
		})
	}
}
