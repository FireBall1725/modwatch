// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package db

import (
	"database/sql"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/sqlite"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

func hasLegacyColumn(t *testing.T, conn *sql.DB) bool {
	t.Helper()
	rows, err := conn.Query(`SELECT name FROM pragma_table_info('catalog')`)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = rows.Close() }()
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			t.Fatal(err)
		}
		if n == "legacy" {
			return true
		}
	}
	return false
}

func TestLegacyMigrationUpAndDown(t *testing.T) {
	conn, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	if !hasLegacyColumn(t, conn) {
		t.Fatal("catalog.legacy missing after up")
	}
	if _, err := conn.Exec(`INSERT INTO catalog (slug, name) VALUES ('a', 'A')`); err != nil {
		t.Fatal(err)
	}
	var legacy int
	if err := conn.QueryRow(`SELECT legacy FROM catalog WHERE slug = 'a'`).Scan(&legacy); err != nil || legacy != 0 {
		t.Fatalf("legacy default = %d, err %v", legacy, err)
	}

	src, err := iofs.New(migrations, "migrations")
	if err != nil {
		t.Fatal(err)
	}
	driver, err := sqlite.WithInstance(conn, &sqlite.Config{})
	if err != nil {
		t.Fatal(err)
	}
	m, err := migrate.NewWithInstance("iofs", src, "sqlite", driver)
	if err != nil {
		t.Fatal(err)
	}
	if err := m.Steps(-1); err != nil {
		t.Fatal(err)
	}
	if hasLegacyColumn(t, conn) {
		t.Error("catalog.legacy still there after down")
	}
	if err := m.Steps(1); err != nil {
		t.Fatal(err)
	}
	if !hasLegacyColumn(t, conn) {
		t.Error("catalog.legacy missing after up again")
	}
}
