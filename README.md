# RSS feed microservice

Nodejs microservice for providing RSS feeds to somme other websites or services,
that don't have it.

It exposes API endpoint to manage your feeds and feed entry items, storing them
in a libsql database, automatically archiving old entries and removing old
archived ones (keeps 100 non-archived and 200 archived entries per feed).

Uses [feed](https://github.com/jpmonette/feed) library for the actual
rss generation.

Provides optional OpenAPI/Scalar docs, Prometheus metrics, modifications and 
error logging through pino, as well as informative validation error responses,
so it's easier for your to setup your scrappers/clients.

The initial reason behind it -- to provide feeds for some websites, scraping
them with some automation flow (n8n, python scripts, etc.) and posting the
result to this service, so I can access the feed through a reader, without
manually checking their websites. 

In my particular use-case, I'm consuming service output with 
[miniflux](https://miniflux.app/) to sync read status across multiple devices.

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
- GET /feed/:feedSlug - Get AtomV1 feed XML
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
- GET /metrics - Prometheus metrics (RED) (provided by [@hono/prometheus](https://www.npmjs.com/package/@hono/prometheus))

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
[[./env.d.ts]] to see list of supported environment variables.

## License

rss-service is MIT licensed.
