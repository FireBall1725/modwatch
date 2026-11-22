// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package db_test

import (
	"context"
	"database/sql"
	"os"
	"strconv"
	"strings"
	"testing"

	"github.com/fireball1725/modwatch/internal/db"
	"github.com/fireball1725/modwatch/internal/db/dbtest"
)

func hasColumn(t *testing.T, conn *sql.DB, table, column string) bool {
	t.Helper()
	// A query that names the column fails when it is missing; LIMIT 0 reads nothing.
	_, err := conn.Exec(`SELECT ` + column + ` FROM ` + table + ` LIMIT 0`)
	return err == nil
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

// highest is the newest migration number in a dialect's folder.
func highest(t *testing.T, folder string) int {
	t.Helper()
	files, err := os.ReadDir("migrations/" + folder)
	if err != nil {
		t.Fatal(err)
	}
	max := 0
	for _, f := range files {
		if !strings.HasSuffix(f.Name(), ".up.sql") {
			continue
		}
		n, err := strconv.Atoi(strings.SplitN(f.Name(), "_", 2)[0])
		if err != nil {
			t.Fatalf("%s doesn't start with a number", f.Name())
		}
		if n > max {
			max = n
		}
	}
	return max
}

// Opening a migrated database again must not fail or change anything, and it sits at the newest version.
func TestMigrationsRunTwice(t *testing.T) {
	conn := dbtest.Open(t)
	var v int
	if err := conn.QueryRowContext(context.Background(), `SELECT version FROM schema_migrations`).Scan(&v); err != nil {
		t.Fatal(err)
	}
	if want := highest(t, db.Of(conn).String()); v != want {
		t.Errorf("schema version = %d, want %d (the newest file for %s)", v, want, db.Of(conn))
	}
}

// A schema change made for one database and forgotten for the other would leave a user on it with a broken app.
func TestBothDatabasesEndAtTheSameVersion(t *testing.T) {
	if pg, lite := highest(t, "postgres"), highest(t, "sqlite"); pg != lite {
		t.Errorf("postgres migrations end at %d but sqlite at %d; every schema change needs a file in both folders", pg, lite)
	}
}

func TestDialectFromURL(t *testing.T) {
	cases := map[string]db.Dialect{
		"postgres://u:p@h/db":        db.Postgres,
		"postgresql://u:p@h/db":      db.Postgres,
		"sqlite:///data/modwatch.db": db.SQLite,
		"sqlite:modwatch.db":         db.SQLite,
	}
	for url, want := range cases {
		if got, err := db.DialectOfURL(url); err != nil || got != want {
			t.Errorf("%s = %v, %v, want %v", url, got, err, want)
		}
	}
	if _, err := db.DialectOfURL("mysql://x"); err == nil {
		t.Error("an unknown scheme should be an error that names the choices")
	}
}

// A new SQLite install creates its own folder and file, and a second start reuses it.
func TestSQLiteCreatesItsFolderAndKeepsItsData(t *testing.T) {
	path := t.TempDir() + "/nested/dir/modwatch.db"
	conn, err := db.Open(context.Background(), "sqlite:"+path)
	if err != nil {
		t.Fatal(err)
	}
	if db.Of(conn) != db.SQLite {
		t.Errorf("dialect = %v", db.Of(conn))
	}
	if _, err := conn.Exec(`INSERT INTO catalog (slug, name) VALUES ('a', 'A')`); err != nil {
		t.Fatal(err)
	}
	_ = conn.Close()

	again, err := db.Open(context.Background(), "sqlite://"+path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = again.Close() }()
	var n int
	if err := again.QueryRow(`SELECT count(*) FROM catalog`).Scan(&n); err != nil || n != 1 {
		t.Errorf("rows after reopening = %d, %v", n, err)
	}
}
