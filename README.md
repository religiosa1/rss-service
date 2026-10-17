# RSS feed microservice

Go microservice that provides RSS feeds for websites or services that don't
have them.

Provides:
- REST API endpoints to manage your feeds and feed entry items;
- The feed endpoint itself in RSS 2.0, Atom 1.0 and JSON Feed 1.1 formats;
- Storage in a sqlite database, automatically archiving old entries and
  removing archived ones as needed (keeps 100 non-archived and 200
  archived entries per feed); items older than the whole archive are rejected
  with 422;
- Authorization of modification endpoints with the `X-API-Key` header;
- Full validation of all received payloads, with informative and consistent
  validation error responses, for an easy setup of your scrapers/clients;
- Optional OpenAPI/Scalar docs;
- Prometheus RED metrics;
- Structured logs of modifications and errors through slog, with optional
  OpenTelemetry export.

The initial reason behind it was to provide feeds for some websites by
scraping them with an automation flow (n8n, python scripts, etc.) and posting
the result to this service, so I can access the feed through a reader, without
manually checking their websites.

In my particular use-case, I'm consuming service output with
[miniflux](https://miniflux.app/) to sync read status across multiple devices.

## The intended usage flow

Create the feed with the `POST /feed` endpoint (see the OpenAPI docs).

1. Gather some content you want to have an RSS feed for (gather posts from your
   existing blog, ethically scrape some other 3rd party blog with a python
   script, etc.). This can be run on schedule.
2. Call `PUT /feed/:feedSlug/items`, providing everything you gathered in the
   body.
3. Subscribe to the RSS feed at `GET /feed/:feedSlug`.

## API Endpoints

All modification endpoints require API key authentication through the
`X-API-Key` header, matching the `API_KEY` env variable.

#### Feed Management (/feed):

- GET /feed - List all feeds
- GET /feed/:feedSlug - Get RSS 2.0/Atom 1.0/JSON Feed 1.1 feed, based on the [type](https://religiosa1.github.io/rss-service/#tag/feed/get/feed/{feedSlug}.query.type) param.
- POST /feed - Create feed (auth required)
- PATCH /feed/:feedSlug - Update feed (auth required)
- DELETE /feed/:feedSlug - Delete feed (auth required)

#### Feed Items:

- GET /feed/:feedSlug/items - List feed items
- GET /feed/:feedSlug/items/!all - List all items including archived
- POST /feed/:feedSlug/items - Create item (auth required)
- PUT /feed/:feedSlug/items - Upsert multiple items (auth required)
- PATCH /feed/:feedSlug/items/:feedItemSlug - Update item (auth required)
- DELETE /feed/:feedSlug/items/:feedItemSlug - Delete item (auth required)
- DELETE /feed/:feedSlug/items/!all - Delete all items in a feed (auth required)

#### Service endpoints (docs and metrics can be disabled with env config):

- GET /scalar - Scalar web-ui documentation
- GET /openapi - OpenAPI (Swagger 2.0) schema
- GET / - healthcheck, returns service name and version
- GET /metrics - Prometheus metrics (RED)

Validation errors are returned with status 400 and a list of issues, each with
a path to the invalid value:

```json
{
  "success": false,
  "status": 400,
  "message": "Bad request",
  "error": {
    "issues": [
      { "code": "invalid_url", "path": ["body", "authors", 0, "link"], "message": "must be a valid absolute URL" }
    ]
  }
}
```

## Configuration

All configuration is provided through env variables:

| Variable                           | Default         | Description                                                            |
| ---------------------------------- | --------------- | ---------------------------------------------------------------------- |
| `API_KEY`                          |                 | API key authorizing modification endpoints. Required, unless `ALLOW_NO_API_KEY` is set |
| `ALLOW_NO_API_KEY`                 | `false`         | Allow starting without `API_KEY`, leaving modification endpoints open! |
| `PUBLIC_URL`                       |                 | Public url of the service, for links in feeds                          |
| `HOST`                             | `localhost`     | Host/ip address to listen on                                           |
| `PORT`                             | `3000`          | TCP port to listen on                                                  |
| `DB_FILE_NAME`                     | `./data.db`     | Path to the sqlite database file (or a `file:` url)                    |
| `DB_SKIP_MIGRATIONS`               | `false`         | Don't apply DB migrations on startup                                   |
| `RSS_GENERATOR`                    | `rss-service`   | Value of the "generator" field of feeds                                |
| `DISABLE_OPEN_API`                 | `false`         | Disable both OpenAPI and Scalar documentation                          |
| `DISABLE_SCALAR`                   | `false`         | Disable Scalar documentation (OpenAPI schema stays on)                 |
| `DISABLE_PROMETHEUS`               | `false`         | Disable Prometheus metrics                                             |
| `LOG_FORMAT`                       | `text`          | `text` or `json`                                                       |
| `LOG_LEVEL`                        | `info`          | `debug`, `info`, `warn` or `error`                                     |
| `OTEL_EXPORTER_OTLP_ENDPOINT`      |                 | OTLP collector endpoint; if set, logs are also exported there          |
| `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` |                 | Logs-specific override of the OTLP endpoint                            |
| `OTEL_EXPORTER_OTLP_PROTOCOL`      | `http/protobuf` | `http/protobuf` or `grpc`; `OTEL_EXPORTER_OTLP_LOGS_PROTOCOL` overrides it for logs |

Boolean values accept `1`, `true`, `0`, `false` and so on. Other standard
`OTEL_*` variables (`OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES`,
`OTEL_EXPORTER_OTLP_HEADERS`, etc.) are supported as well.

### Exit codes

| Code | Meaning                                                   |
| ---- | --------------------------------------------------------- |
| `1`  | Unclassified runtime failure                              |
| `2`  | Invalid command line usage                                |
| `3`  | Invalid configuration (env variables, logging setup)      |
| `4`  | Failed to open the database or apply migrations           |
| `5`  | Failed to listen or to shut the server down gracefully    |

### OpenTelemetry

OpenTelemetry log export is enabled by providing either
`OTEL_EXPORTER_OTLP_ENDPOINT` or `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT`. Logs are
still written to stdout as well.

```sh
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 ./rss-service
```

[otel-collector-config.yaml](./otel-collector-config.yaml) is a test
collector config for logging verification.

## Installation and launch

### Running with docker

```sh
docker build --build-arg VERSION=$(git describe --tags --always --dirty) -t rss-service .

docker volume create rss_service_data

docker run -it --rm \
  --name rss-service \
  -p 3000:3000 \
  -e API_KEY=YOUR_API_KEY_HERE \
  -e PUBLIC_URL=http://example.com/ \
  -v rss_service_data:/app/data \
  rss-service
```

The database is stored in `/app/data/rss.db`, owned by uid 1000, the same as in
the node.js image, so existing volumes can be reused.

### Building from source

Requires Go 1.27 or higher.

```sh
CGO_ENABLED=0 go build -buildvcs=true -o rss-service .
./rss-service
```

The service is accessible at localhost:3000 at this point, and you may want to
add a reverse proxy if you self-host it.

`rss-service -version` prints the build version, which is also returned by
the healthcheck endpoint. Go stamps it from git automatically, so:

- build from a git checkout, with `git` installed, and build the package
  (`.`), not single files; `go run` never stamps it, showing `(devel)`;
- `-buildvcs=true` makes the build fail instead of silently omitting the
  version when it can't be stamped.

| Checkout state                         | Version                                 |
| -------------------------------------- | --------------------------------------- |
| HEAD exactly at tag `v0.1.0`           | `v0.1.0`                                |
| commits after the tag                  | `v0.1.1-0.<date>-<commit>`              |
| no tags                                | `v0.0.0-<date>-<commit>`                |
| uncommitted changes                    | any of the above with `+dirty`          |

Docker builds have no `.git` in the context, so the version is passed with
`--build-arg VERSION=...` and linked in with
`-ldflags "-X github.com/religiosa1/rss-service/internal/version.override=..."`.

### Migrating from the node.js version

The Go version works with the existing database as is. Schema migrations are
tracked with sqlite `PRAGMA user_version`; on the first launch the initial
migration is a no-op for an existing database, as its tables are already
there. The drizzle `__drizzle_migrations` table is left untouched.

Remote libsql/Turso databases (`libsql://`, `https://` in `DB_FILE_NAME` and
`DB_AUTH_TOKEN`) are not supported, only local files. `NODE_ENV` is replaced
with `LOG_FORMAT` and `LOG_LEVEL`.

Behavior changes:
- The service refuses to start without `API_KEY`, unless `ALLOW_NO_API_KEY=true`;
- Creating (POST) or upserting (PUT) items older than the whole feed archive
  returns 422 and changes nothing, instead of silently dropping them;
- Request bodies with trailing data after the JSON value are rejected with 400.

## Development

```sh
make test     # go test -race ./...
make generate # regenerates OpenAPI docs in internal/docs from swag annotations
make check    # everything CI runs: docs up to date, lint, tests
make help     # all targets
```

OpenAPI docs are generated with [swag](https://github.com/swaggo/swag) from
handler annotations in [internal/api](./internal/api).
[.swaggo](./.swaggo) maps types with custom JSON encoding to their schemas.

Feed rendering in [internal/feed](./internal/feed) follows the element mapping
of [jpmonette/feed](https://github.com/jpmonette/feed), used by the node.js
version, so readers see the same item ids, links and dates;
`internal/feed/testdata` has its reference output.

## License

rss-service is MIT licensed.
