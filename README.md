# RSS feed microservice

Nodejs microservice for providing RSS feeds to somme other websites or services, that
don't have it.

The initial reason behind it -- to provide feeds for some websites, scraping
them with n8n flow and posting the result to this service, so I can access the
feed through a reader, without manually checking their websites.

## Installation and launch.

Requires node v22.11 or higher, as it uses direct typescript execution.

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
