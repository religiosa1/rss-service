FROM node:24-alpine AS base
WORKDIR /app


# Secrets should be mounted or provided at runtime:
# - API_KEY (required)
# - DB_AUTH_TOKEN (if using Turso HTTP connection)

# Required: PUBLIC_URL should be provided at runtime
ENV PUBLIC_URL=""

COPY . .
RUN npm ci --only=production

# Create data directory
RUN mkdir -p /app/data && chown node:node /app/data

USER node
# Default database location
ENV DB_FILE_NAME="/app/data/rss.db"
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "./index.ts"]