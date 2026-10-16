package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strings"

	"go.opentelemetry.io/contrib/bridges/otelslog"
	"go.opentelemetry.io/contrib/exporters/autoexport"
	"go.opentelemetry.io/otel/attribute"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	"go.opentelemetry.io/otel/sdk/resource"

	"github.com/religiosa1/rss-service/internal/version"
)

const serviceName = "rss-service"

type logConfig struct {
	// Format is either "text" or "json".
	Format string
	Level  slog.Level
	// OTEL enables log export via OpenTelemetry, configured with the standard
	// OTEL_* env variables.
	OTEL bool
}

// setupLogger creates the app logger. Returned shutdown flushes pending OTEL
// log records.
func setupLogger(ctx context.Context, cfg logConfig, out io.Writer) (*slog.Logger, func(context.Context) error, error) {
	opts := &slog.HandlerOptions{Level: cfg.Level}
	var handler slog.Handler
	switch strings.ToLower(cfg.Format) {
	case "", "text":
		handler = slog.NewTextHandler(out, opts)
	case "json":
		handler = slog.NewJSONHandler(out, opts)
	default:
		return nil, nil, fmt.Errorf("unknown LOG_FORMAT %q, expected text or json", cfg.Format)
	}

	shutdown := func(context.Context) error { return nil }
	if cfg.OTEL {
		exporter, err := autoexport.NewLogExporter(ctx)
		if err != nil {
			return nil, nil, fmt.Errorf("error creating OTEL log exporter: %w", err)
		}
		// env (OTEL_SERVICE_NAME, OTEL_RESOURCE_ATTRIBUTES) overrides the defaults
		res, err := resource.New(ctx,
			resource.WithAttributes(
				attribute.String("service.name", serviceName),
				attribute.String("service.version", version.String()),
			),
			resource.WithFromEnv(),
			resource.WithTelemetrySDK(),
		)
		if err != nil {
			return nil, nil, fmt.Errorf("error creating OTEL resource: %w", err)
		}
		provider := sdklog.NewLoggerProvider(
			sdklog.WithProcessor(sdklog.NewBatchProcessor(exporter)),
			sdklog.WithResource(res),
		)
		shutdown = provider.Shutdown
		otelHandler := otelslog.NewHandler(serviceName, otelslog.WithLoggerProvider(provider))
		handler = slog.NewMultiHandler(handler, &levelHandler{Handler: otelHandler, level: cfg.Level})
	}
	return slog.New(handler), shutdown, nil
}

// levelHandler filters records below level, as otelslog handler has no
// level option of its own.
type levelHandler struct {
	slog.Handler
	level slog.Leveler
}

func (h *levelHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return level >= h.level.Level() && h.Handler.Enabled(ctx, level)
}

func (h *levelHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &levelHandler{Handler: h.Handler.WithAttrs(attrs), level: h.level}
}

func (h *levelHandler) WithGroup(name string) slog.Handler {
	return &levelHandler{Handler: h.Handler.WithGroup(name), level: h.level}
}

func otelLogsEnabled() bool {
	return os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT") != "" || os.Getenv("OTEL_EXPORTER_OTLP_LOGS_ENDPOINT") != ""
}
