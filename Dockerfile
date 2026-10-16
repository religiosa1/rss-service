FROM golang:1.27-alpine AS build
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
# .git is not in the build context, so the version is passed explicitly:
# docker build --build-arg VERSION=$(git describe --tags --always --dirty) .
ARG VERSION=unknown
RUN CGO_ENABLED=0 go build -trimpath -buildvcs=false \
	-ldflags "-s -w -X github.com/religiosa1/rss-service/internal/version.override=${VERSION}" \
	-o /out/rss-service . \
	&& mkdir -p /out/data

FROM gcr.io/distroless/static-debian12

# Secrets should be mounted or provided at runtime:
# - API_KEY (required)

# Required: PUBLIC_URL should be provided at runtime
ENV PUBLIC_URL=""
ENV HOST=0.0.0.0
ENV PORT=3000
ENV LOG_FORMAT=json
# Same location and owner (uid of "node" user) as in the node.js image,
# so existing volumes keep working
ENV DB_FILE_NAME="/app/data/rss.db"

COPY --from=build --chown=1000:1000 /out/data /app/data
COPY --from=build /out/rss-service /app/rss-service
USER 1000:1000
WORKDIR /app

EXPOSE 3000

ENTRYPOINT ["/app/rss-service"]
