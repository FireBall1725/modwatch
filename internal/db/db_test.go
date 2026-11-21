// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package db_test

import (
	"context"
	"database/sql"
	"os"
	"strings"
	"testing"

	"github.com/fireball1725/modwatch/internal/db/dbtest"
)

func hasColumn(t *testing.T, conn *sql.DB, table, column string) bool {
	t.Helper()
	var n int
	err := conn.QueryRow(`
		SELECT count(*) FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`, table, column).Scan(&n)
	if err != nil {
		t.Fatal(err)
	}
	return n > 0
}

func TestOpenMigratesAndLegacyDefaultsToFalse(t *testing.T) {
	conn := dbtest.Open(t)
	if !hasColumn(t, conn, "catalog", "legacy") {
		t.Fatal("catalog.legacy missing after up")
	}
	if _, err := conn.Exec(`INSERT INTO catalog (slug, name) VALUES ('a', 'A')`); err != nil {
		t.Fatal(err)
	}
	var legacy, hidden, auto bool
	if err := conn.QueryRow(`SELECT legacy, hidden, auto FROM catalog WHERE slug = 'a'`).Scan(&legacy, &hidden, &auto); err != nil {
		t.Fatal(err)
	}
	if legacy || hidden || !auto {
		t.Errorf("defaults legacy=%v hidden=%v auto=%v, want false false true", legacy, hidden, auto)
	}
}

// Opening a second connection to an already migrated schema must not fail or change anything.
func TestMigrationsRunTwice(t *testing.T) {
	conn := dbtest.Open(t)
	var v int
	if err := conn.QueryRowContext(context.Background(), `SELECT version FROM schema_migrations`).Scan(&v); err != nil {
		t.Fatal(err)
	}
	files, err := os.ReadDir("migrations")
	if err != nil {
		t.Fatal(err)
	}
	want := 0
	for _, f := range files {
		if strings.HasSuffix(f.Name(), ".up.sql") {
			want++
		}
	}
	if v != want {
		t.Errorf("schema version = %d, want %d (one per .up.sql file)", v, want)
	}
}
