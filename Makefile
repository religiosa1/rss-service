BINARY := rss-service
IMAGE ?= rss-service
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo unknown)

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  %-16s %s\n", $$1, $$2}'

.PHONY: build
build: ## Build the binary (version is taken from VCS info by go build)
	go build -trimpath -o $(BINARY) .

.PHONY: run
run: ## Run the service locally
	go run .

.PHONY: test
test: ## Run tests with the race detector
	go test -race ./...

.PHONY: lint
lint: ## Run go vet and golangci-lint
	go vet ./...
	golangci-lint run ./...

.PHONY: generate
generate: ## Regenerate OpenAPI docs in internal/docs
	go generate ./...

.PHONY: check-generate
check-generate: generate ## Fail if generated OpenAPI docs are out of date
	git diff --exit-code internal/docs

.PHONY: check
check: check-generate lint test ## Run all CI checks

.PHONY: docker
docker: ## Build the docker image
	docker build --build-arg VERSION=$(VERSION) -t $(IMAGE) .

.PHONY: clean
clean: ## Remove build artifacts
	rm -f $(BINARY)
