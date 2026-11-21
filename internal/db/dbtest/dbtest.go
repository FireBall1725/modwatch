// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// Package dbtest gives tests a migrated Postgres schema of their own.
package dbtest

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"net/url"
	"os"
	"testing"

	"github.com/fireball1725/modwatch/internal/db"
)

// EnvURL names the variable that holds the URL of a Postgres database the tests may create schemas in.
const EnvURL = "MODWATCH_TEST_DATABASE_URL"

// Open returns a connection to a fresh, migrated schema that is dropped when the test ends.
// Tests skip when EnvURL is unset, so `go test ./...` still passes on a machine with no database;
// CI sets it, so nothing is skipped there.
func Open(t testing.TB) *sql.DB {
	t.Helper()
	base := os.Getenv(EnvURL)
	if base == "" {
		t.Skipf("%s is not set; point it at a Postgres database to run the database tests", EnvURL)
	}
	ctx := context.Background()

	var b [6]byte
	if _, err := rand.Read(b[:]); err != nil {
		t.Fatal(err)
	}
	schema := "t_" + hex.EncodeToString(b[:])

	admin, err := sql.Open("pgx", base)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := admin.ExecContext(ctx, `CREATE SCHEMA `+schema); err != nil {
		_ = admin.Close()
		t.Fatalf("creating schema: %v", err)
	}

	u, err := url.Parse(base)
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	q.Set("search_path", schema)
	u.RawQuery = q.Encode()

	conn, err := db.Open(ctx, u.String())
	if err != nil {
		_, _ = admin.ExecContext(ctx, `DROP SCHEMA `+schema+` CASCADE`)
		_ = admin.Close()
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = conn.Close()
		_, _ = admin.ExecContext(context.Background(), `DROP SCHEMA `+schema+` CASCADE`)
		_ = admin.Close()
	})
	return conn
}
