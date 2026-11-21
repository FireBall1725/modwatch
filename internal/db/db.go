// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// Package db opens the database, Postgres or SQLite, and applies the migrations for it.
package db

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/golang-migrate/migrate/v4"
	migratepgx "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	migratesqlite "github.com/golang-migrate/migrate/v4/database/sqlite"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	_ "github.com/jackc/pgx/v5/stdlib" // registers the "pgx" database/sql driver
	_ "modernc.org/sqlite"             // registers the "sqlite" database/sql driver, pure Go
)

// Each database has its own folder, because the SQL differs. A schema change needs a file in both, with the same
// number; a test checks that they end at the same version.
//
//go:embed migrations/postgres/*.sql migrations/sqlite/*.sql
var migrations embed.FS

// Open connects to the database the URL names and applies any pending migrations. A URL starting postgres:// or
// postgresql:// is Postgres (the CloudNativePG operator hands the app one in the <cluster>-app secret, key "uri").
// One starting sqlite: is a SQLite file: sqlite:///data/modwatch.db for an absolute path, sqlite:modwatch.db for a
// relative one.
func Open(ctx context.Context, rawURL string) (*sql.DB, error) {
	d, err := DialectOfURL(rawURL)
	if err != nil {
		return nil, err
	}
	var conn *sql.DB
	switch d {
	case SQLite:
		conn, err = openSQLite(rawURL)
	default:
		conn, err = sql.Open("pgx", rawURL)
		if err == nil {
			conn.SetMaxOpenConns(10)
			conn.SetConnMaxLifetime(30 * time.Minute)
		}
	}
	if err != nil {
		return nil, fmt.Errorf("opening database: %w", err)
	}
	// A Postgres server can start a few seconds after the pod, so retry before giving up.
	if err := ping(ctx, conn); err != nil {
		_ = conn.Close()
		return nil, err
	}
	if err := migrateUp(conn, d); err != nil {
		_ = conn.Close()
		return nil, err
	}
	return conn, nil
}

// sqlitePath is the file a sqlite: URL names.
func sqlitePath(rawURL string) (string, error) {
	p := strings.TrimPrefix(rawURL, "sqlite:")
	p = strings.TrimPrefix(p, "//") // sqlite:///abs/path leaves /abs/path, sqlite://rel leaves rel
	if i := strings.IndexByte(p, '?'); i >= 0 {
		p = p[:i]
	}
	if p == "" {
		return "", errors.New("the sqlite URL needs a file, such as sqlite:///data/modwatch.db")
	}
	return p, nil
}

// openSQLite opens the file, creating its folder first. WAL lets the dashboard read while a poll writes, and the
// busy timeout makes a second writer wait instead of failing. Transactions take the write lock when they begin, so
// a poll can't fail halfway on a lock it needed later.
func openSQLite(rawURL string) (*sql.DB, error) {
	path, err := sqlitePath(rawURL)
	if err != nil {
		return nil, err
	}
	if dir := filepath.Dir(path); dir != "." {
		if err := os.MkdirAll(dir, 0o750); err != nil {
			return nil, fmt.Errorf("creating %s: %w", dir, err)
		}
	}
	q := url.Values{}
	for _, p := range []string{"foreign_keys(1)", "busy_timeout(5000)", "journal_mode(WAL)", "synchronous(NORMAL)"} {
		q.Add("_pragma", p)
	}
	q.Set("_txlock", "immediate")
	conn, err := sql.Open("sqlite", "file:"+path+"?"+q.Encode())
	if err != nil {
		return nil, err
	}
	conn.SetMaxOpenConns(4)
	return conn, nil
}

func ping(ctx context.Context, conn *sql.DB) error {
	var err error
	for attempt := 0; attempt < 15; attempt++ {
		pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		err = conn.PingContext(pingCtx)
		cancel()
		if err == nil {
			return nil
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("pinging database: %w", ctx.Err())
		case <-time.After(2 * time.Second):
		}
	}
	return fmt.Errorf("pinging database: %w", err)
}

func newMigrator(conn *sql.DB, d Dialect) (*migrate.Migrate, error) {
	src, err := iofs.New(migrations, "migrations/"+d.folder())
	if err != nil {
		return nil, err
	}
	if d == SQLite {
		driver, err := migratesqlite.WithInstance(conn, &migratesqlite.Config{})
		if err != nil {
			return nil, err
		}
		return migrate.NewWithInstance("iofs", src, "sqlite", driver)
	}
	driver, err := migratepgx.WithInstance(conn, &migratepgx.Config{})
	if err != nil {
		return nil, err
	}
	return migrate.NewWithInstance("iofs", src, "pgx5", driver)
}

func migrateUp(conn *sql.DB, d Dialect) error {
	m, err := newMigrator(conn, d)
	if err != nil {
		return err
	}
	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("migrate: %w", err)
	}
	return nil
}
