// rss-service is a microservice for providing RSS feeds.
//
//	@title						rss-service
//	@description				Microservice for providing RSS feeds
//	@BasePath					/
//	@securityDefinitions.apikey	ApiKeyAuth
//	@in							header
//	@name						X-API-Key
package main

//go:generate go tool swag init --parseInternal --outputTypes go,json --output internal/docs --generalInfo main.go
// swag doesn't allow "!" in @Router paths, so the "!all" routes are annotated as "__all"
// (-i.bak works with both GNU and BSD sed)
//go:generate sh -c "sed -i.bak 's|/items/__all|/items/!all|' internal/docs/docs.go internal/docs/swagger.json && rm internal/docs/*.bak"

import (
	"cmp"
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/religiosa1/rss-service/internal/api"
	"github.com/religiosa1/rss-service/internal/metrics"
	"github.com/religiosa1/rss-service/internal/reqlog"
	"github.com/religiosa1/rss-service/internal/store"
	"github.com/religiosa1/rss-service/internal/version"
)

type config struct {
	ListenAddr        string
	DBPath            string
	SkipMigrations    bool
	AllowNoAPIKey     bool
	DisableOpenAPI    bool
	DisableScalar     bool
	DisablePrometheus bool
	API               api.Config
	Log               logConfig
}

// Exit codes by error class. Explicit values, as they're a contract with
// whatever supervises the process.
const (
	// ExitCodeRun is an unclassified runtime failure.
	ExitCodeRun = 1
	// ExitCodeFlag is invalid command line usage, same as the flag package
	// exits with on unknown flags.
	ExitCodeFlag = 2
	// ExitCodeConfig is invalid env configuration, including logging setup.
	ExitCodeConfig = 3
	// ExitCodeDB is failure to open the database or apply migrations.
	ExitCodeDB = 4
	// ExitCodeServer is failure to listen or to shut the server down gracefully.
	ExitCodeServer = 5
)

// exitError assigns an exit code to the error returned from run.
type exitError struct {
	code int
	err  error
}

func (e *exitError) Error() string { return e.err.Error() }
func (e *exitError) Unwrap() error { return e.err }

func withExitCode(code int, err error) error {
	if err == nil {
		return nil
	}
	return &exitError{code: code, err: err}
}

func main() {
	var showVersion bool
	flag.BoolVar(&showVersion, "version", false, "show version information and exit")
	flag.BoolVar(&showVersion, "v", false, "shorthand for -version")
	flag.Parse()
	if showVersion {
		fmt.Println(version.String())
		return
	}

	if flag.NArg() > 0 {
		fmt.Fprintf(os.Stderr, "error: unexpected arguments: %v\n", flag.Args())
		flag.Usage()
		os.Exit(ExitCodeFlag)
	}

	if err := run(); err != nil {
		code := ExitCodeRun
		if exitErr, ok := errors.AsType[*exitError](err); ok {
			code = exitErr.code
		}
		slog.Error("fatal error", "err", err, "exitCode", code)
		os.Exit(code)
	}
}

func run() error {
	cfg, err := loadConfig()
	if err != nil {
		return withExitCode(ExitCodeConfig, fmt.Errorf("config error: %w", err))
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	logger, shutdownLogger, err := setupLogger(ctx, cfg.Log, os.Stdout)
	if err != nil {
		return withExitCode(ExitCodeConfig, err)
	}
	defer func() {
		// flushing pending OTEL logs, even if ctx is already canceled, but not
		// hanging on an unreachable collector
		flushCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		if err := shutdownLogger(flushCtx); err != nil {
			slog.Error("error flushing logs", "err", err)
		}
	}()
	slog.SetDefault(logger)

	start := time.Now()
	db, err := store.Open(cfg.DBPath, store.Options{SkipMigrations: cfg.SkipMigrations})
	if err != nil {
		return withExitCode(ExitCodeDB, err)
	}
	defer func() {
		if err := db.Close(); err != nil {
			slog.Error("error closing the db", "err", err)
		}
	}()
	slog.Info("database opened", "path", cfg.DBPath, "skipMigrations", cfg.SkipMigrations, "duration", time.Since(start))

	if cfg.API.APIKey == "" {
		slog.Warn("API_KEY is not set, modification endpoints are open to anyone")
	}
	if cfg.API.PublicURL == "" {
		slog.Warn("PUBLIC_URL is not set, feed links are relative")
	}

	mux := http.NewServeMux()
	api.New(db, cfg.API).Register(mux)
	if !cfg.DisableOpenAPI {
		registerDocs(mux, !cfg.DisableScalar)
	}
	var handler http.Handler = mux
	if !cfg.DisablePrometheus {
		mux.Handle("GET /metrics", promhttp.Handler())
		handler = metrics.Handler(mux)
	}

	server := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           reqlog.Handler(logger, handler),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       time.Minute,
		WriteTimeout:      time.Minute,
		IdleTimeout:       2 * time.Minute,
	}

	serveErr := make(chan error, 1)
	go func() {
		slog.Info("RSS server is running", "addr", "http://"+cfg.ListenAddr+"/", "version", version.String())
		if !cfg.DisableOpenAPI && !cfg.DisableScalar {
			slog.Info("Scalar/OpenAPI docs are available", "addr", "http://"+cfg.ListenAddr+"/scalar")
		}
		serveErr <- server.ListenAndServe()
	}()

	select {
	case err := <-serveErr:
		return withExitCode(ExitCodeServer, err)
	case <-ctx.Done():
	}
	slog.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return withExitCode(ExitCodeServer, server.Shutdown(shutdownCtx))
}

func loadConfig() (config, error) {
	listenAddr := net.JoinHostPort(
		cmp.Or(os.Getenv("HOST"), "localhost"),
		cmp.Or(os.Getenv("PORT"), "3000"),
	)
	cfg := config{
		ListenAddr: listenAddr,
		DBPath:     cmp.Or(os.Getenv("DB_FILE_NAME"), "./data.db"),
		API: api.Config{
			APIKey:    os.Getenv("API_KEY"),
			PublicURL: os.Getenv("PUBLIC_URL"),
			Generator: cmp.Or(os.Getenv("RSS_GENERATOR"), serviceName),
		},
		Log: logConfig{
			Format: os.Getenv("LOG_FORMAT"),
			OTEL:   otelLogsEnabled(),
		},
	}
	var errs []error
	for name, dest := range map[string]*bool{
		"DB_SKIP_MIGRATIONS": &cfg.SkipMigrations,
		"ALLOW_NO_API_KEY":   &cfg.AllowNoAPIKey,
		"DISABLE_OPEN_API":   &cfg.DisableOpenAPI,
		"DISABLE_SCALAR":     &cfg.DisableScalar,
		"DISABLE_PROMETHEUS": &cfg.DisablePrometheus,
	} {
		if value := os.Getenv(name); value != "" {
			parsed, err := strconv.ParseBool(value)
			if err != nil {
				errs = append(errs, fmt.Errorf("invalid %s: %w", name, err))
			}
			*dest = parsed
		}
	}
	if cfg.API.APIKey == "" && !cfg.AllowNoAPIKey {
		errs = append(errs, errors.New("API_KEY is not set; set ALLOW_NO_API_KEY=true to run with unauthorized modification endpoints"))
	}
	if err := cfg.Log.Level.UnmarshalText([]byte(cmp.Or(os.Getenv("LOG_LEVEL"), "info"))); err != nil {
		errs = append(errs, fmt.Errorf("invalid LOG_LEVEL: %w", err))
	}
	return cfg, errors.Join(errs...)
}
