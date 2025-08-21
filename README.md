# RSS feed microservice

Nodejs microservice for providing RSS feeds to some other websites or services 
or websites, that don't have it.

Provides:
- It exposes REST API endpoints to manage your feeds and feed entry items;
- Exposes the RSS Feed endpoint itself in rss2.0, atom1.0, json-feed1.0 formats;
- Stores them in a libsql database, automatically archiving old entries and 
  and removing archived ones as needed (keeps 100 non-archived and 200 
  archived entries per feed), managing schema and migration with 
  [Drizzle](https://orm.drizzle.team/);
- Authorizes your modification endpoints with X-API-KEY header.
- Fully validates all received payloads, providing informative and consistent 
  validation error responses so for an easy setup of your scrappers/clients.
- Optional OpenAPI/Scalar docs;
- Prometheus RED metrics (via [@hono/prometheus](https://www.npmjs.com/package/@hono/prometheus));
- Logs modifications and errors through pino with an optional OpenTelemetry 
  support;

The initial reason behind it -- to provide feeds for some websites, scraping
them with some automation flow (n8n, python scripts, etc.) and posting the
result to this service, so I can access the feed through a reader, without
manually checking their websites. 

In my particular use-case, I'm consuming service output with 
[miniflux](https://miniflux.app/) to sync read status across multiple devices.

Uses [feed](https://github.com/jpmonette/feed) library for the actual
rss generation.

Requires node v22.18 or higher, as it uses direct typescript execution.

## The intended usage flow:

Create the intended feed with `POST /feed` endpoint (see openapi docs).

1. Gather some content you want to have an RSS field (gather posts from your
   existing blog, ethically scrap some other 3d party blog with a python script,
   etc.). This can be run on schedule.

2. Call `PUT /feed/:feedSlug/items`, providing everything you gathered in the
   body.
3. Subscribe to the RSS feed in `GET /feed/:feedSlug`

## API Endpoints

All modification endpoints require a API-KEY authentication through
`X-API-HEADER` supplied in the env variables.

#### Feed Management (/feed):

- GET /feed - List all feeds
- GET /feed/:feedSlug - Get RssV2/AtomV1/JsonV1 feed, based on the [type](https://religiosa1.github.io/rss-service/#tag/feed/get/feed/{feedSlug}.query.type) param.
- POST /feed - Create feed (auth required)
- PATCH /feed/:feedSlug - Update feed (auth required)
- DELETE /feed/:feedSlug - Delete feed (auth required)

#### Feed Items:

- GET /feed/:feedSlug/items/ - List feed items
- GET /feed/:feedSlug/items/!all - List all items including archived
- POST /feed/:feedSlug/items/ - Create item (auth required)
- PUT /feed/:feedSlug/items/ - Upsert multiple items (auth required)
- PATCH /feed/:feedSlug/items/:feedItemSlug - Update item (auth required)
- DELETE /feed/:feedSlug/items/:feedItemSlug - Delete item (auth required)
- DELETE /feed/:feedSlug/!all - Delete all items in a feed (auth required)

#### Documentation endpoints (can be disabled with env config):

- GET /scalar - Scalar web-ui documentation
- GET /openapi - OpenAPI schema
- GET / - healthcheck, just returns empty 200 response
- GET /metrics - Prometheus metrics (RED)

## OTEL and metrics and OpenAPI schema/Scalar

OpenTelemetry logging transport can be enabled by providing either 
`OTEL_EXPORTER_OTLP_ENDPOINT` or `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` in 
production mode (aka with NODE_ENV=production)

```sh
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 npm run start
```

Prometheus metrics ar enabled by default and can be pulled from `/metrics` 
endpoint. It can be disabled with `DISABLE_PROMETHEUS` env:

```sh
DISABLE_PROMETHEUS=true npm run start
```

OpenAPI schema can be disabled by providing:
```sh
DISABLE_OPEN_API=true npm run start # also disables Scalar OpenAPI UI
```

If you want just to disable Scalar UI, keeping the OpenAPI json:

```sh
DISABLE_SCALAR=true npm run start
```

## Installation and launch.

<!--
TODO: uncomment that, once the docker image is pushed to the ghcr.io by the pipeline
### Running with docker

The easiest way to launch the service is to run the provided docker image:

```sh
docker volume create rss_service_data

docker run -it --rm \
  --name rss-service \
  -p 3000:3000 \
  -e API_KEY=YOUR_API_KEY_HERE \
  -e PUBLIC_URL=http://example.com/ \
  -v rss_service_data:/app/data \
  ghcr.io/religiosa1/rss-service
```

You can build your own image using the provided Dockerfile:

```sh
docker build -t rss-service .
``` -->

### For local development and direct node deployment:

Clone the latest version of the service:

```sh
npx degit https://github.com/religiosa1/rss-service
```

```sh
npm install # to install deps
npm run start # to run the service
```

Project should be accessible through localhost:3000 at this point, and you may
want to add a reverse proxy if you self-host it.

### Running in alternative runtimes/cloud

The main mode of operation is as a node service, but service should be
operational in alternative js/ts runtimes with some modifications.

[[./src/main.ts]] provides a default export without a node serve wrapper and
should be suitable for running it in other runtimes.

For bun you can run this file directly:

```sh
bun run --hot src/index.ts # dev mode
NODE_ENV=production bun run src/main.ts # prod
```

For deno you need to modify index.ts replacing

```ts
serve(app);
```

with

```ts
Deno.serve(app.fetch);
```

For launching in service in a cloud, there's a question of database, as it's
stored in the filesystem by default. As it's a Turso libsql database, you can
potentially use http connection instead, supplying the authToken.

Please refer to
[Drizzle documentation](https://orm.drizzle.team/docs/get-started/d1-new)
and
[Hono documentation](https://hono.dev/docs/getting-started/cloudflare-workers).

## Configuration

All configuration is provided through the env variables. Please refer to the
[./env.d.ts](./env.d.ts) to see list of supported environment variables.

## License

rss-service is MIT licensed.
