// Package store is the sqlite persistence layer of feeds and feed items.
package store

import (
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"strings"

	"github.com/jmoiron/sqlx"
	"modernc.org/sqlite"
	sqlite3 "modernc.org/sqlite/lib"
)

var (
	ErrNotFound  = errors.New("record not found")
	ErrDuplicate = errors.New("duplicate record")
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

type DB struct {
	*sqlx.DB
}

// Options of the DB connection.
type Options struct {
	// SkipMigrations opens the DB as is, without applying pending migrations.
	SkipMigrations bool
}

// Open opens (creating if needed) the database file and applies pending migrations.
//
// path is either a file path or a "file:" URL, as accepted by the node.js
// version of the service in DB_FILE_NAME.
func Open(path string, opts Options) (*DB, error) {
	path, err := filePath(path)
	if err != nil {
		return nil, err
	}
	// _txlock=immediate: write transactions take the lock upfront, instead of
	// failing with SQLITE_BUSY when a read tx upgrades to a write.
	dsn := path + "?_journal_mode=WAL&_foreign_keys=1&_busy_timeout=5000&_synchronous=NORMAL&_txlock=immediate"
	db, err := sqlx.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("error opening the database: %w", err)
	}
	if opts.SkipMigrations {
		return &DB{db}, nil
	}
	migrations, err := loadMigrations()
	if err != nil {
		return nil, errors.Join(err, db.Close())
	}
	if err := NewMigrator(db).Migrate(migrations); err != nil {
		return nil, errors.Join(fmt.Errorf("error applying migrations: %w", err), db.Close())
	}
	return &DB{db}, nil
}

// filePath converts a "file:" URL to a plain path; remote libsql/Turso
// URLs aren't supported.
func filePath(pathOrURL string) (string, error) {
	scheme, rest, found := strings.Cut(pathOrURL, ":")
	if !found {
		return pathOrURL, nil
	}
	if scheme != "file" {
		return "", fmt.Errorf("unsupported database url scheme %q, only local files are supported", scheme)
	}
	// file:///abs/path, file://localhost/abs/path or file:relative/path
	rest = strings.TrimPrefix(rest, "//localhost")
	rest = strings.TrimPrefix(rest, "//")
	rest, _, _ = strings.Cut(rest, "?")
	return rest, nil
}

func loadMigrations() ([]string, error) {
	// fs.ReadDir returns entries sorted by filename, which is migration order.
	entries, err := fs.ReadDir(migrationsFS, "migrations")
	if err != nil {
		return nil, err
	}
	migrations := make([]string, 0, len(entries))
	for _, entry := range entries {
		content, err := fs.ReadFile(migrationsFS, "migrations/"+entry.Name())
		if err != nil {
			return nil, err
		}
		migrations = append(migrations, string(content))
	}
	return migrations, nil
}

// mapError converts known sqlite errors to the package ones.
func mapError(err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if sqliteErr, ok := errors.AsType[*sqlite.Error](err); ok && sqliteErr.Code() == sqlite3.SQLITE_CONSTRAINT_UNIQUE {
		return fmt.Errorf("%w: %w", ErrDuplicate, err)
	}
	return err
}
