// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// Package db opens the Postgres database and applies migrations.
package db

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"time"

	"github.com/golang-migrate/migrate/v4"
	migratepgx "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	_ "github.com/jackc/pgx/v5/stdlib" // registers the "pgx" database/sql driver
)

//go:embed migrations/*.sql
var migrations embed.FS

// Open connects to Postgres at url, waits until it answers, and applies any pending migrations.
// The CloudNativePG operator hands the app a URL in the <cluster>-app secret, key "uri".
func Open(ctx context.Context, url string) (*sql.DB, error) {
	conn, err := sql.Open("pgx", url)
	if err != nil {
		return nil, fmt.Errorf("opening database: %w", err)
	}
	conn.SetMaxOpenConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)

	// The database can start a few seconds after the pod, so retry before giving up.
	if err := ping(ctx, conn); err != nil {
		_ = conn.Close()
		return nil, err
	}
	if err := migrateUp(conn); err != nil {
		_ = conn.Close()
		return nil, err
	}
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

func newMigrator(conn *sql.DB) (*migrate.Migrate, error) {
	src, err := iofs.New(migrations, "migrations")
	if err != nil {
		return nil, err
	}
	driver, err := migratepgx.WithInstance(conn, &migratepgx.Config{})
	if err != nil {
		return nil, err
	}
	return migrate.NewWithInstance("iofs", src, "pgx5", driver)
}

func migrateUp(conn *sql.DB) error {
	m, err := newMigrator(conn)
	if err != nil {
		return err
	}
	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("migrate: %w", err)
	}
	return nil
}
